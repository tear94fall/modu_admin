import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useIsMobile } from '@modu/console-core'
import { listDeployments, type Deployment, type DeploymentStatus } from '../api/deploy'
import { DeploymentList } from '../components/DeployPanels'

const LIMIT = 50
/** 진행 중인 배포가 있으면 끝날 때까지 목록도 따라가게 다시 읽는다. */
const POLL_MS = 5_000

type StatusFilter = 'ALL' | DeploymentStatus

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'SUCCEEDED', label: '성공' },
  { value: 'FAILED', label: '실패' },
  { value: 'RUNNING', label: '진행 중' },
]

/** 배포 이력. deploy-service 메모리에 남은 최근 50건을 서비스·상태로 거르고, 행을 누르면 단계·커밋·오류를 본다. */
export default function DeployHistoryPage() {
  const isMobile = useIsMobile()
  const [params, setParams] = useSearchParams()
  const [deployments, setDeployments] = useState<Deployment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const service = params.get('service') ?? ''

  useEffect(() => {
    let cancelled = false
    const load = () =>
      listDeployments(undefined, LIMIT)
        .then((d) => {
          if (cancelled) return
          setDeployments(d)
          setError(null)
        })
        .catch(() => {
          if (!cancelled) setError('배포 이력을 불러오지 못했습니다(deploy-service 가 떠 있는지 확인)')
        })
    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const services = useMemo(() => [...new Set((deployments ?? []).map((d) => d.service))].sort(), [deployments])
  const filtered = useMemo(
    () => (deployments ?? []).filter((d) => (!service || d.service === service) && (status === 'ALL' || d.status === status)),
    [deployments, service, status],
  )

  const selectService = (name: string) => {
    if (name) setParams({ service: name })
    else setParams({})
  }

  if (error && !deployments) return <p className="error-text">{error}</p>
  if (!deployments) return <p>불러오는 중...</p>

  return (
    <div>
      <h1>배포 이력</h1>
      <p className="page-note">최근 {LIMIT}건. 행을 누르면 단계·커밋·오류가 펼쳐진다. deploy-service 가 다시 뜨면 이력은 비워진다(dev).</p>
      {error && <p className="error-text">{error}</p>}

      <div className="list-controls deploy-controls">
        <select className="config-file-select deploy-service-select" aria-label="서비스" value={service} onChange={(e) => selectService(e.target.value)}>
          <option value="">모든 서비스</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="card-muted deploy-count">
          {filtered.length} / {deployments.length}
        </span>
      </div>
      <div className="access-chips" role="radiogroup" aria-label="상태">
        {STATUS_FILTERS.map((f) => (
          <button key={f.value} type="button" role="radio" aria-checked={status === f.value} className={status === f.value ? 'access-chip access-chip--on' : 'access-chip'} onClick={() => setStatus(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      <DeploymentList deployments={filtered} isMobile={isMobile} emptyText={deployments.length === 0 ? '아직 배포 이력이 없다' : '조건에 맞는 배포가 없다'} />
    </div>
  )
}
