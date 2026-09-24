import { clearToken, getToken } from '../auth/token'

/**
 * 게이트웨이 주소. 콘솔은 같은 출처로만 부른다(개발은 Vite proxy, 배포는 nginx 가 게이트웨이로 넘긴다).
 * 그래서 기본값이 빈 문자열(상대 경로)이고, 게이트웨이 CORS 설정이 필요 없다.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/** 목록 한 페이지 크기. 콘솔 전체가 같은 값을 쓴다. */
export const PAGE_SIZE = 15

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** 401 을 받았을 때. 테스트에서 바꿔 location.assign 을 피한다. */
export let onUnauthorized = () => {
  if (!location.pathname.startsWith('/login')) location.assign('/login')
}

export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn
}

/** 게이트웨이 호출. 401 이면 토큰을 지우고 로그인으로 보낸다. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (res.status === 401) {
    clearToken()
    onUnauthorized()
    throw new ApiError(401, 'unauthorized')
  }
  if (!res.ok) throw new ApiError(res.status, await res.text())
  const text = await res.text()
  if (res.status === 204 || text.length === 0) return undefined as T
  return JSON.parse(text) as T
}

/** Spring Data Page 응답 중 콘솔이 쓰는 부분. */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
