import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiErrorMessage, formatUtcDateTime, Select } from '@modu/console-core'
import {
  createJob,
  cronPreview,
  DEFAULT_ZONE,
  durationLabel,
  jobPath,
  listServiceJobs,
  listServices,
  openSearchUrl,
  RUN_STATUS_LABELS,
  TRIGGER_LABELS,
  updateJob,
  type BatchJob,
  type BatchRun,
  type RunStatus,
  type ServiceJob,
} from '../api/batch'

export function RunStatusPill({ status }: { status: RunStatus }) {
  const cls =
    status === 'SUCCEEDED'
      ? 'status-badge status-badge--done'
      : status === 'RUNNING'
        ? 'status-badge status-badge--shipping'
        : status === 'SKIPPED'
          ? 'status-badge'
          : 'status-badge status-badge--cancelled'
  return <span className={cls}>{RUN_STATUS_LABELS[status]}</span>
}

/** 회차 한 건의 펼친 내용: 핵심 값, 서비스가 돌려준 결과(JSON), 오류, OpenSearch 링크. */
export function RunDetail({ run }: { run: BatchRun }) {
  return (
    <div className="deploy-detail batch-run-detail">
      <dl className="kv-grid deploy-detail-facts">
        <dt>회차 id</dt>
        <dd className="mono">{run.id}</dd>
        <dt>시작</dt>
        <dd>{formatUtcDateTime(run.startedAt)}</dd>
        <dt>끝</dt>
        <dd>{run.finishedAt ? formatUtcDateTime(run.finishedAt) : '진행 중'}</dd>
        <dt>소요</dt>
        <dd>{durationLabel(run)}</dd>
        <dt>HTTP</dt>
        <dd>{run.httpStatus ?? '-'}</dd>
        <dt>실행</dt>
        <dd>
          {TRIGGER_LABELS[run.trigger]}
          {run.triggeredBy && ` · ${run.triggeredBy}`}
        </dd>
      </dl>
      {run.error && (
        <div className="deploy-error-box" role="alert">
          <span className="deploy-error-label">오류</span>
          <span className="deploy-error-text">{run.error}</span>
        </div>
      )}
      {run.result && (
        <details className="batch-result" open>
          <summary>서비스 응답</summary>
          <pre className="batch-result-json">{JSON.stringify(run.result, null, 2)}</pre>
        </details>
      )}
      <p className="card-muted">
        <a className="link-chip" href={openSearchUrl(run.id)} target="_blank" rel="noreferrer">
          OpenSearch 에서 이 회차 로그 보기
        </a>
      </p>
    </div>
  )
}

