import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDisplayTimeZone } from '@modu/console-core'
import * as gateway from '../api/gateway'
import GatewayRoutesPage from './GatewayRoutesPage'

const config: gateway.GatewayConfig = {
  routes: [
    {
      id: 'auth-service-oauth2',
      uri: 'lb://AUTH-SERVICE',
      order: 0,
      predicates: [{ name: 'Path', args: ['/auth-service/oauth2/token', '/auth-service/oauth2/jwks'] }],
      filters: [{ name: 'RewritePath', args: ['/auth-service/(?<segment>.*)', '/${segment}'] }],
      access: { type: 'PUBLIC', role: null, audience: null },
    },
    {
      id: 'member-service-public',
      uri: 'lb://MEMBER-SERVICE',
      order: 0,
      predicates: [{ name: 'Path', args: ['/member-service/api-public/**'] }, { name: 'Method', args: ['GET', 'POST'] }],
      filters: [{ name: 'AuthorizationHeaderFilter', args: ['ROLE_USER', 'modu-chat'] }],
      access: { type: 'PROTECTED', role: 'ROLE_USER', audience: 'modu-chat' },
    },
    {
      id: 'point-service-admin',
      uri: 'lb://POINT-SERVICE',
      order: 0,
      predicates: [{ name: 'Path', args: ['/point-service/api-admin/**'] }],
      filters: [{ name: 'AuthorizationHeaderFilter', args: ['ROLE_ADMIN', 'modu-admin'] }, { name: 'AddRequestHeader', args: ['X-Internal-Token', '***'] }],
      access: { type: 'PROTECTED', role: 'ROLE_ADMIN', audience: 'modu-admin' },
    },
  ],
  defaultFilters: [{ name: 'RemoveRequestHeader', args: ['X-Internal-Token'] }],
  cors: [{ pattern: '/**', allowedOrigins: ['http://localhost:5173'], allowedMethods: ['GET', 'POST'], allowedHeaders: ['*'], allowCredentials: true }],
  generatedAt: '2026-09-25T01:00:00Z',
}

describe('GatewayRoutesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setDisplayTimeZone('UTC')
  })
  afterEach(() => setDisplayTimeZone(null))

  it('lists routes with paths, access and target, plus default filters and CORS', async () => {
    vi.spyOn(gateway, 'getGatewayConfig').mockResolvedValue(config)
    render(<GatewayRoutesPage />)

    expect(await screen.findByText('auth-service-oauth2')).toBeInTheDocument()
    expect(screen.getByText('/auth-service/oauth2/jwks')).toBeInTheDocument()
    expect(screen.getByText('공개', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('ROLE_USER · modu-chat')).toBeInTheDocument()
    expect(screen.getByText('ROLE_ADMIN · modu-admin')).toBeInTheDocument()
    expect(screen.getByText('GET, POST', { selector: 'div' })).toBeInTheDocument()
    expect(screen.getByText('RemoveRequestHeader=X-Internal-Token')).toBeInTheDocument()
    expect(screen.getByText('http://localhost:5173')).toBeInTheDocument()
    expect(screen.getByText(/기준 시각 2026-09-25 01:00 · 라우트 3개\(공개 1, 관리자 1\)/)).toBeInTheDocument()
  })

  it('filters by access type and keyword, and expands a row to show every predicate and filter', async () => {
    vi.spyOn(gateway, 'getGatewayConfig').mockResolvedValue(config)
    render(<GatewayRoutesPage />)
    await screen.findByText('auth-service-oauth2')

    await userEvent.click(screen.getByRole('radio', { name: '관리자 토큰' }))
    expect(screen.queryByText('auth-service-oauth2')).not.toBeInTheDocument()
    expect(screen.getByText('point-service-admin')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: '전체' }))
    await userEvent.type(screen.getByRole('searchbox', { name: '라우트 검색' }), 'member')
    expect(screen.getByText('member-service-public')).toBeInTheDocument()
    expect(screen.queryByText('point-service-admin')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('member-service-public'))
    const detail = screen.getByText('lb://MEMBER-SERVICE').closest('dl') as HTMLElement
    expect(within(detail).getByText('Method=GET, POST')).toBeInTheDocument()
    expect(within(detail).getByText('AuthorizationHeaderFilter=ROLE_USER, modu-chat')).toBeInTheDocument()
  })

  it('shows an error when the gateway refuses', async () => {
    vi.spyOn(gateway, 'getGatewayConfig').mockRejectedValue(new Error('401'))
    render(<GatewayRoutesPage />)
    expect(await screen.findByText('게이트웨이 설정을 불러오지 못했습니다')).toBeInTheDocument()
  })
})
