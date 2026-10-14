import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { apiErrorMessage, ConfirmDialog, formatUtcDateTime, useIsMobile } from '@modu/console-core'
import {
  getDeployServices,
  getServiceTags,
  isFinished,
  listDeployments,
  rollbackService,
  type Deployment,
  type DeployService,
  type DeployServicesResponse,
  type ImageTag,
} from '../api/deploy'
import { DeployBy, DeploymentList, DeploymentStatusPill, DeployProgress, ServiceStatusPill, TagPicker } from '../components/DeployPanels'
import { findResumable, forgetOpen, rememberOpen } from '../util/openDeployments'

const POLL_MS = 15_000
const HISTORY_LIMIT = 20
const LOCKED_REASON = '이 서비스의 배포가 진행 중이다. 끝난 뒤에 배포·롤백할 수 있다.'

type Panel = { mode: 'pick' } | { mode: 'progress'; deployment: Deployment }

/**
 * 서비스 한 개의 배포 상세. 왼쪽 요약 카드(태그·준비 상태·마지막 배포, 배포·롤백), 오른쪽은 태그 고르기 → 확인 → 진행 카드, 그 아래 이 서비스의 배포 이력.
 * 배포·롤백은 확인 대화상자를 한 번 더 거친다. 서비스 목록 API 를 15초마다 다시 읽는다. 목록의 배포 버튼은 state.pick 으로 태그 고르기를 바로 연다.
 */
