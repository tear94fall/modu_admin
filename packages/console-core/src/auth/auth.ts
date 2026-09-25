import { api, ApiError } from '../api/client'
import { getRefreshToken } from './token'

export interface TokenResponse {
  accessToken: string
  refreshToken: string
}

interface OAuthTokenResponse {
  access_token: string
  refresh_token?: string
}

/**
 * 모든 콘솔이 직원 계정으로 Google 로그인한다(auth-service google_id_token 그랜트, client modu-admin → aud=modu-admin).
 * 토큰의 roles 가 직원 권한이다(최상위 ROLE_SUPER 는 ROLE_ADMIN·ROLE_SYSTEM·ROLE_INTERNAL 을 함께 가진다). 콘솔마다 필요한 권한은 RequireAuth 가 본다.
 */
const CLIENT_ID = 'modu-admin'
const GOOGLE_ID_TOKEN_GRANT = 'urn:modu:params:oauth:grant-type:google_id_token'
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' }

/** Google ID 토큰(credential)을 콘솔 토큰으로 바꾼다. 직원이 아니면 400 invalid_grant([isNotStaffError]). */
export const loginWithGoogle = async (idToken: string): Promise<TokenResponse> => {
  const body = new URLSearchParams({ grant_type: GOOGLE_ID_TOKEN_GRANT, client_id: CLIENT_ID, id_token: idToken })
  const res = await api<OAuthTokenResponse>('/auth-service/oauth2/token', { method: 'POST', headers: FORM, body: body.toString() })
  return { accessToken: res.access_token, refreshToken: res.refresh_token ?? '' }
}

/** 로그인 실패가 "직원이 아님(또는 탈퇴)"인지. auth-service 는 이때 400 {"error":"invalid_grant"} 를 준다. */
export const isNotStaffError = (e: unknown): boolean => e instanceof ApiError && e.status === 400 && e.message.includes('invalid_grant')

/** refresh 토큰 폐기. 실패해도 호출부는 로컬 토큰을 지운다. */
export const logout = () => {
  const refresh = getRefreshToken()
  if (!refresh) return Promise.resolve()
  const body = new URLSearchParams({ token: refresh, client_id: CLIENT_ID })
  return api<void>('/auth-service/oauth2/revoke', { method: 'POST', headers: FORM, body: body.toString() })
}
