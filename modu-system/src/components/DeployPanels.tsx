import { Fragment, useEffect, useRef, useState } from 'react'
import { apiErrorMessage, formatUtcDateTime } from '@modu/console-core'
import {
  DEPLOYMENT_STATUS_LABELS,
  deployService,
  durationLabel,
  durationSeconds,
  getDeployment,
  getServiceTags,
  isFinished,
  SERVICE_STATUS_LABELS,
  shortBy,
  STEP_LABELS,
  stepStates,
  type Deployment,
  type DeploymentStatus,
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

/** 태그 목록에서 하나 고르고 배포를 시작한다. 현재 태그는 "같은 태그 다시 배포"를 켜야 보낼 수 있다. */
export function TagPicker({ service, onStarted, onClose }: { service: DeployService; onStarted: (d: Deployment) => void; onClose: () => void }) {
  const [tags, setTags] = useState<ImageTag[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [redeploy, setRedeploy] = useState(false)
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
  const canSubmit = !!chosen && !submitting && (!chosen.current || redeploy)

  const submit = async () => {
    if (!chosen) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      onStarted(await deployService(service.name, chosen.tag))
    } catch (e) {
      setSubmitError(apiErrorMessage(e, '배포를 시작하지 못했습니다'))
      setSubmitting(false)
    }
  }

  return (
    <div className="deploy-panel" role="group" aria-label={`${service.name} 배포 태그 선택`}>
      <div className="deploy-panel-head">
        <strong>{service.name} 배포할 태그</strong>
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
                  <span>
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
      {submitError && <p className="error-text">{submitError}</p>}
      <div className="deploy-panel-actions">
        <button type="button" className="btn btn--primary" disabled={!canSubmit} onClick={() => void submit()}>
          {submitting ? '시작하는 중...' : '배포'}
        </button>
      </div>
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
        <p className="result-text deploy-status">
          완료 · 소요 {durationSeconds(deployment) ?? 0}초{rollout && ` · 준비 ${rollout.ready}/${rollout.desired}`}
        </p>
      )}
      {deployment.status === 'FAILED' && (
        <p className="error-text deploy-status" role="alert">
          실패: {deployment.error || '원인 없음'}
        </p>
      )}
      {pollError && <p className="error-text">{pollError}</p>}

      {deployment.commit && (
        <p className="card-muted deploy-commit">
          커밋{' '}
          <a href={deployment.commit.url} target="_blank" rel="noreferrer">
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

/** 배포 한 건의 펼친 내용: 단계·커밋·오류·소요. 이력 표와 카드에서 같이 쓴다. */
export function DeploymentDetail({ d }: { d: Deployment }) {
  return (
    <div className="deploy-detail">
      <ul className="deploy-detail-steps">
        {stepStates(d).map((s) => (
          <li key={s.name} className={`deploy-detail-step deploy-step--${s.status.toLowerCase()}`}>
            <span className="deploy-step-name">{STEP_LABELS[s.name]}</span>
            <span>{STEP_STATUS_LABELS[s.status]}</span>
            {s.message && <span className="card-muted">{s.message}</span>}
            {s.finishedAt && <span className="card-muted">{formatUtcDateTime(s.finishedAt)}</span>}
          </li>
        ))}
      </ul>
      <p className="deploy-detail-line card-muted">
        {d.previousTag && `이전 ${d.previousTag} · `}
        시작 {formatUtcDateTime(d.startedAt)}
        {d.finishedAt && ` · 끝 ${formatUtcDateTime(d.finishedAt)}`} · 소요 {durationLabel(d)}
        {d.commit && (
          <>
            {' · 커밋 '}
            <a href={d.commit.url} target="_blank" rel="noreferrer">
              {d.commit.sha.slice(0, 7)}
            </a>
          </>
        )}
      </p>
      {d.error && <p className="error-text deploy-detail-line">{d.error}</p>}
    </div>
  )
}

/**
 * 배포 목록. 행을 누르면 단계·커밋·오류가 펼쳐진다. PC 는 표, 폰은 카드.
 * [showService] 가 false 면 한 서비스 화면이라 서비스 칸을 뺀다.
 */
export function DeploymentList({ deployments, isMobile, showService = true, emptyText = '아직 배포 이력이 없다' }: { deployments: Deployment[]; isMobile: boolean; showService?: boolean; emptyText?: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id))

  if (deployments.length === 0) return <p className="card-muted">{emptyText}</p>

  if (isMobile) {
    return (
      <ul className="card-list">
        {deployments.map((d) => (
          <li key={d.id} className="card deploy-card">
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
    <table className="list-table deploy-table">
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
  )
}
