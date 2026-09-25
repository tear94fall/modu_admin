import { api } from '../api/client'
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
 * 지금은 모든 콘솔이 관리자 계정으로 로그인한다(auth-service admin_password 그랜트, client modu-admin → aud=modu-admin, ROLE_ADMIN).
 * 게이트웨이의 api-admin 라우트가 이 토큰을 받는다. 콘솔별 권한(직원 등)이 생기면 여기서 나눈다.
 */
const CLIENT_ID = 'modu-admin'
const ADMIN_PASSWORD_GRANT = 'urn:modu:params:oauth:grant-type:admin_password'
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' }

export const login = async (email: string, password: string): Promise<TokenResponse> => {
  const body = new URLSearchParams({ grant_type: ADMIN_PASSWORD_GRANT, client_id: CLIENT_ID, email, password })
  const res = await api<OAuthTokenResponse>('/auth-service/oauth2/token', { method: 'POST', headers: FORM, body: body.toString() })
  return { accessToken: res.access_token, refreshToken: res.refresh_token ?? '' }
}

/** refresh 토큰 폐기. 실패해도 호출부는 로컬 토큰을 지운다. */
export const logout = () => {
  const refresh = getRefreshToken()
  if (!refresh) return Promise.resolve()
  const body = new URLSearchParams({ token: refresh, client_id: CLIENT_ID })
  return api<void>('/auth-service/oauth2/revoke', { method: 'POST', headers: FORM, body: body.toString() })
}
