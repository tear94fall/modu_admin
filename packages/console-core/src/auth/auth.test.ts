import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, setOnUnauthorized } from '../api/client'
import { isNotStaffError, loginWithGoogle, logout } from './auth'
import { setRefreshToken } from './token'

describe('auth api', () => {
  beforeEach(() => {
    localStorage.clear()
    setOnUnauthorized(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('exchanges the Google ID token with the google_id_token grant for client modu-admin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt', token_type: 'Bearer' }), { status: 200 }))

    await expect(loginWithGoogle('google-id-token')).resolves.toEqual({ accessToken: 'at', refreshToken: 'rt' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/auth-service/oauth2/token')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/x-www-form-urlencoded')
    const body = new URLSearchParams(String(init?.body))
    expect(body.get('grant_type')).toBe('urn:modu:params:oauth:grant-type:google_id_token')
    expect(body.get('client_id')).toBe('modu-admin')
    expect(body.get('id_token')).toBe('google-id-token')
    expect(body.has('password')).toBe(false)
  })

  it('recognizes the not-staff failure (400 invalid_grant) only', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }))
    const err = await loginWithGoogle('x').catch((e: unknown) => e)
    expect(isNotStaffError(err)).toBe(true)
    expect(isNotStaffError(new ApiError(500, 'boom'))).toBe(false)
    expect(isNotStaffError(new ApiError(400, '{"error":"invalid_request"}'))).toBe(false)
    expect(isNotStaffError(new Error('invalid_grant'))).toBe(false)
  })

  it('logout revokes the stored refresh token and does nothing without one', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
    await logout()
    expect(fetchMock).not.toHaveBeenCalled()

    setRefreshToken('rt')
    await logout()
    const body = new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.get('token')).toBe('rt')
    expect(body.get('client_id')).toBe('modu-admin')
  })
})