export default function DeployServicePage() {
  const { name = '' } = useParams<{ name: string }>()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [data, setData] = useState<DeployServicesResponse | null>(null)
  const [history, setHistory] = useState<Deployment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel | null>(() => ((location.state as { pick?: boolean } | null)?.pick ? { mode: 'pick' } : null))
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** 롤백 확인 대화상자. 열 때 태그 목록을 읽어 되돌릴 태그의 커밋 메시지를 보여 준다. */
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [rollbackTags, setRollbackTags] = useState<ImageTag[] | null>(null)

  /** 고르기·진행 카드. 화면이 쌓여(좁은 폭) 요약 카드 아래로 밀려 보이지 않으면 그 카드까지 내려 준다. */
  const panelRef = useRef<HTMLElement>(null)
  const panelKey = panel ? (panel.mode === 'pick' ? 'pick' : panel.deployment.id) : null
  const loaded = data !== null
  useEffect(() => {
    const el = panelRef.current
    if (!el || !panelKey) return
    if (el.getBoundingClientRect().top > window.innerHeight - 80) el.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [panelKey, loaded])

  const refresh = useCallback(async () => {
    try {
      const [services, deployments] = await Promise.all([getDeployServices(), listDeployments(name, HISTORY_LIMIT)])
      setData(services)
      setHistory(deployments)
      setError(null)
    } catch {
      setError((prev) => prev ?? '배포 서비스에 연결하지 못했습니다(deploy-service 가 떠 있는지 확인)')
    }
  }, [name])

  useEffect(() => {
    let cancelled = false
    const tick = () => {
      if (!cancelled) void refresh()
    }
    tick()
    const timer = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [refresh])

  // 새로고침해도 배포는 계속 돈다. 이 서비스의 진행 중 배포(이력의 RUNNING + 이 탭에서 열어 둔 것)를 되살린다. 진행 중이면 태그 고르기보다 앞선다.
  useEffect(() => {
    let cancelled = false
    findResumable(name)
      .then(([d]) => {
        if (cancelled || !d) return
        setPanel((prev) => (!prev || (prev.mode === 'pick' && !isFinished(d)) ? { mode: 'progress', deployment: d } : prev))
      })
      .catch(() => {
        // 이력을 못 읽으면 되살리지 않을 뿐이다.
      })
    return () => {
      cancelled = true
    }
  }, [name])

  const back = (
    <Link to="/deploy" className="back-link">
      ← 목록
    </Link>
  )
  if (error && !data)
    return (
      <div>
        {back}
        <p className="error-text">{error}</p>
      </div>
    )
  if (!data) return <p>불러오는 중...</p>

  const service: DeployService | undefined = data.services.find((s) => s.name === name)
  if (!service)
    return (
      <div>
        {back}
        <p className="error-text">배포 대상 서비스가 아닙니다: {name}</p>
      </div>
    )

  const openProgress = (deployment: Deployment) => {
    rememberOpen(service.name, deployment.id)
    setPanel({ mode: 'progress', deployment })
    void refresh()
  }

  const closePanel = () => {
    forgetOpen(service.name)
    setPanel(null)
  }

  const onFinished = (deployment: Deployment) => {
    forgetOpen(service.name)
    // 패널의 배포를 끝난 모습으로 바꿔 둔다(같은 id 라 진행 카드는 그대로, 잠금만 풀린다).
    setPanel((prev) => (prev?.mode === 'progress' && prev.deployment.id === deployment.id ? { mode: 'progress', deployment } : prev))
    void refresh()
  }

  const last = service.lastDeployment
  const running =
    (panel?.mode === 'progress' && !isFinished(panel.deployment)) || last?.status === 'RUNNING' || !!history?.some((d) => d.status === 'RUNNING')
  // 롤백은 마지막 성공 배포의 이전 태그로 간다(서버가 정한다). 이력에서 미리 찾아 확인 대화상자에 보여 준다.
  const lastSucceeded = history?.find((d) => d.status === 'SUCCEEDED') ?? null
  const rollbackTarget = lastSucceeded?.previousTag ?? null
  const rollbackCommit = rollbackTarget ? rollbackTags?.find((t) => t.tag === rollbackTarget) : undefined
  // 되돌릴 태그가 지금 실행 중인 태그와 같으면 롤백해도 바뀌는 게 없다(마지막 배포가 같은 태그 재배포였다). 버튼을 막는다.
  const rollbackNoop = rollbackTarget != null && rollbackTarget === service.runningTag
  const ROLLBACK_NOOP_REASON = '되돌릴 태그가 지금 실행 중인 태그와 같아 롤백할 것이 없다.'

  const openRollback = () => {
    setActionError(null)
    setRollbackTags(null)
    setRollbackOpen(true)
    getServiceTags(service.name)
      .then((r) => setRollbackTags(r.tags))
      .catch(() => setRollbackTags([]))
  }

  const rollback = async () => {
    if (busy) return
    setActionError(null)
    setBusy(true)
    try {
      const d = await rollbackService(service.name)
      setRollbackOpen(false)
      openProgress(d)
    } catch (e) {
      setRollbackOpen(false)
      setActionError(apiErrorMessage(e, '롤백을 시작하지 못했습니다'))
    } finally {
      setBusy(false)
    }
  }

  const mismatch = service.gitTag !== service.runningTag

  return (
    <div>
      {back}
      {error && <p className="error-text">{error}</p>}

      <div className="detail-layout deploy-detail-layout">
        <aside className="detail-aside detail-aside--sticky">
          <section className="section-card deploy-summary">
            <div className="deploy-summary-head">
              <h1>{service.name}</h1>
              <div className="link-chips">
                <a className="link-chip" href={data.argocd.url} target="_blank" rel="noreferrer">
                  Argo CD 열기
                </a>
                <Link className="link-chip" to={`/deploy/history?service=${encodeURIComponent(service.name)}`}>
                  전체 이력
                </Link>
              </div>
            </div>
            <dl className="kv-grid deploy-summary-facts">
              <dt>저장소</dt>
              <dd>{service.repo}</dd>
              <dt>이미지</dt>
              <dd className="deploy-image">{service.image}</dd>
              <dt>실행 중 태그</dt>
              <dd>{service.runningTag}</dd>
              <dt>Git 태그</dt>
              <dd className={mismatch ? 'deploy-tag--diff' : undefined}>
                {service.gitTag}
                {mismatch && <span className="card-muted deploy-hint"> 실행 중인 태그와 다르다(롤아웃 중이거나 동기화 전)</span>}
              </dd>
              <dt>준비</dt>
              <dd>
                <ServiceStatusPill status={service.status} />{' '}
                <span className="deploy-num">
                  {service.readyReplicas}/{service.desiredReplicas}
                </span>
                <span className="card-muted"> · 갱신 {service.updatedReplicas}</span>
              </dd>
              <dt>마지막 배포</dt>
              <dd>
                {last ? (
                  <div className="deploy-last">
                    <div className="deploy-last-line">
                      <span>{last.tag}</span>
                      <DeploymentStatusPill status={last.status} />
                    </div>
                    <div className="card-muted deploy-last-meta">
                      <DeployBy by={last.by} byId={last.byId} /> · {formatUtcDateTime(last.finishedAt) || '진행 중'}
                    </div>
                  </div>
                ) : (
                  <span className="card-muted">없음</span>
                )}
              </dd>
            </dl>
            <div className="deploy-summary-actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || running}
                title={running ? LOCKED_REASON : undefined}
                onClick={() => {
                  setActionError(null)
                  setPanel({ mode: 'pick' })
                }}
              >
                배포
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy || !last || running || rollbackNoop}
                onClick={openRollback}
                title={
                  running
                    ? LOCKED_REASON
                    : rollbackNoop
                      ? ROLLBACK_NOOP_REASON
                      : last
                        ? '마지막 성공 배포의 이전 태그로 되돌린다'
                        : '배포 이력이 없어 되돌릴 수 없다'
                }
              >
                롤백
              </button>
            </div>
            {running && <p className="deploy-lock-note">{LOCKED_REASON}</p>}
            {!running && rollbackNoop && <p className="deploy-lock-note">{ROLLBACK_NOOP_REASON}</p>}
            {actionError && <p className="error-text deploy-row-error">{actionError}</p>}
          </section>
        </aside>

        <div className="detail-main">
          {panel?.mode === 'pick' && (
            <section ref={panelRef} className="section-card deploy-panel-card">
              <TagPicker service={service} onStarted={openProgress} onClose={closePanel} lockedReason={running ? LOCKED_REASON : null} />
            </section>
          )}
          {panel?.mode === 'progress' && (
            <section ref={panelRef} className="section-card deploy-panel-card">
              <DeployProgress key={panel.deployment.id} initial={panel.deployment} onFinished={onFinished} onClose={closePanel} />
            </section>
          )}

          {/* 태그를 고르는 동안은 이력을 숨긴다(고르는 흐름만 보이게). */}
          {panel?.mode !== 'pick' && (
            <section className="section-card">
              <div className="section-card-head">
                <div>
                  <h2 className="section-card-title">배포 이력</h2>
                  <p className="section-card-hint">이 서비스의 최근 {HISTORY_LIMIT}건. 행을 누르면 단계·커밋·오류가 펼쳐진다. deploy-service 가 다시 뜨면 이력은 비워진다(dev).</p>
                </div>
              </div>
              {!history ? <p>불러오는 중...</p> : <DeploymentList deployments={history} isMobile={isMobile} showService={false} />}
            </section>
          )}
        </div>
      </div>

      {rollbackOpen && (
        <ConfirmDialog
          title={`${service.name} 롤백`}
          confirmLabel={rollbackTarget ? `${rollbackTarget} 로 롤백` : '이전 태그로 롤백'}
          danger
          initialFocus="cancel"
          busy={busy}
          onConfirm={() => void rollback()}
          onCancel={() => setRollbackOpen(false)}
        >
          <dl className="kv-grid confirm-facts">
            <dt>서비스</dt>
            <dd>{service.name}</dd>
            <dt>태그</dt>
            <dd>
              {service.runningTag} → <strong>{rollbackTarget ?? '마지막 성공 배포의 이전 태그'}</strong>
            </dd>
            <dt>커밋 메시지</dt>
            <dd>{!rollbackTarget ? '-' : rollbackTags === null ? '불러오는 중...' : rollbackCommit?.commitMessage || '-'}</dd>
          </dl>
          {rollbackTarget === service.runningTag && <p className="deploy-lock-note">되돌릴 태그가 지금 실행 중인 태그와 같다(마지막 배포가 같은 태그 재배포였다).</p>}
          <p className="card-muted">
            마지막 성공 배포{lastSucceeded ? `(${lastSucceeded.tag})` : ''}의 이전 태그로 modu_infra kustomization 을 되돌리고 Argo CD 동기화 → 롤아웃까지 진행한다.
          </p>
        </ConfirmDialog>
      )}
    </div>
  )
}
