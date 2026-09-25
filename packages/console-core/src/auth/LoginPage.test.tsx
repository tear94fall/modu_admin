import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setOnUnauthorized } from '../api/client'
import type { GoogleAccountsId } from './google'
import LoginPage, { LOGIN_FAILED_MESSAGE, NOT_STAFF_MESSAGE } from './LoginPage'
import { getRefreshToken, getToken } from './token'

/** GIS 대신: initialize 의 callback 을 잡아 두고, 테스트가 credential 을 넘겨 "로그인"한다. */
function stubGoogle() {
  let callback: ((r: { credential: string }) => void) | null = null
  const id: GoogleAccountsId = {
    initialize: vi.fn((config) => {
      callback = config.callback
    }),
    renderButton: vi.fn((parent: HTMLElement) => {
      parent.innerHTML = '<span>Google 계정으로 로그인</span>'
    }),
  }
  window.google = { accounts: { id } }
  return { id, signIn: (credential: string) => act(async () => callback?.({ credential })) }
}

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage title="모두 시스템 로그인" home="/home" />} />
        <Route path="/home" element={<p>홈 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear()
    setOnUnauthorized(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete window.google
  })

  it('renders the Google button with the web client id and popup mode', async () => {
    const google = stubGoogle()
    renderLogin()
    expect(screen.getByRole('heading', { name: '모두 시스템 로그인' })).toBeInTheDocument()
    expect(await screen.findByText('Google 계정으로 로그인')).toBeInTheDocument()
    expect(google.id.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: expect.stringContaining('.apps.googleusercontent.com'), ux_mode: 'popup' }))
    expect(screen.queryByLabelText('비밀번호')).not.toBeInTheDocument()
  })

  it('stores both tokens and goes home after the credential is exchanged', async () => {
    const google = stubGoogle()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"access_token":"at","refresh_token":"rt"}', { status: 200 }))
    renderLogin()
    await screen.findByText('Google 계정으로 로그인')

    await google.signIn('cred')
    expect(await screen.findByText('홈 화면')).toBeInTheDocument()
    expect(new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body)).get('id_token')).toBe('cred')
    expect(getToken()).toBe('at')
    expect(getRefreshToken()).toBe('rt')
  })

  it('tells a non-staff Google account to ask for registration', async () => {
    const google = stubGoogle()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }))
    renderLogin()
    await screen.findByText('Google 계정으로 로그인')

    await google.signIn('cred')
    expect(await screen.findByRole('alert')).toHaveTextContent(NOT_STAFF_MESSAGE)
    expect(getToken()).toBeNull()
  })

  it('shows a generic error for other failures', async () => {
    const google = stubGoogle()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('oops', { status: 500 }))
    renderLogin()
    await screen.findByText('Google 계정으로 로그인')

    await google.signIn('cred')
    expect(await screen.findByRole('alert')).toHaveTextContent(LOGIN_FAILED_MESSAGE)
  })
})