/** 회차 표. 행을 누르면 펼친다. [showJob] 이면 서비스/잡 칸을 둔다(전체 이력), 아니면 잡 상세 안의 표. */
export function RunsTable({ runs, showJob, initialOpen, emptyText }: { runs: BatchRun[]; showJob: boolean; initialOpen?: string | null; emptyText: string }) {
  // ?open= 이 바뀌면(결과 배너의 "회차 보기") 그 회차를 펼친다 — 어떤 initialOpen 에서 파생했는지 같이 들고 있어 렌더 중에 바꾼다(effect 없이).
  const [state, setState] = useState<{ from: string | null | undefined; open: string | null }>({ from: initialOpen, open: initialOpen ?? null })
  if (state.from !== initialOpen) setState({ from: initialOpen, open: initialOpen ?? null })
  const open = state.from === initialOpen ? state.open : (initialOpen ?? null)
  const setOpen = (id: string | null) => setState({ from: initialOpen, open: id })

  if (runs.length === 0) return <p className="card-muted route-empty">{emptyText}</p>
  return (
    <table className="list-table deploy-table batch-runs">
      <thead>
        <tr>
          <th>시작</th>
          {showJob && <th>잡</th>}
          <th>실행</th>
          <th>상태</th>
          <th>소요</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => {
          const isOpen = open === r.id
          return (
            <Fragment key={r.id}>
              <tr className="clickable-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
                <td>{formatUtcDateTime(r.startedAt)}</td>
                {showJob && (
                  <td>
                    <Link to={jobPath(r.batchJobId)} onClick={(e) => e.stopPropagation()}>
                      {r.service}/{r.jobName}
                    </Link>
                  </td>
                )}
                <td>
                  {TRIGGER_LABELS[r.trigger]}
                  {r.triggeredBy && <span className="card-muted"> · {r.triggeredBy}</span>}
                </td>
                <td>
                  <RunStatusPill status={r.status} />
                </td>
                <td className="deploy-num">{durationLabel(r)}</td>
              </tr>
              {isOpen && (
                <tr className="deploy-row-detail">
                  <td colSpan={showJob ? 5 : 4}>
                    <RunDetail run={r} />
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

/** cron 입력 아래 다음 실행 시각 미리보기. 식이 틀리면 서버의 메시지. */
export function CronPreview({ cron, zone }: { cron: string; zone: string }) {
  const [next, setNext] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const empty = !cron.trim()
  useEffect(() => {
    if (empty) return
    let cancelled = false
    const timer = setTimeout(() => {
      cronPreview(cron.trim(), zone.trim() || DEFAULT_ZONE, 3)
        .then((n) => {
          if (cancelled) return
          setNext(n)
          setError(null)
        })
        .catch((e) => {
          if (cancelled) return
          setNext(null)
          setError(apiErrorMessage(e, 'cron 식을 확인할 수 없습니다'))
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [cron, zone, empty])
  if (empty) return null
  if (error) return <p className="error-text form-hint">{error}</p>
  if (!next) return null
  return <p className="card-muted form-hint">다음 실행: {next.map((t) => formatUtcDateTime(t)).join(' · ')}</p>
}

type JobFormValues = { service: string; jobName: string; cron: string; zone: string; timeoutSeconds: string; description: string; enabled: boolean }

/**
 * 잡 등록([job] 없음) 또는 수정([job] 있음 — 서비스·잡 이름은 바꿀 수 없다). 등록은 서비스를 고르면 그 서비스가 알려 주는 잡 목록에서 고른다(경로를 손으로 적지 않는다).
 */
export function JobForm({ job, onSaved, onCancel }: { job?: BatchJob; onSaved: (job: BatchJob) => void; onCancel: () => void }) {
  const editing = !!job
  const [values, setValues] = useState<JobFormValues>({
    service: job?.service ?? '',
    jobName: job?.jobName ?? '',
    cron: job?.cron ?? '',
    zone: job?.zone ?? DEFAULT_ZONE,
    timeoutSeconds: String(job?.timeoutSeconds ?? 600),
    description: job?.description ?? '',
    enabled: job?.enabled ?? false,
  })
  const [services, setServices] = useState<string[] | null>(null)
  const [serviceJobs, setServiceJobs] = useState<ServiceJob[] | null>(null)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editing) return
    let cancelled = false
    listServices()
      .then((s) => {
        if (!cancelled) setServices(s.map((x) => x.name))
      })
      .catch(() => {
        if (!cancelled) setError('서비스 목록을 불러오지 못했습니다(batch-service 가 떠 있는지 확인)')
      })
    return () => {
      cancelled = true
    }
  }, [editing])

  useEffect(() => {
    if (editing || !values.service) return
    let cancelled = false
    listServiceJobs(values.service)
      .then((j) => {
        if (!cancelled) setServiceJobs(j)
      })
      .catch((e) => {
        if (!cancelled) setJobsError(apiErrorMessage(e, '이 서비스의 잡 목록을 불러오지 못했습니다'))
      })
    return () => {
      cancelled = true
    }
  }, [editing, values.service])

  const set = <K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) => setValues((v) => ({ ...v, [key]: value }))
  const selectedJob = serviceJobs?.find((j) => j.name === values.jobName)
  const timeout = Number(values.timeoutSeconds)
  const canSubmit = !submitting && values.cron.trim() !== '' && Number.isInteger(timeout) && timeout > 0 && (editing || (values.service !== '' && values.jobName !== ''))

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const description = values.description.trim() || (selectedJob?.description ?? '')
      const saved = editing
        ? await updateJob(job!.id, {
            ...(values.cron.trim() !== job!.cron ? { cron: values.cron.trim() } : {}),
            ...(values.zone.trim() !== job!.zone ? { zone: values.zone.trim() } : {}),
            ...(timeout !== job!.timeoutSeconds ? { timeoutSeconds: timeout } : {}),
            ...(values.description.trim() !== (job!.description ?? '') ? { description: values.description.trim() } : {}),
            ...(values.enabled !== job!.enabled ? { enabled: values.enabled } : {}),
          })
        : await createJob({
            service: values.service,
            jobName: values.jobName,
            cron: values.cron.trim(),
            zone: values.zone.trim() || DEFAULT_ZONE,
            timeoutSeconds: timeout,
            enabled: values.enabled,
            ...(description ? { description } : {}),
          })
      onSaved(saved)
    } catch (e) {
      setError(apiErrorMessage(e, editing ? '잡을 수정하지 못했습니다' : '잡을 등록하지 못했습니다'))
      setSubmitting(false)
    }
  }

  return (
    <form
      className="form-card batch-job-form"
      aria-label={editing ? '잡 수정' : '잡 등록'}
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="form-grid">
        <label className="form-field">
          <span>서비스</span>
          {editing ? (
            <input value={values.service} disabled />
          ) : (
            <Select aria-label="서비스" value={values.service} onChange={(v) => {
                setValues((x) => ({ ...x, service: v, jobName: '' }))
                setServiceJobs(null)
                setJobsError(null)
              }} placeholder="서비스를 고르세요" options={(services ?? []).map((s) => ({ value: s, label: s }))} disabled={!services} />
          )}
        </label>
        <label className="form-field">
          <span>잡</span>
          {editing ? (
            <input value={values.jobName} disabled />
          ) : (
            <Select
              aria-label="잡"
              value={values.jobName}
              onChange={(v) => set('jobName', v)}
              placeholder={!values.service ? '먼저 서비스를 고르세요' : serviceJobs === null && !jobsError ? '잡 목록 불러오는 중...' : '잡을 고르세요'}
              options={(serviceJobs ?? []).map((j) => ({ value: j.name, label: j.description ? `${j.name} — ${j.description}` : j.name }))}
              disabled={!serviceJobs || serviceJobs.length === 0}
            />
          )}
        </label>
        <label className="form-field">
          <span>주기(cron, 초 분 시 일 월 요일)</span>
          <input className="mono" value={values.cron} onChange={(e) => set('cron', e.target.value)} placeholder="0 0 4 * * *" />
          <CronPreview cron={values.cron} zone={values.zone} />
        </label>
        <label className="form-field form-field--narrow">
          <span>타임존</span>
          <input value={values.zone} onChange={(e) => set('zone', e.target.value)} />
        </label>
        <label className="form-field form-field--narrow">
          <span>타임아웃(초)</span>
          <input type="number" min={1} value={values.timeoutSeconds} onChange={(e) => set('timeoutSeconds', e.target.value)} />
        </label>
        <label className="form-field">
          <span>설명</span>
          <input value={values.description} onChange={(e) => set('description', e.target.value)} placeholder={selectedJob?.description ?? ''} />
        </label>
        <label className="form-check">
          <input type="checkbox" checked={values.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          스케줄 사용(끄면 수동 실행만 된다)
        </label>
      </div>
      {jobsError && <p className="error-text">{jobsError}</p>}
      {!editing && serviceJobs && serviceJobs.length === 0 && <p className="card-muted">이 서비스에는 돌릴 수 있는 잡이 없습니다.</p>}
      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
          {submitting ? '저장하는 중...' : editing ? '저장' : '등록'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  )
}
