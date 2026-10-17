import { api } from '@modu/console-core'

/**
 * batch-service(게이트웨이 `/batch-service/api-system/batch/...`, ROLE_SYSTEM). 잡 정의(어느 서비스의 어느 잡을 어떤 cron 으로)와
 * 실행 이력을 보여 주고, 주기·사용 여부를 바꾸거나 지금 실행한다. 작업 본문은 각 서비스에 있고 batch-service 는 "언제 누가 돌렸나"만 맡는다.
 */
const BASE = '/batch-service/api-system/batch'

export type RunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMEOUT' | 'SKIPPED'
export type RunTrigger = 'CRON' | 'MANUAL'

export interface BatchRun {
  /** 회차 id = 서비스에 보낸 X-Request-Id(`job-…`). OpenSearch 에서 양쪽 로그를 이 값으로 본다. */
  id: string
  batchJobId: number
  service: string
  jobName: string
  trigger: RunTrigger
  /** 수동이면 실행한 직원, cron 이면 null. */
  triggeredBy: string | null
  status: RunStatus
  startedAt: string
  finishedAt?: string | null
  durationMs?: number | null
  httpStatus?: number | null
  /** 서비스가 돌려준 JSON 본문(commerce 의 JobRun: job·outcome·durationMs·requestId·result). */
  result?: Record<string, unknown> | null
  error?: string | null
}

export interface BatchJob {
  id: number
  service: string
  jobName: string
  description: string | null
  cron: string
  zone: string
  enabled: boolean
  timeoutSeconds: number
  nextRunAt: string | null
  lastRun: BatchRun | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface BatchChange {
  id: number
  batchJobId: number
  changedBy: string
  changedAt: string
  field: string
  before: string | null
  after: string | null
}

export interface ServiceJob {
  name: string
  description?: string | null
}

export interface CreateJobRequest {
  service: string
  jobName: string
  cron: string
  zone?: string
  enabled?: boolean
  timeoutSeconds?: number
  description?: string
}

export interface UpdateJobRequest {
  cron?: string
  zone?: string
  enabled?: boolean
  timeoutSeconds?: number
  description?: string
}

export const listJobs = () => api<{ jobs: BatchJob[] }>(`${BASE}/jobs`).then((r) => r.jobs)

export const getJob = (id: number) => api<BatchJob>(`${BASE}/jobs/${id}`)

export const createJob = (req: CreateJobRequest) => api<BatchJob>(`${BASE}/jobs`, { method: 'POST', body: JSON.stringify(req) })

export const updateJob = (id: number, req: UpdateJobRequest) => api<BatchJob>(`${BASE}/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(req) })

export const deleteJob = (id: number) => api<void>(`${BASE}/jobs/${id}`, { method: 'DELETE' })

/** 지금 실행(202). RUNNING 회차 id 를 돌려준다 — 이미 돌고 있으면 status 가 SKIPPED 로 온다. */
export const runJob = (id: number) => api<{ runId: string; status: RunStatus }>(`${BASE}/jobs/${id}/run`, { method: 'POST' })

export const listJobRuns = (id: number, limit = 20) => api<{ runs: BatchRun[] }>(`${BASE}/jobs/${id}/runs?limit=${limit}`).then((r) => r.runs)

export const listJobChanges = (id: number, limit = 50) => api<{ changes: BatchChange[] }>(`${BASE}/jobs/${id}/changes?limit=${limit}`).then((r) => r.changes)

export async function listRuns(service?: string, status?: RunStatus, limit = 50): Promise<BatchRun[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (service) params.set('service', service)
  if (status) params.set('status', status)
  const res = await api<{ runs: BatchRun[] }>(`${BASE}/runs?${params}`)
  return res.runs
}

export const getRun = (runId: string) => api<BatchRun>(`${BASE}/runs/${encodeURIComponent(runId)}`)

export const cronPreview = (cron: string, zone: string, count = 3) =>
  api<{ next: string[] }>(`${BASE}/cron/preview?${new URLSearchParams({ cron, zone, count: String(count) })}`).then((r) => r.next)

export const listServices = () => api<{ services: { name: string; url: string }[] }>(`${BASE}/services`).then((r) => r.services)

export const listServiceJobs = (service: string) => api<{ jobs: ServiceJob[] }>(`${BASE}/services/${encodeURIComponent(service)}/jobs`).then((r) => r.jobs)

export const RUN_STATUS_LABELS: Record<RunStatus, string> = { RUNNING: '진행 중', SUCCEEDED: '성공', FAILED: '실패', TIMEOUT: '시간 초과', SKIPPED: '건너뜀' }

export const TRIGGER_LABELS: Record<RunTrigger, string> = { CRON: '스케줄', MANUAL: '수동' }

export const FIELD_LABELS: Record<string, string> = {
  created: '등록',
  deleted: '삭제',
  cron: '주기(cron)',
  zone: '타임존',
  enabled: '사용',
  timeoutSeconds: '타임아웃(초)',
  description: '설명',
}

export const DEFAULT_ZONE = 'Asia/Seoul'

/** 회차가 끝났는지(더 폴링하지 않는다). */
export const isRunFinished = (r: Pick<BatchRun, 'status'>) => r.status !== 'RUNNING'

export const jobPath = (id: number) => `/batch/jobs/${id}`

/** 실행 이력 화면에서 그 회차를 펼친 채로 연다. */
export const runsPath = (runId?: string) => (runId ? `/batch/runs?open=${encodeURIComponent(runId)}` : '/batch/runs')

/** 소요 시간 문구. 진행 중이면 '-'. */
export function durationLabel(r: Pick<BatchRun, 'durationMs'>): string {
  if (r.durationMs === null || r.durationMs === undefined) return '-'
  if (r.durationMs < 1000) return `${r.durationMs}ms`
  return `${(r.durationMs / 1000).toFixed(r.durationMs < 10_000 ? 1 : 0)}초`
}

/**
 * OpenSearch Dashboards 에서 이 회차의 로그를 모두 보는 주소(batch-service 의 batch.run + 서비스의 job.run·SQL·Feign·Kafka — 같은 requestId).
 * 주소는 VITE_OPENSEARCH_DASHBOARDS_URL(기본 http://localhost:5601), 인덱스 패턴 id 는 modu-app-logs.
 */
export function openSearchUrl(runId: string): string {
  const base = (import.meta.env.VITE_OPENSEARCH_DASHBOARDS_URL ?? 'http://localhost:5601').replace(/\/$/, '')
  const query = encodeURIComponent(`attributes.requestId:"${runId}"`)
  return `${base}/app/data-explorer/discover#?_a=(discover:(columns:!(attributes.service,attributes.event,attributes.outcome,message),isDirty:!f,sort:!()),metadata:(indexPattern:'modu-app-logs',view:discover))&_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-7d,to:now))&_q=(filters:!(),query:(language:kuery,query:'${query}'))`
}
