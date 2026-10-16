import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiErrorMessage, ConfirmDialog, formatUtcDateTime } from '@modu/console-core'
import { jobPath, listJobs, runJob, runsPath, updateJob, type BatchJob } from '../api/batch'
import { JobForm, RunStatusPill } from '../components/BatchPanels'

/** 잡 목록은 15초마다 다시 읽는다(다음 실행·마지막 회차가 바뀐다). */
const POLL_MS = 15_000

/**
 * 배치 잡 목록. 서비스/잡·주기·다음 실행·마지막 회차를 보여 주고, 켜기/끄기와 "지금 실행"(확인 한 번)을 바로 한다. 등록은 위의 폼에서(서비스 → 그 서비스의 잡 → 주기).
 * 주기 수정·삭제·이력은 상세에서.
 */
export default function BatchJobsPage() {
  const [jobs, setJobs] = useState<BatchJob[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [running, setRunning] = useState<BatchJob | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'fail'; text: string; runId?: string } | null>(null)

  const refresh = useCallback(async () => {
    try {
      setJobs(await listJobs())
      setError(null)
    } catch {
      setError((prev) => prev ?? '배치 서비스에 연결하지 못했습니다(batch-service 가 떠 있는지 확인)')
    }
  }, [])

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

  const toggle = async (job: BatchJob) => {
    setBusy(true)
    try {
      const saved = await updateJob(job.id, { enabled: !job.enabled })
      setJobs((prev) => prev?.map((j) => (j.id === saved.id ? saved : j)) ?? prev)
      setNotice({ kind: 'ok', text: `${saved.service}/${saved.jobName} 스케줄을 ${saved.enabled ? '켰습니다' : '꺼습니다'}` })
    } catch (e) {
      setNotice({ kind: 'fail', text: apiErrorMessage(e, '사용 여부를 바꾸지 못했습니다') })
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    if (!running) return
    setBusy(true)
    try {
      const r = await runJob(running.id)
      setNotice(
        r.status === 'SKIPPED'
          ? { kind: 'fail', text: `${running.service}/${running.jobName}: 앞 회차가 아직 돌고 있어 건너뛰었습니다`, runId: r.runId }
          : { kind: 'ok', text: `${running.service}/${running.jobName} 실행을 시작했습니다`, runId: r.runId },
      )
      setRunning(null)
      void refresh()
    } catch (e) {
      setNotice({ kind: 'fail', text: apiErrorMessage(e, '실행을 시작하지 못했습니다') })
      setRunning(null)
    } finally {
      setBusy(false)
    }
  }

  if (error && !jobs) return <p className="error-text">{error}</p>
  if (!jobs) return <p>불러오는 중...</p>

  return (
    <div>
      <header className="page-head">
        <div className="page-head-main">
          <h1>배치 잡</h1>
          <p className="page-head-sub">각 서비스의 잡을 어떤 주기로 돌릴지 정한다. 작업 본문은 서비스에 있고, 여기서는 주기·사용 여부·실행만 다룬다.</p>
        </div>
        <div className="page-head-actions">
          <Link className="btn btn--secondary" to={runsPath()}>
            실행 이력
          </Link>
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)} disabled={creating}>
            잡 등록
          </button>
        </div>
      </header>
      {error && <p className="error-text">{error}</p>}
      {notice && (
        <div className={notice.kind === 'ok' ? 'deploy-result deploy-result--ok' : 'deploy-result deploy-result--fail'} role="status">
          <span className="deploy-result-text">{notice.text}</span>
          {notice.runId && (
            <Link className="link-chip" to={runsPath(notice.runId)}>
              회차 보기
            </Link>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setNotice(null)}>
            닫기
          </button>
        </div>
      )}

      {creating && (
        <section className="section-card">
          <div className="section-card-head">
            <strong>잡 등록</strong>
          </div>
          <JobForm
            onSaved={(job) => {
              setCreating(false)
              setNotice({ kind: 'ok', text: `${job.service}/${job.jobName} 을 등록했습니다${job.enabled ? '' : ' (스케줄 꺼짐)'}` })
              void refresh()
            }}
            onCancel={() => setCreating(false)}
          />
        </section>
      )}

      <section className="section-card">
        <div className="section-card-head">
          <strong>등록된 잡</strong>
          <span className="section-card-count">{jobs.length}</span>
        </div>
        {jobs.length === 0 ? (
          <p className="card-muted route-empty">등록된 잡이 없다. "잡 등록"으로 서비스와 잡을 고르고 주기를 정한다.</p>
        ) : (
          <table className="list-table deploy-table batch-jobs">
            <thead>
              <tr>
                <th>서비스 / 잡</th>
                <th>주기</th>
                <th>다음 실행</th>
                <th>마지막 회차</th>
                <th>사용</th>
                <th aria-label="동작" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link to={jobPath(j.id)}>
                      {j.service}/{j.jobName}
                    </Link>
                    {j.description && <div className="card-muted">{j.description}</div>}
                  </td>
                  <td>
                    <span className="mono">{j.cron}</span>
                    <div className="card-muted">{j.zone}</div>
                  </td>
                  <td>{j.enabled && j.nextRunAt ? formatUtcDateTime(j.nextRunAt) : <span className="card-muted">-</span>}</td>
                  <td>
                    {j.lastRun ? (
                      <div className="deploy-last">
                        <div className="deploy-last-line">
                          <RunStatusPill status={j.lastRun.status} />
                        </div>
                        <div className="card-muted deploy-last-meta">{formatUtcDateTime(j.lastRun.startedAt)}</div>
                      </div>
                    ) : (
                      <span className="card-muted">없음</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={j.enabled}
                      aria-label={`${j.service}/${j.jobName} 스케줄 사용`}
                      className={j.enabled ? 'filter-chip filter-chip--on' : 'filter-chip'}
                      disabled={busy}
                      onClick={() => void toggle(j)}
                    >
                      {j.enabled ? '켜짐' : '꺼짐'}
                    </button>
                  </td>
                  <td className="deploy-actions">
                    <button type="button" className="btn btn--primary btn--sm" disabled={busy || j.lastRun?.status === 'RUNNING'} onClick={() => setRunning(j)} aria-label={`${j.service}/${j.jobName} 지금 실행`}>
                      지금 실행
                    </button>
                    <Link className="btn btn--secondary btn--sm" to={jobPath(j.id)} aria-label={`${j.service}/${j.jobName} 상세`}>
                      상세
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {running && (
        <ConfirmDialog title="잡 지금 실행" confirmLabel={`${running.jobName} 실행`} busy={busy} onConfirm={() => void run()} onCancel={() => setRunning(null)}>
          <dl className="kv-grid confirm-facts">
            <dt>서비스</dt>
            <dd>{running.service}</dd>
            <dt>잡</dt>
            <dd>{running.jobName}</dd>
            <dt>타임아웃</dt>
            <dd>{running.timeoutSeconds}초</dd>
          </dl>
          <p className="card-muted">스케줄과 무관하게 한 회차를 바로 돌린다. 결과는 실행 이력에서 본다.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
