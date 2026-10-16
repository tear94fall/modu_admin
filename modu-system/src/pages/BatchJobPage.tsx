import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiErrorMessage, ConfirmDialog, formatUtcDateTime } from '@modu/console-core'
import { deleteJob, FIELD_LABELS, getJob, listJobChanges, listJobRuns, runJob, type BatchChange, type BatchJob, type BatchRun } from '../api/batch'
import { JobForm, RunStatusPill, RunsTable } from '../components/BatchPanels'

/** 진행 중인 회차가 있으면 끝날 때까지 5초마다, 아니면 15초마다 다시 읽는다. */
const POLL_MS = 15_000
const RUNS_LIMIT = 30

/** 잡 한 건: 정의(수정 폼)·지금 실행·삭제, 이 잡의 회차 이력, 설정 변경 이력(누가 언제 무엇을). */
export default function BatchJobPage() {
  const { id = '' } = useParams<{ id: string }>()
  const jobId = Number(id)
  const navigate = useNavigate()
  const [job, setJob] = useState<BatchJob | null>(null)
  const [runs, setRuns] = useState<BatchRun[] | null>(null)
  const [changes, setChanges] = useState<BatchChange[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmRun, setConfirmRun] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'fail'; text: string } | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [j, r, c] = await Promise.all([getJob(jobId), listJobRuns(jobId, RUNS_LIMIT), listJobChanges(jobId)])
      setJob(j)
      setRuns(r)
      setChanges(c)
      setError(null)
    } catch (e) {
      setError((prev) => prev ?? apiErrorMessage(e, '잡을 불러오지 못했습니다(batch-service 가 떠 있는지 확인)'))
    }
  }, [jobId])

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

  const back = (
    <Link to="/batch" className="back-link">
      ← 잡 목록
    </Link>
  )
  if (error && !job)
    return (
      <div>
        {back}
        <p className="error-text">{error}</p>
      </div>
    )
  if (!job || !runs || !changes) return <p>불러오는 중...</p>

  const run = async () => {
    setBusy(true)
    try {
      const r = await runJob(job.id)
      setNotice(r.status === 'SKIPPED' ? { kind: 'fail', text: '앞 회차가 아직 돌고 있어 건너뛰었습니다' } : { kind: 'ok', text: `실행을 시작했습니다 (회차 ${r.runId})` })
      setConfirmRun(false)
      void refresh()
    } catch (e) {
      setNotice({ kind: 'fail', text: apiErrorMessage(e, '실행을 시작하지 못했습니다') })
      setConfirmRun(false)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteJob(job.id)
      navigate('/batch', { replace: true })
    } catch (e) {
      setNotice({ kind: 'fail', text: apiErrorMessage(e, '잡을 지우지 못했습니다') })
      setDeleting(false)
      setBusy(false)
    }
  }

  return (
    <div>
      {back}
      <header className="page-head">
        <div className="page-head-main">
          <h1>
            {job.service}/{job.jobName}
          </h1>
          <p className="page-head-sub">{job.description || '설명 없음'}</p>
        </div>
        <div className="page-head-actions">
          <button type="button" className="btn btn--primary" disabled={busy || job.lastRun?.status === 'RUNNING'} onClick={() => setConfirmRun(true)}>
            지금 실행
          </button>
          <button type="button" className="btn btn--secondary" disabled={editing} onClick={() => setEditing(true)}>
            수정
          </button>
          <button type="button" className="btn btn--danger" disabled={busy} onClick={() => setDeleting(true)}>
            삭제
          </button>
        </div>
      </header>
      {error && <p className="error-text">{error}</p>}
      {notice && (
        <div className={notice.kind === 'ok' ? 'deploy-result deploy-result--ok' : 'deploy-result deploy-result--fail'} role="status">
          <span className="deploy-result-text">{notice.text}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setNotice(null)}>
            닫기
          </button>
        </div>
      )}

      <section className="section-card">
        <div className="section-card-head">
          <strong>정의</strong>
          <span className="card-muted">{job.enabled ? '스케줄 켜짐' : '스케줄 꺼짐(수동 실행만)'}</span>
        </div>
        {editing ? (
          <JobForm
            job={job}
            onSaved={(saved) => {
              setJob(saved)
              setEditing(false)
              setNotice({ kind: 'ok', text: '저장했습니다' })
              void refresh()
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <dl className="kv-grid deploy-summary-facts">
            <dt>주기</dt>
            <dd>
              <span className="mono">{job.cron}</span> <span className="card-muted">{job.zone}</span>
            </dd>
            <dt>다음 실행</dt>
            <dd>{job.enabled && job.nextRunAt ? formatUtcDateTime(job.nextRunAt) : '-'}</dd>
            <dt>타임아웃</dt>
            <dd>{job.timeoutSeconds}초</dd>
            <dt>마지막 회차</dt>
            <dd>
              {job.lastRun ? (
                <>
                  <RunStatusPill status={job.lastRun.status} /> <span className="card-muted">{formatUtcDateTime(job.lastRun.startedAt)}</span>
                </>
              ) : (
                '없음'
              )}
            </dd>
            <dt>호출</dt>
            <dd className="mono">POST /api-internal/v1/jobs/{job.jobName}/run</dd>
          </dl>
        )}
      </section>

      <section className="section-card">
        <div className="section-card-head">
          <strong>실행 이력</strong>
          <span className="section-card-count">최근 {RUNS_LIMIT}건</span>
        </div>
        <RunsTable runs={runs} showJob={false} emptyText="아직 돌린 회차가 없다" />
      </section>

      <section className="section-card">
        <div className="section-card-head">
          <strong>설정 변경 이력</strong>
        </div>
        {changes.length === 0 ? (
          <p className="card-muted route-empty">변경 이력이 없다</p>
        ) : (
          <table className="list-table deploy-table batch-changes">
            <thead>
              <tr>
                <th>시각</th>
                <th>누가</th>
                <th>무엇을</th>
                <th>변경</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.id}>
                  <td>{formatUtcDateTime(c.changedAt)}</td>
                  <td>{c.changedBy}</td>
                  <td>{FIELD_LABELS[c.field] ?? c.field}</td>
                  <td className="mono">
                    {c.before ?? '-'} → {c.after ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {confirmRun && (
        <ConfirmDialog title="잡 지금 실행" confirmLabel={`${job.jobName} 실행`} busy={busy} onConfirm={() => void run()} onCancel={() => setConfirmRun(false)}>
          <p className="card-muted">스케줄과 무관하게 한 회차를 바로 돌린다. 타임아웃 {job.timeoutSeconds}초.</p>
        </ConfirmDialog>
      )}
      {deleting && (
        <ConfirmDialog title="잡 삭제" confirmLabel={`${job.jobName} 삭제`} danger initialFocus="cancel" busy={busy} onConfirm={() => void remove()} onCancel={() => setDeleting(false)}>
          <p className="card-muted">스케줄을 멈추고 정의를 지운다. 실행 이력은 남는다.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
