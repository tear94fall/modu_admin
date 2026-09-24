import { api } from '@modu/console-core'

/** 게이트웨이 라우트 조건·필터 한 개. args 는 yml 에 적힌 값 그대로(짧은 형식은 값만, 이름 있는 인자는 `key=value`). */
export interface GatewayArgs {
  name: string
  args: string[]
}

export type AccessType = 'PUBLIC' | 'PROTECTED'

export interface GatewayRoute {
  id: string
  uri: string
  order: number
  predicates: GatewayArgs[]
  filters: GatewayArgs[]
  /** AuthorizationHeaderFilter 에서 뽑은 인증 조건. 없으면 PUBLIC. */
  access: { type: AccessType; role: string | null; audience: string | null }
}

export interface GatewayCors {
  pattern: string
  allowedOrigins: string[]
  allowedMethods: string[]
  allowedHeaders: string[]
  allowCredentials: boolean | null
}

export interface GatewayConfig {
  routes: GatewayRoute[]
  defaultFilters: GatewayArgs[]
  cors: GatewayCors[]
  generatedAt: string
}

/** 게이트웨이 자신이 내려주는 설정(읽기 전용). ROLE_ADMIN + aud=modu-admin 토큰이 있어야 한다. */
export const getGatewayConfig = () => api<GatewayConfig>('/gateway-service/api-admin/config')

/** 라우트가 받는 경로들(Path 조건의 값). */
export const routePaths = (r: GatewayRoute) => r.predicates.filter((p) => p.name === 'Path').flatMap((p) => p.args)

/** 라우트의 HTTP 메서드 제한(Method 조건). 없으면 빈 배열 = 모든 메서드. */
export const routeMethods = (r: GatewayRoute) => r.predicates.filter((p) => p.name === 'Method').flatMap((p) => p.args)

/** 인증 조건 한 줄: '공개' 또는 'ROLE_ADMIN · modu-admin'. */
export function accessLabel(r: GatewayRoute): string {
  if (r.access.type === 'PUBLIC') return '공개'
  return [r.access.role ?? 'ROLE_USER', r.access.audience ?? '모든 앱'].join(' · ')
}

/** 대상 서비스 이름(lb://MEMBER-SERVICE → MEMBER-SERVICE). */
export const targetOf = (r: GatewayRoute) => r.uri.replace(/^lb:\/\//, '')

/** 인증 필터를 뺀 나머지 필터(표에는 인증을 따로 보여 준다). */
export const otherFilters = (r: GatewayRoute) => r.filters.filter((f) => f.name !== 'AuthorizationHeaderFilter')

export const formatArgs = (a: GatewayArgs) => (a.args.length === 0 ? a.name : `${a.name}=${a.args.join(', ')}`)
