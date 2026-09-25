import { getToken } from './token'

/**
 * 액세스 토큰의 roles(직원 권한). 최상위(SUPER)는 ROLE_SUPER·ROLE_ADMIN·ROLE_SYSTEM·ROLE_INTERNAL 을 모두 가진다.
 * 이 콘솔은 ROLE_ADMIN 이 있어야 쓴다(RequireAuth). 직원 지정·권한 변경은 모두 인터널에서 최상위가 한다.
 */

/** JWT 의 payload(base64url JSON). 서명 검증은 게이트웨이가 하고, 콘솔은 화면을 가리는 데만 쓴다. 깨졌으면 null. */
export function tokenClaims(token: string | null = getToken()): Record<string, unknown> | null {
  if (!token) return null
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return claims && typeof claims === 'object' && !Array.isArray(claims) ? (claims as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** 저장된 액세스 토큰의 roles. 토큰이 없거나 깨졌으면 빈 배열. */
export function tokenRoles(token: string | null = getToken()): string[] {
  const roles = tokenClaims(token)?.roles
  if (Array.isArray(roles)) return roles.filter((r): r is string => typeof r === 'string')
  if (typeof roles === 'string') return [roles]
  return []
}

export const hasRole = (role: string, token: string | null = getToken()) => tokenRoles(token).includes(role)

/** 화면에 보일 계정 이름. 토큰에 email 이 있으면 그것, 없으면 sub. */
export function tokenAccount(token: string | null = getToken()): string | null {
  const claims = tokenClaims(token)
  if (!claims) return null
  for (const key of ['email', 'name', 'sub']) {
    const v = claims[key]
    if (typeof v === 'string' && v) return v
  }
  return null
}
