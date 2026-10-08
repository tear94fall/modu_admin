import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiErrorMessage, ConfirmDialog, formatUtcDateTime } from '@modu/console-core'
import {
  DEPLOYMENT_STATUS_LABELS,
  deployService,
  durationLabel,
  durationSeconds,
  getDeployment,
  getServiceTags,
  historyEntryPath,
  isFinished,
  SERVICE_STATUS_LABELS,
  shortBy,
  STEP_LABELS,
  stepStates,
  type Deployment,
  type DeploymentStatus,
  type DeploymentStep,
  type DeployService,
  type ImageTag,
  type ServiceStatus,
  type StepStatus,
} from '../api/deploy'

/** 진행 중인 배포는 2초마다 다시 읽는다. */
const DEPLOYMENT_POLL_MS = 2_000

const STEP_STATUS_LABELS: Record<StepStatus, string> = { PENDING: '대기', RUNNING: '진행 중', SUCCEEDED: '성공', FAILED: '실패' }

export function ServiceStatusPill({ status }: { status: ServiceStatus }) {
  const cls = status === 'READY' ? 'status-badge status-badge--done' : status === 'PROGRESSING' ? 'status-badge status-badge--shipping' : 'status-badge status-badge--cancelled'
  return <span className={cls}>{SERVICE_STATUS_LABELS[status]}</span>
}

/** 배포자. 긴 값(이메일·숫자 sub)은 자기 칸 안에서 말줄임하고 전체 값은 title 로 남긴다. */
export function DeployBy({ by, byId }: { by: string; byId?: string | null }) {
  return (
    <span className="deploy-by" title={byId ?? by}>
      {shortBy(by)}
    </span>
  )
}

export function DeploymentStatusPill({ status }: { status: DeploymentStatus }) {
  const cls = status === 'SUCCEEDED' ? 'status-badge status-badge--done' : status === 'RUNNING' ? 'status-badge status-badge--shipping' : 'status-badge status-badge--cancelled'
  return <span className={cls}>{DEPLOYMENT_STATUS_LABELS[status]}</span>
}

/**
 * 태그 목록에서 하나 고르고, 한 번 더 확인한 뒤 배포를 시작한다. 현재 태그는 "같은 태그 다시 배포"를 켜야 보낼 수 있다.
 * [lockedReason] 이 있으면(이 서비스 배포가 진행 중) 고를 수는 있어도 보낼 수 없다.
 */
