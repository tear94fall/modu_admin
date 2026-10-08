import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, setToken, clearToken } from '@modu/console-core'
import { chooseOption } from '@modu/console-core/test/select'
import * as apiDocs from '../api/apiDocs'
import ApiDocsPage, { LAST_SERVICE_KEY } from './ApiDocsPage'

// Swagger UI 자체는 그리지 않고 넘겨받은 속성만 확인한다.
type SwaggerProps = {
  spec: apiDocs.OpenApiSpec
  supportedSubmitMethods?: string[]
  docExpansion?: string
  filter?: boolean
  deepLinking?: boolean
  requestInterceptor: (req: apiDocs.SwaggerRequest) => apiDocs.SwaggerRequest
}
const swagger = vi.hoisted(() => ({ last: null as SwaggerProps | null }))
vi.mock('swagger-ui-react', () => ({
  default: (props: SwaggerProps) => {
    swagger.last = props
    return <div data-testid="swagger">{Object.keys(props.spec.paths ?? {}).join(' ')}</div>
  },
}))

const services: apiDocs.ApiDocService[] = [
  { name: 'chat-store-service', title: 'chat-store-service', routed: false },
  { name: 'member-service', title: 'member-service', routed: true },
  { name: 'point-service', title: 'point-service', routed: true },
]

const op = (tag: string) => ({ tags: [tag], responses: { '200': { description: 'OK' } } })

const memberSpec: apiDocs.OpenApiSpec = {
  openapi: '3.0.1',
  info: { title: 'member-service', version: 'v1' },
  servers: [{ url: '/member-service' }],
  tags: [{ name: 'member-controller' }, { name: 'admin-member-controller' }, { name: 'internal-member-controller' }],
  paths: {
    '/api-public/members/me': { get: op('member-controller'), patch: op('member-controller') },
    '/api/v1/members/{id}': { get: op('member-controller'), parameters: [] },
    '/api-admin/members': { get: op('admin-member-controller') },
    '/api-staff/members': { get: op('admin-member-controller') },
    '/api-internal/members/{id}': { get: op('internal-member-controller') },
    '/oauth2/whatever': { post: op('member-controller') },
  },
}

const pointSpec: apiDocs.OpenApiSpec = {
  openapi: '3.0.1',
  info: { title: 'point-service', version: 'v1' },
  paths: { '/api-admin/points': { get: op('point-admin') } },
}

const chatStoreSpec: apiDocs.OpenApiSpec = {
  openapi: '3.0.1',
  info: { title: 'chat-store-service', version: 'v1' },
  paths: { '/api/v1/messages': { get: op('store') } },
}

const specs: Record<string, apiDocs.OpenApiSpec> = {
  'member-service': memberSpec,
  'point-service': pointSpec,
  'chat-store-service': chatStoreSpec,
}

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.search}</div>
}

const renderPage = (entry = '/api-docs') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ApiDocsPage />
      <LocationProbe />
    </MemoryRouter>,
  )

const chip = (label: string) => screen.getByRole('radio', { name: new RegExp(`^${label}`) })

