import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiErrorMessage, formatUtcDateTime, useIsMobile } from '@modu/console-core'
import { getDeployServices, listDeployments, rollbackService, type Deployment, type DeployService, type DeployServicesResponse } from '../api/deploy'
import { DeployBy, DeploymentList, DeploymentStatusPill, DeployProgress, ServiceStatusPill, TagPicker } from '../components/DeployPanels'
import { findResumable, forgetOpen, rememberOpen } from '../util/openDeployments'

const POLL_MS = 15_000
const HISTORY_LIMIT = 20

type Panel = { mode: 'pick' } | { mode: 'progress'; deployment: Deployment }

/** 서비스 한 개의 배포 상세. 태그·준비 상태·마지막 배포, 배포·롤백, 이 서비스의 배포 이력. 서비스 목록 API 를 15초마다 다시 읽는다. */
export default function DeployServicePage() {
  const { name = '' } = useParams<{ name: string }>()
  const isMobile = useIsMobile()
  const [data, setData] = useState<DeployServicesResponse | null>(null)
  const [history, setHistory] = useState<Deployment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  // 새로고침해도 배포는 계속 돈다. 이 서비스의 진행 중 배포(이력의 RUNNING + 이 탭에서 열어 둔 것)를 되살린다.
  useEffect(() => {
    let cancelled = false
    findResumable(name)
      .then(([d]) => {
        if (cancelled || !d) return
        setPanel((prev) => prev ?? { mode: 'progress', deployment: d })
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

  const onFinished = () => {
    forgetOpen(service.name)
    void refresh()
  }

  const rollback = async () => {
    setActionError(null)
    setBusy(true)
    try {
      openProgress(await rollbackService(service.name))
    } catch (e) {
      setActionError(apiErrorMessage(e, '롤백을 시작하지 못했습니다'))
    } finally {
      setBusy(false)
    }
  }

  const mismatch = service.gitTag !== service.runningTag
  const last = service.lastDeployment

  return (
    <div>
      {back}
      <h1>{service.name}</h1>
      <p className="page-note">
        {service.repo} · {service.image} ·{' '}
        <a href={data.argocd.url} target="_blank" rel="noreferrer">
          Argo CD 열기
        </a>
      </p>
      {error && <p className="error-text">{error}</p>}

      <div className="info-card deploy-service-card">
        <dl className="detail-grid">
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
        <div className="deploy-actions">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => setPanel({ mode: 'pick' })}>
            배포
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={busy || !last}
            onClick={() => void rollback()}
            title={last ? '마지막 성공 배포의 이전 태그로 되돌린다' : '배포 이력이 없어 되돌릴 수 없다'}
          >
            롤백
          </button>
        </div>
        {actionError && <p className="error-text deploy-row-error">{actionError}</p>}
        {panel?.mode === 'pick' && <TagPicker service={service} onStarted={openProgress} onClose={closePanel} />}
        {panel?.mode === 'progress' && <DeployProgress key={panel.deployment.id} initial={panel.deployment} onFinished={onFinished} onClose={closePanel} />}
      </div>

      <section className="deploy-history">
        <div className="deploy-history-head">
          <h2>배포 이력</h2>
          <Link to={`/deploy/history?service=${encodeURIComponent(service.name)}`}>전체 이력 →</Link>
        </div>
        <p className="page-note">이 서비스의 최근 {HISTORY_LIMIT}건. 행을 누르면 단계·커밋·오류가 펼쳐진다. deploy-service 가 다시 뜨면 이력은 비워진다(dev).</p>
        {!history ? <p>불러오는 중...</p> : <DeploymentList deployments={history} isMobile={isMobile} showService={false} />}
      </section>
    </div>
  )
}
