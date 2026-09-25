import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setOnUnauthorized } from '../api/client'
import { fakeJwt } from '../test/jwt'
import RequireAuth from './RequireAuth'
import { getToken, setRefreshToken, setToken } from './token'

const renderGuarded = (role?: string) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<p>로그인 화면</p>} />
        <Route
          path="/"
          element={
            <RequireAuth role={role}>
              <p>콘솔 본문</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

describe('RequireAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    setOnUnauthorized(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('sends a visitor without a token to the login page', () => {
    renderGuarded('ROLE_SYSTEM')
    expect(screen.getByText('로그인 화면')).toBeInTheDocument()
  })

  it('lets a staff member with the console role in', () => {
    setToken(fakeJwt({ sub: 'u1', roles: ['ROLE_SYSTEM'] }))
    renderGuarded('ROLE_SYSTEM')
    expect(screen.getByText('콘솔 본문')).toBeInTheDocument()
  })

  it('without a role prop only checks that someone is logged in', () => {
    setToken('not-a-jwt')
    renderGuarded()
    expect(screen.getByText('콘솔 본문')).toBeInTheDocument()
  })

  it('shows the no-permission screen with the account and roles, and logs out from it', async () => {
    setToken(fakeJwt({ sub: 'u1', email: 'staff@modu.local', roles: ['ROLE_INTERNAL'] }))
    setRefreshToken('rt')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
    renderGuarded('ROLE_SYSTEM')

    expect(screen.getByRole('heading', { name: '이 콘솔을 쓸 권한이 없습니다' })).toBeInTheDocument()
    expect(screen.getByText('staff@modu.local')).toBeInTheDocument()
    expect(screen.getByText('ROLE_INTERNAL')).toBeInTheDocument()
    expect(screen.queryByText('콘솔 본문')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    expect(await screen.findByText('로그인 화면')).toBeInTheDocument()
    expect(String(fetchMock.mock.calls[0][0])).toBe('/auth-service/oauth2/revoke')
    expect(getToken()).toBeNull()
  })
})
