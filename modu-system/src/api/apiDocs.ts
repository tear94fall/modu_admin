import { api } from '@modu/console-core'

/** 게이트웨이 라우트가 가리키는 서비스 하나(API 문서를 볼 수 있는 대상). */
export interface ApiDocService {
  name: string
  title: string
  /** 게이트웨이 라우트가 있는지. false 면(예: chat-store-service) 게이트웨이로 부를 수 없어 Try it out 을 끈다. */
  routed: boolean
}

/** routed 가 빠진 옛 응답은 라우트가 있는 것으로 본다(목록 자체가 라우트에서 나온다). */
export const isRouted = (s: ApiDocService | undefined) => s?.routed !== false

/** OpenAPI 문서 중 이 화면이 만지는 부분만 적는다. 나머지는 그대로 Swagger UI 에 넘긴다. */
export interface OpenApiSpec {
  openapi?: string
  paths?: Record<string, Record<string, unknown>>
  tags?: { name: string }[]
  components?: { securitySchemes?: Record<string, unknown>; [key: string]: unknown }
  security?: Record<string, string[]>[]
  [key: string]: unknown
}

/** 게이트웨이가 라우트 설정에서 뽑은 서비스 목록. ROLE_SYSTEM + aud=modu-admin 토큰이 있어야 한다. */
export const getApiDocServices = () => api<{ services: ApiDocService[] }>('/gateway-service/api-admin/api-docs').then((r) => r.services)

/** 서비스의 OpenAPI 문서. servers 는 게이트웨이가 `/{name}` 으로 바꿔 내려준다(그대로 Try it out 하면 게이트웨이를 탄다). */
export const getApiDoc = (name: string) => api<OpenApiSpec>(`/gateway-service/api-admin/api-docs/${encodeURIComponent(name)}`)

export type Section = 'all' | 'app' | 'admin' | 'internal'

export const SECTIONS: { value: Section; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'app', label: '앱' },
  { value: 'admin', label: '어드민' },
  { value: 'internal', label: '내부' },
]

export const isSection = (v: string | null): v is Section => SECTIONS.some((s) => s.value === v)

/** 경로 prefix 로 나눈다. 어느 것에도 맞지 않는 경로(예: /oauth2/token)는 '전체'에만 보인다. */
const SECTION_PREFIXES: Record<Exclude<Section, 'all'>, string[]> = {
  app: ['/api-public/', '/api/v1/', '/api/'],
  admin: ['/api-admin/', '/api-super/', '/api-staff/'],
  internal: ['/api-internal/'],
}

export function sectionOf(path: string): Exclude<Section, 'all'> | null {
  for (const [section, prefixes] of Object.entries(SECTION_PREFIXES)) {
    if (prefixes.some((p) => path.startsWith(p))) return section as Exclude<Section, 'all'>
  }
  return null
}

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'])

/** 경로 하나에 달린 API(메서드) 수. parameters 같은 공통 항목은 세지 않는다. */
const operationCount = (item: Record<string, unknown>) => Object.keys(item).filter((k) => HTTP_METHODS.has(k)).length

/** 칩마다 보여 줄 API 수. */
export function sectionCounts(spec: OpenApiSpec): Record<Section, number> {
  const counts: Record<Section, number> = { all: 0, app: 0, admin: 0, internal: 0 }
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    const n = operationCount(item)
    counts.all += n
    const s = sectionOf(path)
    if (s) counts[s] += n
  }
  return counts
}

export const BEARER_SCHEME = 'bearerAuth'

/**
 * 고른 구역의 경로만 남기고, Authorize 버튼이 토큰 칸을 보이도록 bearer 보안 스키마를 붙인다.
 * 원래 문서는 바꾸지 않는다. 남은 경로가 쓰지 않는 태그는 빼서 빈 묶음이 보이지 않게 한다.
 */
export function prepareSpec(spec: OpenApiSpec, section: Section): OpenApiSpec {
  const paths = Object.fromEntries(Object.entries(spec.paths ?? {}).filter(([path]) => section === 'all' || sectionOf(path) === section))

  const usedTags = new Set<string>()
  for (const item of Object.values(paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method) || !op || typeof op !== 'object') continue
      const tags = (op as { tags?: unknown }).tags
      if (Array.isArray(tags)) for (const t of tags) if (typeof t === 'string') usedTags.add(t)
    }
  }

  const schemes = spec.components?.securitySchemes ?? {}
  // 서비스가 이미 bearer 스키마를 선언했으면 그 이름을 쓴다.
  const existing = Object.entries(schemes).find(([, s]) => {
    const scheme = s as { type?: string; scheme?: string } | null
    return scheme?.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer'
  })?.[0]
  const bearerName = existing ?? BEARER_SCHEME

  return {
    ...spec,
    paths,
    ...(spec.tags ? { tags: spec.tags.filter((t) => usedTags.has(t.name)) } : {}),
    components: {
      ...spec.components,
      securitySchemes: existing ? schemes : { ...schemes, [BEARER_SCHEME]: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    // 문서에 보안 요구가 없으면 모든 API 에 bearer 를 건다. 그래야 Authorize 에 넣은 토큰이 요청에 붙는다.
    security: spec.security && spec.security.length > 0 ? spec.security : [{ [bearerName]: [] }],
  }
}

/** Swagger UI 요청 객체 중 여기서 쓰는 부분. */
export interface SwaggerRequest {
  url: string
  headers: Record<string, string>
  [key: string]: unknown
}

const ADMIN_PATH = /^\/[^/]+\/(api-admin|api-super|api-staff)\//

/**
 * Try it out 요청에 콘솔(직원) 토큰을 붙인다. 어드민 경로(`/{서비스}/api-admin/...` 등)만이고,
 * Authorize 로 사용자가 이미 Authorization 을 넣었으면 그대로 둔다. 앱·내부 API 에는 직원 토큰을 보내지 않는다.
 */
export function makeRequestInterceptor(getToken: () => string | null) {
  return (req: SwaggerRequest): SwaggerRequest => {
    let pathname: string
    try {
      pathname = new URL(req.url, window.location.origin).pathname
    } catch {
      return req
    }
    if (!ADMIN_PATH.test(pathname)) return req
    const headers = req.headers ?? {}
    if (Object.keys(headers).some((k) => k.toLowerCase() === 'authorization' && headers[k])) return req
    const token = getToken()
    if (!token) return req
    req.headers = { ...headers, Authorization: `Bearer ${token}` }
    return req
  }
}