export function TagPicker({ service, onStarted, onClose, lockedReason }: { service: DeployService; onStarted: (d: Deployment) => void; onClose: () => void; lockedReason?: string | null }) {
  const [tags, setTags] = useState<ImageTag[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [redeploy, setRedeploy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getServiceTags(service.name)
      .then((r) => {
        if (!cancelled) setTags(r.tags)
      })
      .catch(() => {
        if (!cancelled) setLoadError('태그 목록을 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
  }, [service.name])

  const chosen = tags?.find((t) => t.tag === selected) ?? null
  const canSubmit = !!chosen && !submitting && !lockedReason && (!chosen.current || redeploy)

  const submit = async () => {
    if (!chosen || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const d = await deployService(service.name, chosen.tag)
      setConfirming(false)
      onStarted(d)
    } catch (e) {
      setSubmitError(apiErrorMessage(e, '배포를 시작하지 못했습니다'))
      setConfirming(false)
      setSubmitting(false)
    }
  }

  return (
    <div className="deploy-panel" role="group" aria-label={`${service.name} 배포 태그 선택`}>
      <div className="deploy-panel-head">
        <div className="deploy-panel-title">
          <strong>{service.name} 배포할 태그</strong>
          <span className="card-muted deploy-panel-sub">지금 실행 중 {service.runningTag}</span>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          닫기
        </button>
      </div>
      {loadError && <p className="error-text">{loadError}</p>}
      {!loadError && !tags && <p>태그 불러오는 중...</p>}
      {tags && tags.length === 0 && <p className="card-muted">GHCR 에 develop-*·master-* 태그가 없습니다</p>}
      {tags && tags.length > 0 && (
        <ul className="deploy-tag-list">
          {tags.map((t) => (
            <li key={t.tag}>
              <label className={t.tag === selected ? 'deploy-tag deploy-tag--on' : 'deploy-tag'}>
                <input type="radio" name={`tag-${service.name}`} value={t.tag} checked={t.tag === selected} onChange={() => setSelected(t.tag)} />
                <span className="deploy-tag-body">
                  <span className="deploy-tag-name">
                    {t.tag}
                    {t.current && <span className="status-badge status-badge--selling deploy-tag-current">현재</span>}
                  </span>
                  <span className="card-muted deploy-tag-meta">
                    {formatUtcDateTime(t.createdAt)}
                    {t.commitMessage && ` · ${t.commitMessage}`}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {chosen?.current && (
        <label className="form-check">
          <input type="checkbox" checked={redeploy} onChange={(e) => setRedeploy(e.target.checked)} />
          같은 태그 다시 배포
        </label>
      )}
      {lockedReason && <p className="deploy-lock-note">{lockedReason}</p>}
      {submitError && <p className="error-text">{submitError}</p>}
      <div className="deploy-panel-actions">
        <button type="button" className="btn btn--primary" disabled={!canSubmit} onClick={() => setConfirming(true)}>
          {submitting ? '시작하는 중...' : '배포'}
        </button>
      </div>
      {confirming && chosen && (
        <ConfirmDialog
          title={`${service.name} 배포`}
          confirmLabel={`${chosen.tag} 배포`}
          busy={submitting}
          onConfirm={() => void submit()}
          onCancel={() => setConfirming(false)}
        >
          <dl className="kv-grid confirm-facts">
            <dt>서비스</dt>
            <dd>{service.name}</dd>
            <dt>태그</dt>
            <dd>
              {service.runningTag} → <strong>{chosen.tag}</strong>
            </dd>
            <dt>커밋 메시지</dt>
            <dd>{chosen.commitMessage || '-'}</dd>
            <dt>태그 생성</dt>
            <dd>{formatUtcDateTime(chosen.createdAt)}</dd>
          </dl>
          <p className="card-muted">modu_infra kustomization 에 커밋하고 Argo CD 동기화 → 롤아웃까지 진행한다.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}

/** 배포 한 건의 진행. 끝날 때까지 2초마다 읽고, 닫으면 폴링도 멈춘다. */
export function DeployProgress({ initial, onFinished, onClose }: { initial: Deployment; onFinished: (d: Deployment) => void; onClose: () => void }) {
  const [deployment, setDeployment] = useState(initial)
  const [pollError, setPollError] = useState<string | null>(null)
  const finished = isFinished(deployment)
  // 부모가 매번 새 콜백을 만들어도 폴링을 다시 걸지 않도록 ref 로 둔다.
  const onFinishedRef = useRef(onFinished)
  useEffect(() => {
    onFinishedRef.current = onFinished
  })

  useEffect(() => {
    if (finished) return
    let cancelled = false
    const timer = setInterval(() => {
      getDeployment(initial.id)
        .then((d) => {
          if (cancelled) return
          setDeployment(d)
          setPollError(null)
          if (isFinished(d)) onFinishedRef.current(d)
        })
        .catch(() => {
          if (!cancelled) setPollError('진행 상태를 읽지 못했습니다(다시 시도 중)')
        })
    }, DEPLOYMENT_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [initial.id, finished])

  const percent = Math.max(0, Math.min(100, Math.round(deployment.percent)))
  const steps = stepStates(deployment)
  const rollout = deployment.rollout ?? null

  return (
    <div className="deploy-panel" role="group" aria-label={`${deployment.service} 배포 진행`}>
      <div className="deploy-panel-head">
        <strong>
          {deployment.service} → {deployment.tag}
          {deployment.previousTag && <span className="card-muted deploy-prev"> (이전 {deployment.previousTag})</span>}
        </strong>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          {finished ? '닫기' : '숨기기'}
        </button>
      </div>

      <ol className="deploy-stepper">
        {steps.map((s, i) => (
          <li key={s.name} className={`deploy-step deploy-step--${s.status.toLowerCase()}`}>
            <span className="deploy-step-dot" aria-hidden="true">
              {s.status === 'SUCCEEDED' ? '✓' : s.status === 'FAILED' ? '!' : i + 1}
            </span>
            <span className="deploy-step-body">
              <span className="deploy-step-name">{STEP_LABELS[s.name]}</span>
              {s.message && <span className="card-muted deploy-step-msg">{s.message}</span>}
            </span>
          </li>
        ))}
      </ol>

      <div className="deploy-progress">
        <div className="deploy-progress-bar" role="progressbar" aria-label="배포 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className={deployment.status === 'FAILED' ? 'deploy-progress-fill deploy-progress-fill--failed' : 'deploy-progress-fill'} style={{ width: `${percent}%` }} />
        </div>
        <span className="deploy-progress-text deploy-num">{percent}%</span>
      </div>

      {deployment.status === 'RUNNING' && (
        <p className="deploy-status">
          {deployment.step === 'DONE' ? '마무리' : STEP_LABELS[deployment.step]} 진행 중
          {rollout && ` · 준비 ${rollout.ready}/${rollout.desired}`}
          {' · '}
          <DeployBy by={deployment.by} byId={deployment.byId} />
        </p>
      )}
      {deployment.status === 'SUCCEEDED' && (
        <div className="deploy-result deploy-result--ok" role="status">
          <strong className="deploy-result-title">배포 성공</strong>
          <span className="deploy-result-text">
            완료 · 소요 {durationSeconds(deployment) ?? 0}초{rollout && ` · 준비 ${rollout.ready}/${rollout.desired}`}
          </span>
          <Link className="link-chip" to={historyEntryPath(deployment)}>
            이력에서 보기
          </Link>
        </div>
      )}
      {deployment.status === 'FAILED' && (
        <div className="deploy-result deploy-result--fail" role="alert">
          <strong className="deploy-result-title">배포 실패</strong>
          <span className="deploy-result-text">
            실패: {deployment.error || '원인 없음'}
            {durationSeconds(deployment) !== null && ` · 소요 ${durationSeconds(deployment)}초`}
          </span>
          <Link className="link-chip" to={historyEntryPath(deployment)}>
            이력에서 보기
          </Link>
        </div>
      )}
      {pollError && <p className="error-text">{pollError}</p>}

      {deployment.commit && (
        <p className="card-muted deploy-commit">
          커밋{' '}
          <a className="link-chip" href={deployment.commit.url} target="_blank" rel="noreferrer">
            {deployment.commit.sha.slice(0, 7)}
          </a>
        </p>
      )}

      {rollout && rollout.pods.length > 0 && (
        <table className="list-table deploy-pods">
          <colgroup>
            <col style={{ width: '46%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>파드</th>
              <th>단계</th>
              <th>준비</th>
              <th>사유</th>
            </tr>
          </thead>
          <tbody>
            {rollout.pods.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.phase}</td>
                <td>{p.ready ? '준비됨' : '대기'}</td>
                <td className="card-muted">{p.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const stepSeconds = (s: DeploymentStep) => (s.startedAt && s.finishedAt ? durationSeconds({ startedAt: s.startedAt, finishedAt: s.finishedAt }) : null)

/** 배포 한 건의 펼친 내용: 단계 세로 타임라인(시작·소요·메시지), 핵심 값 표, 오류 상자. 이력 표와 카드에서 같이 쓴다. */
export function DeploymentDetail({ d }: { d: Deployment }) {
  return (
    <div className="deploy-detail">
      <ol className="deploy-timeline" aria-label="배포 단계">
        {stepStates(d).map((s, i) => {
          const sec = stepSeconds(s)
          return (
            <li key={s.name} className={`deploy-timeline-item deploy-step--${s.status.toLowerCase()}`}>
              <span className="deploy-step-dot" aria-hidden="true">
                {s.status === 'SUCCEEDED' ? '✓' : s.status === 'FAILED' ? '!' : i + 1}
              </span>
              <div className="deploy-timeline-body">
                <div className="deploy-timeline-head">
                  <span className="deploy-step-name">{STEP_LABELS[s.name]}</span>
                  <span className="deploy-timeline-status">{STEP_STATUS_LABELS[s.status]}</span>
                </div>
                {(s.startedAt || s.finishedAt) && (
                  <div className="card-muted deploy-timeline-meta">
                    {s.startedAt ? `시작 ${formatUtcDateTime(s.startedAt)}` : `끝 ${formatUtcDateTime(s.finishedAt!)}`}
                    {sec !== null && ` · ${sec}초`}
                  </div>
                )}
                {s.message && <div className="deploy-timeline-msg">{s.message}</div>}
              </div>
            </li>
          )
        })}
      </ol>
      <div className="deploy-detail-side">
        <dl className="kv-grid deploy-detail-facts">
          <dt>태그</dt>
          <dd>{d.previousTag ? `${d.previousTag} → ${d.tag}` : d.tag}</dd>
          <dt>배포자</dt>
          <dd>
            <DeployBy by={d.by} byId={d.byId} />
          </dd>
          <dt>시작</dt>
          <dd>{formatUtcDateTime(d.startedAt)}</dd>
          <dt>종료</dt>
          <dd>{d.finishedAt ? formatUtcDateTime(d.finishedAt) : '진행 중'}</dd>
          <dt>소요</dt>
          <dd>{durationLabel(d)}</dd>
          {d.commit && (
            <>
              <dt>커밋</dt>
              <dd>
                <a className="link-chip" href={d.commit.url} target="_blank" rel="noreferrer">
                  {d.commit.sha.slice(0, 7)}
                </a>
              </dd>
            </>
          )}
        </dl>
        {d.error && (
          <div className="deploy-error-box">
            <span className="deploy-error-label">오류</span>
            <p className="deploy-error-text">{d.error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 배포 목록. 행을 누르면 단계·커밋·오류가 펼쳐진다. PC 는 표, 폰은 카드.
 * [showService] 가 false 면 한 서비스 화면이라 서비스 칸을 뺀다.
 */
export function DeploymentList({
  deployments,
  isMobile,
  showService = true,
  emptyText = '아직 배포 이력이 없다',
  initialOpen = null,
}: {
  deployments: Deployment[]
  isMobile: boolean
  showService?: boolean
  emptyText?: string
  /** 처음부터 펼쳐 둘 배포 id(결과 배너의 "이력에서 보기"). */
  initialOpen?: string | null
}) {
  const [open, setOpen] = useState<string | null>(initialOpen)
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id))

  if (deployments.length === 0) return <p className="card-muted">{emptyText}</p>

  if (isMobile) {
    return (
      <ul className="card-rows">
        {deployments.map((d) => (
          <li key={d.id} className="deploy-card">
            <button type="button" className="deploy-card-toggle" onClick={() => toggle(d.id)} aria-expanded={open === d.id}>
              <span className="card-title">{showService ? `${d.service} → ${d.tag}` : d.tag}</span>
              <span className="card-line card-muted">
                <DeployBy by={d.by} byId={d.byId} /> · {formatUtcDateTime(d.startedAt)}
              </span>
              <span className="card-line">
                <DeploymentStatusPill status={d.status} /> {durationLabel(d)}
              </span>
            </button>
            {open === d.id && <DeploymentDetail d={d} />}
          </li>
        ))}
      </ul>
    )
  }

  const columns = showService ? 6 : 5
  return (
    <div className="card-table-wrap">
      <table className="list-table card-table deploy-table">
        <colgroup>
          {showService && <col style={{ width: '16%' }} />}
          <col style={{ width: showService ? '20%' : '26%' }} />
          <col />
          <col style={{ width: showService ? '22%' : '24%' }} />
          <col style={{ width: showService ? '12%' : '13%' }} />
          <col style={{ width: showService ? '10%' : '11%' }} />
        </colgroup>
        <thead>
          <tr>
            {showService && <th>서비스</th>}
            <th>태그</th>
            <th>배포자</th>
            <th>시작</th>
            <th>상태</th>
            <th>소요</th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((d) => (
            <Fragment key={d.id}>
              <tr className="clickable-row" onClick={() => toggle(d.id)} aria-expanded={open === d.id}>
                {showService && <td>{d.service}</td>}
                <td>{d.tag}</td>
                <td>
                  <DeployBy by={d.by} byId={d.byId} />
                </td>
                <td>{formatUtcDateTime(d.startedAt)}</td>
                <td>
                  <DeploymentStatusPill status={d.status} />
                </td>
                <td className="deploy-num">{durationLabel(d)}</td>
              </tr>
              {open === d.id && (
                <tr className="deploy-panel-row">
                  <td colSpan={columns}>
                    <DeploymentDetail d={d} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
