import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Select } from '@modu/console-core'
import { listRuns, RUN_STATUS_LABELS, type BatchRun, type RunStatus } from '../api/batch'
import { RunsTable } from '../components/BatchPanels'

const LIMIT = 100
/** 진행 중인 회차가 있을 수 있어 5초마다 다시 읽는다. */
const POLL_MS = 5_000

type StatusFilter = 'ALL' | RunStatus
const STATUS_FILTERS: StatusFilter[] = ['ALL', 'SUCCEEDED', 'FAILED', 'TIMEOUT', 'SKIPPED', 'RUNNING']

/** 실행 이력 전체(최신순). 서비스·상태로 거르고, 행을 펼치면 결과 JSON·오류·OpenSearch 링크. */
export default function BatchRunsPage() {
  const [params, setParams] = useSearchParams()
  const [runs, setRuns] = useState<BatchRun[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const service = params.get('service') ?? ''
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
  const filtered = useMemo(() => (runs ?? []).filter((r) => (!service || r.service === service) && (status === 'ALL' || r.status === status)), [runs, service, status])

  if (error && !runs) return <p className="error-text">{error}</p>
  if (!runs) return <p>불러오는 중...</p>

  return (
    <div>
      <header className="page-head">
        <div className="page-head-main">
          <h1>배치 실행 이력</h1>
          <p className="page-head-sub">최근 {LIMIT}건. 행을 누르면 서비스 응답·오류와 OpenSearch 링크가 펼쳐진다. 회차 id 가 서비스에 보낸 X-Request-Id 다.</p>
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
              onChange={(name) => setParams(name ? { service: name } : {})}
              options={[{ value: '', label: '모든 서비스' }, ...services.map((s) => ({ value: s, label: s }))]}
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
        <RunsTable runs={filtered} showJob initialOpen={openId} emptyText={runs.length === 0 ? '아직 실행 이력이 없다' : '조건에 맞는 회차가 없다'} />
      </section>
    </div>
  )
}
