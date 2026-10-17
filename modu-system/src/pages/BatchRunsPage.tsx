import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Select, useIsMobile } from '@modu/console-core'
import { listRuns, RUN_STATUS_LABELS, type BatchRun, type RunStatus } from '../api/batch'
import { RunsTable } from '../components/BatchPanels'

const LIMIT = 100
/** 진행 중인 회차가 있을 수 있어 5초마다 다시 읽는다. */
const POLL_MS = 5_000

type StatusFilter = 'ALL' | RunStatus
const STATUS_FILTERS: StatusFilter[] = ['ALL', 'SUCCEEDED', 'FAILED', 'TIMEOUT', 'SKIPPED', 'RUNNING']

/** 실행 이력 전체(최신순). 배포 이력과 같은 짜임: 서비스 → 그 서비스의 배치 → 상태로 거르고, 행을 펼치면 결과 JSON·오류·OpenSearch 링크. */
export default function BatchRunsPage() {
  const isMobile = useIsMobile()
  const [params, setParams] = useSearchParams()
  const [runs, setRuns] = useState<BatchRun[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const service = params.get('service') ?? ''
  /** 배치(잡 이름). 서비스 하나에 배치가 여럿이라 서비스를 고른 뒤 그 안에서 다시 고른다. */
  const job = params.get('job') ?? ''
  /** 결과 배너의 "회차 보기"로 오면 그 회차를 펼쳐 둔다. */
  const openId = params.get('open')

  useEffect(() => {
    let cancelled = false
    const load = () =>
      listRuns(undefined, undefined, LIMIT)
        .then((r) => {
          if (cancelled) return
          setRuns(r)
          setError(null)
        })
        .catch(() => {
          if (!cancelled) setError('실행 이력을 불러오지 못했습니다(batch-service 가 떠 있는지 확인)')
        })
    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const services = useMemo(() => [...new Set((runs ?? []).map((r) => r.service))].sort(), [runs])
  /** 배치 후보: 서비스를 골랐으면 그 서비스의 배치만, 아니면 전부. */
  const jobNames = useMemo(() => [...new Set((runs ?? []).filter((r) => !service || r.service === service).map((r) => r.jobName))].sort(), [runs, service])
  const filtered = useMemo(
    () => (runs ?? []).filter((r) => (!service || r.service === service) && (!job || r.jobName === job) && (status === 'ALL' || r.status === status)),
    [runs, service, job, status],
  )

  /** 필터를 바꿔도 펼쳐 둔 회차(?open=)는 그대로 둔다. 서비스를 바꾸면 배치 선택은 푼다(다른 서비스의 배치 이름이 남지 않게). */
  const setFilter = (key: 'service' | 'job', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'service') next.delete('job')
    setParams(next)
  }

  if (error && !runs) return <p className="error-text">{error}</p>
  if (!runs) return <p>불러오는 중...</p>

  return (
    <div>
      <header className="page-head">
        <div className="page-head-main">
          <h1>실행 이력</h1>
          <p className="page-head-sub">최근 {LIMIT}건. 서비스 → 배치 → 상태로 거른다. 행을 누르면 서비스 응답·오류와 OpenSearch 링크가 펼쳐진다. 회차 id 가 서비스에 보낸 X-Request-Id 다.</p>
        </div>
      </header>
      {error && <p className="error-text">{error}</p>}

      <section className="section-card deploy-history-card">
        <div className="section-card-head">
          <div className="deploy-filters">
            <Select
              className="deploy-service-select"
              aria-label="서비스"
              value={service}
              onChange={(v) => setFilter('service', v)}
              options={[{ value: '', label: '모든 서비스' }, ...services.map((s) => ({ value: s, label: s }))]}
            />
            <Select
              className="deploy-service-select"
              aria-label="배치"
              value={job}
              onChange={(v) => setFilter('job', v)}
              options={[{ value: '', label: '모든 배치' }, ...jobNames.map((n) => ({ value: n, label: n }))]}
            />
            <div className="filter-chips" role="radiogroup" aria-label="상태">
              {STATUS_FILTERS.map((f) => (
                <button key={f} type="button" role="radio" aria-checked={status === f} className={status === f ? 'filter-chip filter-chip--on' : 'filter-chip'} onClick={() => setStatus(f)}>
                  {f === 'ALL' ? '전체' : RUN_STATUS_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
          <span className="section-card-count">
            {filtered.length} / {runs.length}
          </span>
        </div>

        <RunsTable runs={filtered} showJob isMobile={isMobile} initialOpen={openId} emptyText={runs.length === 0 ? '아직 실행 이력이 없다' : '조건에 맞는 회차가 없다'} />
      </section>
    </div>
  )
}
