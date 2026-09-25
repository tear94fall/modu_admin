import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, apiErrorMessage, setOnUnauthorized } from './client'
import { getToken, setToken } from '../auth/token'

describe('api', () => {
  const unauthorized = vi.fn()
  beforeEach(() => {
    localStorage.clear()
    setOnUnauthorized(unauthorized)
  })
  afterEach(() => vi.restoreAllMocks())

  it('sends the bearer token to a relative gateway path and parses JSON', async () => {
    setToken('tok')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    await expect(api<{ ok: boolean }>('/member-service/api-admin/member')).resolves.toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/member-service/api-admin/member')
    expect(new Headers((init as RequestInit).headers).get('Authorization')).toBe('Bearer tok')
  })

  it('clears the token and calls onUnauthorized on 401', async () => {
    setToken('tok')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 401 }))
    await expect(api('/x')).rejects.toBeInstanceOf(ApiError)
    expect(getToken()).toBeNull()
    expect(unauthorized).toHaveBeenCalled()
  })
})

describe('apiErrorMessage', () => {
  it('uses the Spring error body message when there is one', () => {
    expect(apiErrorMessage(new ApiError(409, '{"status":409,"error":"Conflict","message":"자기 자신의 직원 권한은 바꿀 수 없습니다","path":"/x"}'), '실패')).toBe(
      '자기 자신의 직원 권한은 바꿀 수 없습니다',
    )
    expect(apiErrorMessage(new ApiError(500, 'not json'), '실패')).toBe('실패')
    expect(apiErrorMessage(new ApiError(400, '{"message":""}'), '실패')).toBe('실패')
    expect(apiErrorMessage(new Error('x'), '실패')).toBe('실패')
  })
})
