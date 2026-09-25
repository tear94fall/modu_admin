import { api, ApiError } from './client'
import { getRefreshToken } from '../auth/token'

export interface TokenResponse { accessToken: string; refreshToken: string }

/** auth-service OAuth2 토큰 엔드포인트 응답(스네이크 케이스) */
interface OAuthTokenResponse { access_token: string; refresh_token?: string }

const CLIENT_ID = 'modu-admin'
const GOOGLE_ID_TOKEN_GRANT = 'urn:modu:params:oauth:grant-type:google_id_token'
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' }

/**
 * 직원 Google 로그인. Google ID 토큰(credential)을 auth-service 의 표준 /oauth2/token 으로 바꾼다(aud=modu-admin).
 * 토큰의 roles 가 직원 권한이고, 이 콘솔은 ROLE_ADMIN 이 있어야 쓴다. 직원이 아니면 400 invalid_grant([isNotStaffError]).
 */
export const loginWithGoogle = async (idToken: string): Promise<TokenResponse> => {
  const body = new URLSearchParams({ grant_type: GOOGLE_ID_TOKEN_GRANT, client_id: CLIENT_ID, id_token: idToken })
  const res = await api<OAuthTokenResponse>('/auth-service/oauth2/token', { method: 'POST', headers: FORM, body: body.toString() })
  return { accessToken: res.access_token, refreshToken: res.refresh_token ?? '' }
}

/** 로그인 실패가 "직원이 아님(또는 탈퇴)"인지. auth-service 는 이때 400 {"error":"invalid_grant"} 를 준다. */
export const isNotStaffError = (e: unknown): boolean => e instanceof ApiError && e.status === 400 && e.message.includes('invalid_grant')

/** refresh 토큰을 폐기한다. 이미 없거나 실패해도 호출부는 무시하고 로컬 토큰을 지운다. */
export const logout = () => {
  const refresh = getRefreshToken()
  if (!refresh) return Promise.resolve()
  const body = new URLSearchParams({ token: refresh, client_id: CLIENT_ID })
  return api<void>('/auth-service/oauth2/revoke', { method: 'POST', headers: FORM, body: body.toString() })
}
