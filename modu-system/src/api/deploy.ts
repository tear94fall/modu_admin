import { api } from '@modu/console-core'

/**
 * deploy-service(게이트웨이 `/deploy-service/api-system/deploy/...`, ROLE_SYSTEM). 서비스별 GHCR 태그를 골라
 * modu_infra kustomization 커밋 → Argo CD 동기화 → 롤아웃 완료까지 지켜본다. 이력은 deploy-service 메모리에만 있다(dev).
 */
const BASE = '/deploy-service/api-system/deploy'

export type ServiceStatus = 'READY' | 'PROGRESSING' | 'DEGRADED'
export type DeploymentStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED'
export type StepName = 'COMMIT' | 'SYNC' | 'ROLLOUT'
export type StepStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'

export interface LastDeployment {
  id: string
  tag: string
  /** 배포한 직원. 서버가 이름·이메일로 풀어 주기 전까지는 Google sub(숫자)가 올 수 있다. */
  by: string
  /** Google sub. 서버가 by 를 이름으로 풀어 주면 함께 온다. */
  byId?: string | null
  finishedAt: string | null
  status: DeploymentStatus
}

export interface DeployService {
  /** k8s Deployment 이름(네임스페이스 modu). */
  name: string
  repo: string
  image: string
  /** modu_infra kustomization.yaml 에 적힌 태그. 고정 안 됐으면 "develop". */
  gitTag: string
  /** 실제 떠 있는 파드 템플릿의 이미지 태그. */
  runningTag: string
  readyReplicas: number
  desiredReplicas: number
  updatedReplicas: number
  status: ServiceStatus
  lastDeployment: LastDeployment | null
}

export interface DeployServicesResponse {
  services: DeployService[]
  argocd: { application: string; url: string }
}

export interface ImageTag {
  tag: string
  sha: string
  createdAt: string
  /** GitHub 조회가 실패하면 빠진다(태그 목록 자체는 온다). */
  commitMessage?: string
  commitUrl?: string
  /** gitTag 와 같은 태그. */
  current: boolean
}

export interface DeploymentStep {
  name: StepName
  status: StepStatus
  message?: string
  startedAt?: string
  finishedAt?: string
}

export interface RolloutPod {
  name: string
  phase: string
  ready: boolean
  reason: string
}

export interface Rollout {
  desired: number
  updated: number
  ready: number
  available: number
  pods: RolloutPod[]
}

/** POST 응답(202)은 steps·rollout 없이 오고, GET /deployments/{id} 는 전부 채워서 준다. */
export interface Deployment {
  id: string
  service: string
  tag: string
  previousTag?: string | null
  by: string
  byId?: string | null
  startedAt: string
  finishedAt?: string | null
  status: DeploymentStatus
  step: StepName | 'DONE'
  percent: number
  steps?: DeploymentStep[]
  rollout?: Rollout | null
  commit?: { sha: string; url: string } | null
  error?: string | null
}

export const getDeployServices = () => api<DeployServicesResponse>(`${BASE}/services`)

export const getServiceTags = (name: string) => api<{ tags: ImageTag[] }>(`${BASE}/services/${encodeURIComponent(name)}/tags`)

export const deployService = (name: string, tag: string) =>
  api<Deployment>(`${BASE}/services/${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify({ tag }) })

/** 마지막으로 성공한 배포의 previousTag 로 되돌린다(없으면 409). */
export const rollbackService = (name: string) => api<Deployment>(`${BASE}/services/${encodeURIComponent(name)}/rollback`, { method: 'POST' })

export const getDeployment = (id: string) => api<Deployment>(`${BASE}/deployments/${encodeURIComponent(id)}`)

export async function listDeployments(service?: string, limit = 20): Promise<Deployment[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (service) params.set('service', service)
  const res = await api<{ deployments: Deployment[] }>(`${BASE}/deployments?${params}`)
  return res.deployments
}

export const STEP_NAMES: StepName[] = ['COMMIT', 'SYNC', 'ROLLOUT']

export const STEP_LABELS: Record<StepName, string> = { COMMIT: '커밋', SYNC: 'Argo 동기화', ROLLOUT: '롤아웃' }

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = { READY: '정상', PROGRESSING: '진행 중', DEGRADED: '이상' }

export const DEPLOYMENT_STATUS_LABELS: Record<DeploymentStatus, string> = { RUNNING: '진행 중', SUCCEEDED: '성공', FAILED: '실패' }

/** 검색어가 서비스 이름·저장소·실행 중 태그·Git 태그 중 하나에 들어 있는지(대소문자 무시). */
export function matchesService(s: DeployService, keyword: string): boolean {
  const k = keyword.trim().toLowerCase()
  if (!k) return true
  return [s.name, s.repo, s.runningTag, s.gitTag].some((v) => v.toLowerCase().includes(k))
}

/**
 * 배포자 표시용 짧은 이름. 이메일은 @ 앞까지, 아직 풀리지 않은 Google sub(긴 숫자)는 앞 8자리만. 전체 값은 title 로 남긴다.
 */
export function shortBy(by: string): string {
  const v = by.trim()
  if (!v) return '-'
  const at = v.indexOf('@')
  if (at > 0) return v.slice(0, at)
  if (/^\d{12,}$/.test(v)) return `${v.slice(0, 8)}…`
  return v
}

/** 배포 한 건의 이력 화면 주소. 그 행을 펼친 채로 연다(결과 배너의 "이력에서 보기"). */
export const historyEntryPath = (d: Pick<Deployment, 'id' | 'service'>) =>
  `/deploy/history?service=${encodeURIComponent(d.service)}&open=${encodeURIComponent(d.id)}`

/** 배포가 끝났는지(더 폴링하지 않는다). */
export const isFinished = (d: Deployment) => d.status === 'SUCCEEDED' || d.status === 'FAILED'

/** 끝난 배포의 소요 시간(초). 아직 진행 중이거나 시각을 못 읽으면 null. */
export function durationSeconds(d: Pick<Deployment, 'startedAt' | 'finishedAt'>): number | null {
  if (!d.finishedAt) return null
  const start = Date.parse(d.startedAt)
  const end = Date.parse(d.finishedAt)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.max(0, Math.round((end - start) / 1000))
}

/** 소요 시간 문구. 진행 중이면 '-'. */
export function durationLabel(d: Pick<Deployment, 'startedAt' | 'finishedAt'>): string {
  const sec = durationSeconds(d)
  return sec === null ? '-' : `${sec}초`
}

/**
 * POST 응답에는 steps 가 없다. 단계 상태를 step·status 에서 만들어 내서 GET 응답과 같은 모양으로 맞춘다.
 * 서버가 steps 를 주면 그것을 그대로 쓴다.
 */
export function stepStates(d: Deployment): DeploymentStep[] {
  if (d.steps && d.steps.length > 0) return STEP_NAMES.map((name) => d.steps!.find((s) => s.name === name) ?? { name, status: 'PENDING' })
  const index = d.step === 'DONE' ? STEP_NAMES.length : STEP_NAMES.indexOf(d.step)
  return STEP_NAMES.map((name, i) => {
    if (i < index) return { name, status: 'SUCCEEDED' }
    if (i > index) return { name, status: 'PENDING' }
    return { name, status: d.status === 'FAILED' ? 'FAILED' : d.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'RUNNING' }
  })
}