describe('ApiDocsPage', () => {
  beforeEach(() => {
    swagger.last = null
    localStorage.clear()
    vi.spyOn(apiDocs, 'getApiDocServices').mockResolvedValue(services)
    vi.spyOn(apiDocs, 'getApiDoc').mockImplementation((name) => Promise.resolve(specs[name]))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    clearToken()
  })

  it('loads the service list, opens the first service and switches on select (remembered + in URL)', async () => {
    renderPage()

    await screen.findByTestId('swagger')
    expect(apiDocs.getApiDoc).toHaveBeenCalledWith('chat-store-service')
    expect(screen.getByRole('combobox', { name: '서비스' })).toHaveTextContent('chat-store-service')

    await chooseOption(userEvent, '서비스', 'member-service')

    expect(await screen.findByText(/\/api-admin\/members/)).toBeInTheDocument()
    expect(apiDocs.getApiDoc).toHaveBeenCalledWith('member-service')
    expect(localStorage.getItem(LAST_SERVICE_KEY)).toBe('member-service')
    expect(screen.getByTestId('location')).toHaveTextContent('?service=member-service')
    expect(swagger.last?.docExpansion).toBe('list')
    expect(swagger.last?.filter).toBe(true)
    expect(swagger.last?.deepLinking).toBe(false)
  })

  it('opens the last remembered service when the URL names none', async () => {
    localStorage.setItem(LAST_SERVICE_KEY, 'point-service')
    renderPage()
    expect(await screen.findByText('/api-admin/points')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '서비스' })).toHaveTextContent('point-service')
  })

  it('counts APIs per section and filters paths client-side, following the URL section', async () => {
    renderPage('/api-docs?service=member-service')
    await screen.findByTestId('swagger')

    // 전체 7(어느 구역에도 없는 /oauth2 포함), 앱 3(메서드 기준), 어드민 2, 내부 1
    expect(chip('전체')).toHaveTextContent('전체 7')
    expect(chip('앱')).toHaveTextContent('앱 3')
    expect(chip('어드민')).toHaveTextContent('어드민 2')
    expect(chip('내부')).toHaveTextContent('내부 1')

    await userEvent.click(chip('어드민'))
    expect(Object.keys(swagger.last!.spec.paths!)).toEqual(['/api-admin/members', '/api-staff/members'])
    expect(swagger.last!.spec.tags).toEqual([{ name: 'admin-member-controller' }])
    expect(screen.getByTestId('location')).toHaveTextContent('?service=member-service&section=admin')

    await userEvent.click(chip('앱'))
    expect(Object.keys(swagger.last!.spec.paths!)).toEqual(['/api-public/members/me', '/api/v1/members/{id}'])

    await userEvent.click(chip('전체'))
    expect(Object.keys(swagger.last!.spec.paths!)).toHaveLength(6)
    // Authorize 에 토큰 칸이 보이도록 bearer 스키마를 붙인다(원래 문서는 그대로).
    expect(swagger.last!.spec.components?.securitySchemes).toEqual({ bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } })
    expect(swagger.last!.spec.security).toEqual([{ bearerAuth: [] }])
    expect(memberSpec.components).toBeUndefined()
  })

  it('internal section disables Try it out and shows a note', async () => {
    renderPage('/api-docs?service=member-service&section=internal')
    await screen.findByTestId('swagger')

    expect(chip('내부')).toHaveAttribute('aria-checked', 'true')
    expect(Object.keys(swagger.last!.spec.paths!)).toEqual(['/api-internal/members/{id}'])
    expect(swagger.last!.supportedSubmitMethods).toEqual([])
    expect(screen.getByText('내부 API 는 서비스끼리만 호출돼 여기서 실행할 수 없어요')).toBeInTheDocument()

    await userEvent.click(chip('어드민'))
    expect(swagger.last!.supportedSubmitMethods).toBeUndefined()
    expect(screen.queryByText(/내부 API 는/)).not.toBeInTheDocument()
  })

  it('a service without a gateway route cannot run any API', async () => {
    renderPage('/api-docs?service=chat-store-service')
    await screen.findByTestId('swagger')
    expect(swagger.last!.supportedSubmitMethods).toEqual([])
    expect(screen.getByText('게이트웨이 경로가 없어 여기서는 실행할 수 없어요')).toBeInTheDocument()
  })

  it('shows a document error inline with retry while the rest of the page keeps working', async () => {
    const getApiDoc = vi.mocked(apiDocs.getApiDoc)
    getApiDoc.mockRejectedValueOnce(new ApiError(502, JSON.stringify({ message: 'member-service 문서를 불러오지 못했습니다' })))
    renderPage('/api-docs?service=member-service')

    expect(await screen.findByRole('alert')).toHaveTextContent('member-service 문서를 불러오지 못했습니다')
    expect(screen.getByRole('combobox', { name: '서비스' })).toBeEnabled()
    expect(screen.queryByTestId('swagger')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByTestId('swagger')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getApiDoc).toHaveBeenCalledTimes(2)
  })

  it('shows a list error with retry', async () => {
    vi.mocked(apiDocs.getApiDocServices).mockRejectedValueOnce(new Error('network'))
    renderPage()

    expect(await screen.findByText('서비스 목록을 불러오지 못했습니다')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByTestId('swagger')).toBeInTheDocument()
  })
})

describe('makeRequestInterceptor', () => {
  const intercept = apiDocs.makeRequestInterceptor(() => 'console-token')
  const req = (url: string, headers: Record<string, string> = {}): apiDocs.SwaggerRequest => ({ url, headers })

  it('adds the console token to admin-prefixed paths only', () => {
    expect(intercept(req('http://localhost:8084/member-service/api-admin/members')).headers.Authorization).toBe('Bearer console-token')
    expect(intercept(req('/point-service/api-super/rules')).headers.Authorization).toBe('Bearer console-token')
    expect(intercept(req('/member-service/api-staff/staff')).headers.Authorization).toBe('Bearer console-token')

    expect(intercept(req('/member-service/api-public/members/me')).headers.Authorization).toBeUndefined()
    expect(intercept(req('/member-service/api/v1/members/1')).headers.Authorization).toBeUndefined()
    expect(intercept(req('/member-service/api-internal/members/1')).headers.Authorization).toBeUndefined()
  })

  it('keeps a token the user set via Authorize', () => {
    expect(intercept(req('/member-service/api-admin/members', { Authorization: 'Bearer mine' })).headers.Authorization).toBe('Bearer mine')
    const lower = intercept(req('/member-service/api-admin/members', { authorization: 'Bearer mine' }))
    expect(lower.headers).toEqual({ authorization: 'Bearer mine' })
  })

  it('reads the stored console token at request time and skips when logged out', () => {
    const live = apiDocs.makeRequestInterceptor(() => localStorage.getItem('modu-console-token'))
    expect(live(req('/member-service/api-admin/members')).headers.Authorization).toBeUndefined()
    setToken('fresh')
    expect(live(req('/member-service/api-admin/members')).headers.Authorization).toBe('Bearer fresh')
    clearToken()
  })
})
