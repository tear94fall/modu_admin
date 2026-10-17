import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiErrorMessage, ConfirmDialog, formatUtcDateTime, useIsMobile } from '@modu/console-core'
import { jobPath, listJobs, runJob, runsPath, updateJob, type BatchJob } from '../api/batch'
import { JobForm, RunStatusPill } from '../components/BatchPanels'

/** 잡 목록은 15초마다 다시 읽는다(다음 실행·마지막 회차가 바뀐다). */
const POLL_MS = 15_000

const matchesJob = (j: BatchJob, keyword: string) => {
  const k = keyword.trim().toLowerCase()
  if (!k) return true
  return `${j.service}/${j.jobName} ${j.description ?? ''} ${j.cron}`.toLowerCase().includes(k)
}

/**
 * 배치 목록. 서비스 배포 화면과 같은 짜임(요약 숫자 → 카드 안 표, 행을 누르면 상세): 배치 이름·서비스·주기·다음 실행·마지막 회차를 보여 주고,
 * 켜기/끄기와 "지금 실행"(확인 한 번)을 바로 한다. 등록은 위의 폼에서(서비스 → 그 서비스의 잡 → 주기). 주기 수정·삭제·이력은 상세에서.
 */
export default function BatchJobsPage() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<BatchJob[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
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

  const visible = useMemo(() => (jobs ?? []).filter((j) => matchesJob(j, keyword)), [jobs, keyword])

  const toggle = async (job: BatchJob) => {
    setBusy(true)
    try {
      const saved = await updateJob(job.id, { enabled: !job.enabled })
      setJobs((prev) => prev?.map((j) => (j.id === saved.id ? saved : j)) ?? prev)
      setNotice({ kind: 'ok', text: `${saved.service}/${saved.jobName} 스케줄을 ${saved.enabled ? '켰습니다' : '껐습니다'}` })
      // 토글보다 먼저 떠난 폴링 응답이 늦게 와 되돌려 보이지 않게 한 번 더 맞춘다.
      void refresh()
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

  const isRunning = (j: BatchJob) => j.lastRun?.status === 'RUNNING'
  const stats = {
    enabled: jobs.filter((j) => j.enabled).length,
    running: jobs.filter(isRunning).length,
    failed: jobs.filter((j) => j.lastRun && (j.lastRun.status === 'FAILED' || j.lastRun.status === 'TIMEOUT')).length,
  }

  const switchButton = (j: BatchJob) => (
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
  )
  const runButton = (j: BatchJob) => (
    <button
      type="button"
      className="btn btn--primary btn--sm"
      disabled={busy || isRunning(j)}
      title={isRunning(j) ? '회차가 돌고 있다. 끝난 뒤에 실행할 수 있다.' : '스케줄과 무관하게 한 회차를 바로 돌린다'}
      onClick={() => setRunning(j)}
      aria-label={`${j.service}/${j.jobName} 지금 실행`}
    >
      지금 실행
    </button>
  )
  const detailLink = (j: BatchJob) => (
    <Link className="btn btn--secondary btn--sm" to={jobPath(j.id)} aria-label={`${j.service}/${j.jobName} 상세`}>
      상세
    </Link>
  )
  // td 자체를 flex 로 만들면 표 셀 배치가 깨진다 — 셀 안에 블록 하나를 두고 그 안에서 두 줄(상태 / 시각)로 배치한다.
  const renderLast = (j: BatchJob) =>
    j.lastRun ? (
      <div className="deploy-last">
        <div className="deploy-last-line">
          <RunStatusPill status={j.lastRun.status} />
        </div>
        <div className="card-muted deploy-last-meta">{formatUtcDateTime(j.lastRun.startedAt)}</div>
      </div>
    ) : (
      <span className="card-muted">없음</span>
    )
  const nextRun = (j: BatchJob) => (j.enabled && j.nextRunAt ? formatUtcDateTime(j.nextRunAt) : <span className="card-muted">-</span>)

  return (
    <div>
      <header className="page-head">
        <div className="page-head-main">
          <h1>배치 목록</h1>
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

      <section className="stat-grid" aria-label="잡 요약">
        <div className="stat-card">
          <div className="stat-card-label">잡</div>
          <div className="stat-card-value">
            {jobs.length}
            <span className="stat-card-unit">개</span>
          </div>
        </div>
        <div className="stat-card stat-card--good">
          <div className="stat-card-label">스케줄 켜짐</div>
          <div className="stat-card-value">{stats.enabled}</div>
        </div>
        <div className="stat-card stat-card--info">
          <div className="stat-card-label">실행 중</div>
          <div className="stat-card-value">{stats.running}</div>
        </div>
        <div className={stats.failed > 0 ? 'stat-card stat-card--bad' : 'stat-card'}>
          <div className="stat-card-label">마지막 회차 실패</div>
          <div className="stat-card-value">{stats.failed}</div>
          <div className="stat-card-sub">실패 또는 타임아웃</div>
        </div>
      </section>

      {creating && (
        <section className="section-card">
          <div className="section-card-head">
            <div>
              <h2 className="section-card-title">잡 등록</h2>
              <p className="section-card-hint">서비스를 고르면 그 서비스가 알려 주는 잡 목록에서 고른다</p>
            </div>
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

      <section className="section-card deploy-services">
        <div className="section-card-head">
          <div>
            <h2 className="section-card-title">등록된 잡</h2>
            <p className="section-card-hint">{isMobile ? '행을 누르면 상세로' : '행을 누르면 상세로 · 켜짐/꺼짐은 바로 바뀐다 · 지금 실행은 확인 한 번'}</p>
          </div>
          <div className="section-card-actions">
            <input className="route-search section-card-search" type="search" aria-label="잡 검색" placeholder="서비스·잡·설명·cron 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <span className="section-card-count">
              {visible.length} / {jobs.length}
            </span>
          </div>
        </div>

        {jobs.length === 0 && <p className="card-muted">등록된 잡이 없다. "잡 등록"으로 서비스와 잡을 고르고 주기를 정한다.</p>}
        {jobs.length > 0 && visible.length === 0 && <p className="card-muted">검색에 맞는 잡이 없다</p>}

        {visible.length > 0 && isMobile && (
          <ul className="card-rows">
            {visible.map((j) => (
              <li key={j.id} className="deploy-card">
                <span className="card-body">
                  <Link className="card-title deploy-card-link" to={jobPath(j.id)}>
                    {j.jobName}
                  </Link>
                  <span className="card-line card-muted">
                    {j.service}
                    {j.description && ` · ${j.description}`}
                  </span>
                  <span className="card-line">
                    <span className="mono">{j.cron}</span> <span className="card-muted">{j.zone}</span>
                  </span>
                  <span className="card-line card-muted">다음 실행 {nextRun(j)}</span>
                  <span className="card-line">{renderLast(j)}</span>
                  <span className="card-meta deploy-actions">
                    {switchButton(j)}
                    {runButton(j)}
                    {detailLink(j)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {visible.length > 0 && !isMobile && (
          <div className="card-table-wrap">
            <table className="list-table card-table deploy-table batch-jobs">
              {/* 배치 이름(이름+설명)이 제일 넓어야 한다: 나머지가 62% + 180px 이고 남는 폭을 가져간다. */}
              <colgroup>
                <col />
                <col style={{ width: '15%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '180px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>배치 이름</th>
                  <th>서비스</th>
                  <th>주기</th>
                  <th>다음 실행</th>
                  <th>마지막 회차</th>
                  <th>사용</th>
                  <th aria-label="동작" />
                </tr>
              </thead>
              <tbody>
                {visible.map((j) => (
                  <tr key={j.id} className="clickable-row" onClick={() => navigate(jobPath(j.id))}>
                    <td>
                      <div className="deploy-last">
                        <div className="deploy-last-line">{j.jobName}</div>
                        {j.description && <div className="card-muted deploy-last-meta">{j.description}</div>}
                      </div>
                    </td>
                    <td className="deploy-nowrap" title={j.service}>
                      {j.service}
                    </td>
                    <td>
                      <div className="deploy-last">
                        <div className="deploy-last-line mono">{j.cron}</div>
                        <div className="card-muted deploy-last-meta">{j.zone}</div>
                      </div>
                    </td>
                    <td>{nextRun(j)}</td>
                    <td>{renderLast(j)}</td>
                    <td onClick={(e) => e.stopPropagation()}>{switchButton(j)}</td>
                    <td className="deploy-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <span className="deploy-actions">
                        {runButton(j)}
                        {detailLink(j)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
