import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDisplayTimeZone } from '@modu/console-core'
import * as deploy from '../api/deploy'
import { NARROW_QUERY } from '../hooks/useMediaQuery'
import DeployPage from './DeployPage'

/** jsdom 에는 matchMedia 가 없다. 좁은 폭 테스트에서만 1100px 쿼리가 맞는 것으로 둔다. */
function mockNarrow() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: query === NARROW_QUERY, media: query, addEventListener: () => {}, removeEventListener: () => {} }),
  })
}

/** 상세 화면 자리. 배포 버튼이 태그 고르기를 열라고(state.pick) 넘겼는지 보여 준다. */
function DetailProbe() {
  const { name } = useParams()
  const state = useLocation().state as { pick?: boolean } | null
  return <p>{`상세 화면 ${name}${state?.pick ? ' · 태그 고르기' : ''}`}</p>
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/deploy']}>
      <Routes>
        <Route path="/deploy" element={<DeployPage />} />
        <Route path="/deploy/:name" element={<DetailProbe />} />
      </Routes>
    </MemoryRouter>,
  )

const services: deploy.DeployServicesResponse = {
  services: [
    {
      name: 'point-service',
      repo: 'modu_chat',
      image: 'ghcr.io/tear94fall/modu-chat/point-service',
      gitTag: 'develop-5708871',
      runningTag: 'develop-5708871',
      readyReplicas: 1,
      desiredReplicas: 1,
      updatedReplicas: 1,
      status: 'READY',
      lastDeployment: { id: 'dep-1', tag: 'develop-5708871', by: 'joonsub2990@gmail.com', finishedAt: '2026-10-06T04:00:00Z', status: 'SUCCEEDED' },
    },
    {
      name: 'chat-service',
      repo: 'modu_chat',
      image: 'ghcr.io/tear94fall/modu-chat/chat-service',
      gitTag: 'develop-9378b00',
      runningTag: 'develop-35db83f',
      readyReplicas: 0,
      desiredReplicas: 2,
      updatedReplicas: 1,
      status: 'PROGRESSING',
      lastDeployment: null,
    },
  ],
  argocd: { application: 'modu-dev', url: 'http://localhost:8090/applications/modu-dev' },
}

const tags: deploy.ImageTag[] = [
  { tag: 'develop-5708871', sha: '5708871', createdAt: '2026-10-06T03:45:00Z', commitMessage: 'Merge pull request #423', commitUrl: 'https://github.com/x/1', current: true },
  { tag: 'develop-9378b00', sha: '9378b00', createdAt: '2026-10-05T03:45:00Z', commitMessage: 'Merge pull request #422', commitUrl: 'https://github.com/x/2', current: false },
]

const started: deploy.Deployment = {
  id: 'dep-2',
  service: 'point-service',
  tag: 'develop-9378b00',
  by: 'joonsub2990@gmail.com',
  startedAt: '2026-10-06T05:00:00Z',
  status: 'RUNNING',
  step: 'COMMIT',
  percent: 5,
}

const running: deploy.Deployment = {
  ...started,
  previousTag: 'develop-5708871',
  status: 'RUNNING',
  step: 'ROLLOUT',
  percent: 75,
  steps: [
    { name: 'COMMIT', status: 'SUCCEEDED', message: '커밋 abc1234' },
    { name: 'SYNC', status: 'SUCCEEDED', message: 'Synced' },
    { name: 'ROLLOUT', status: 'RUNNING' },
  ],
  rollout: { desired: 2, updated: 2, ready: 1, available: 1, pods: [{ name: 'point-service-abc-xyz', phase: 'Running', ready: false, reason: '' }] },
  commit: { sha: 'abc1234def', url: 'https://github.com/x/c' },
  error: null,
}

const succeeded: deploy.Deployment = {
  ...running,
  finishedAt: '2026-10-06T05:00:42Z',
  status: 'SUCCEEDED',
  step: 'DONE',
  percent: 100,
  steps: running.steps!.map((s) => ({ ...s, status: 'SUCCEEDED' })),
  rollout: { ...running.rollout!, ready: 2, available: 2, pods: [{ name: 'point-service-abc-xyz', phase: 'Running', ready: true, reason: '' }] },
}

const history: deploy.Deployment[] = [
  { ...succeeded, id: 'dep-1', tag: 'develop-5708871', startedAt: '2026-10-06T03:59:30Z', finishedAt: '2026-10-06T04:00:00Z' },
]

describe('DeployPage', () => {
  beforeEach(() => {
    setDisplayTimeZone('UTC')
    vi.spyOn(deploy, 'getDeployServices').mockResolvedValue(services)
    vi.spyOn(deploy, 'listDeployments').mockResolvedValue(history)
    vi.spyOn(deploy, 'getServiceTags').mockResolvedValue({ tags })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    setDisplayTimeZone(null)
    // @ts-expect-error jsdom 기본 상태(matchMedia 없음)로 되돌린다.
    delete window.matchMedia
    sessionStorage.clear()
  })

  it('lists services with tags, readiness, last deployment and history', async () => {
    renderPage()

    const row = (await screen.findByRole('button', { name: 'point-service 배포' })).closest('tr')!
    expect(within(row).getByText('modu_chat')).toBeInTheDocument()
    expect(within(row).getByText('정상')).toBeInTheDocument()
    expect(within(row).getByText('1/1')).toBeInTheDocument()
    expect(within(row).getByText(/· 2026-10-06 04:00/)).toBeInTheDocument()
    expect(within(row).getByTitle('joonsub2990@gmail.com')).toHaveTextContent('joonsub2990')
    // 롤백은 실수로 누르기 쉬워 표에서 뺐다(상세 화면에서 확인을 거쳐서만).
    expect(within(row).queryByRole('button', { name: 'point-service 롤백' })).not.toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'point-service 상세' })).toHaveAttribute('href', '/deploy/point-service')

    const chatRow = screen.getByRole('button', { name: 'chat-service 배포' }).closest('tr')!
    expect(within(chatRow).getByText('develop-9378b00')).toHaveClass('deploy-tag--diff')
    expect(within(chatRow).getByText('진행 중')).toBeInTheDocument()
    expect(within(chatRow).getByText('0/2')).toBeInTheDocument()
    expect(within(chatRow).queryByRole('button', { name: 'chat-service 롤백' })).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Argo CD 열기' })).toHaveAttribute('href', 'http://localhost:8090/applications/modu-dev')
    const recent = screen.getByText('최근 배포 5건').closest('section')!
    expect(within(recent).getByText('30초')).toBeInTheDocument()
    expect(within(recent).getByRole('link', { name: '전체 이력 →' })).toHaveAttribute('href', '/deploy/history')
    expect(deploy.listDeployments).toHaveBeenCalledWith(undefined, 5)
    expect(document.querySelector('.mono')).toBeNull()
  })

  it('filters services by name, repo or tag and keeps the keyword across the 15s refresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    await screen.findByRole('button', { name: 'point-service 배포' })
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: '서비스 검색' }), '35DB83F')
    expect(screen.queryByRole('button', { name: 'point-service 배포' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'chat-service 배포' })).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(deploy.getDeployServices).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('searchbox', { name: '서비스 검색' })).toHaveValue('35DB83F')
    expect(screen.queryByRole('button', { name: 'point-service 배포' })).not.toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: '서비스 검색' }))
    await user.type(screen.getByRole('searchbox', { name: '서비스 검색' }), 'nothing')
    expect(screen.getByText('검색에 맞는 서비스가 없습니다')).toBeInTheDocument()
  })

  it('narrow screens keep only service, running tag and readiness, with 상세 leading to the service page', async () => {
    mockNarrow()
    renderPage()
    const row = (await screen.findByRole('button', { name: 'point-service 배포' })).closest('tr')!

    expect(screen.getByRole('columnheader', { name: '실행 중 태그' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Git 태그' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '마지막 배포' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'point-service 롤백' })).not.toBeInTheDocument()
    expect(within(row).getByText('정상')).toBeInTheDocument()

    await userEvent.click(within(row).getByRole('link', { name: 'point-service 상세' }))
    expect(await screen.findByText('상세 화면 point-service')).toBeInTheDocument()
  })

  it('clicking a row on a wide screen opens the service page too', async () => {
    renderPage()
    await userEvent.click(await screen.findByText('chat-service', { selector: 'td' }))
    expect(await screen.findByText('상세 화면 chat-service')).toBeInTheDocument()
  })

  it('배포 in a row goes to the service page with the tag picker open, without deploying anything here', async () => {
    const start = vi.spyOn(deploy, 'deployService')
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'point-service 배포' }))
    expect(await screen.findByText('상세 화면 point-service · 태그 고르기')).toBeInTheDocument()
    expect(start).not.toHaveBeenCalled()
  })

  it('disables 배포 for a service whose deployment is still running, with the reason', async () => {
    vi.spyOn(deploy, 'getDeployServices').mockResolvedValue({
      ...services,
      services: [{ ...services.services[0], lastDeployment: { ...services.services[0].lastDeployment!, finishedAt: null, status: 'RUNNING' } }, services.services[1]],
    })
    renderPage()
    const button = await screen.findByRole('button', { name: 'point-service 배포' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', expect.stringContaining('진행 중'))
    expect(screen.getByRole('button', { name: 'chat-service 배포' })).toBeEnabled()
  })

  it('reopens the progress card on mount for a deployment that is still RUNNING, without clicking 배포', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(deploy, 'listDeployments').mockResolvedValue([{ ...running, id: 'dep-7', service: 'chat-service', tag: 'develop-9378b00' }, ...history])
    const get = vi.spyOn(deploy, 'getDeployment').mockResolvedValue({ ...running, id: 'dep-7', service: 'chat-service' })
    renderPage()

    const progress = await screen.findByRole('group', { name: 'chat-service 배포 진행' })
    expect(within(progress).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75')
    expect(screen.queryByRole('group', { name: 'point-service 배포 진행' })).not.toBeInTheDocument()
    expect(deploy.listDeployments).toHaveBeenCalledWith(undefined, 50)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(get).toHaveBeenCalledWith('dep-7')
  })

  it('reopens a panel remembered in sessionStorage, shows it once when already finished and forgets it', async () => {
    sessionStorage.setItem('modu-deploy-open:point-service', 'dep-2')
    const get = vi.spyOn(deploy, 'getDeployment').mockResolvedValue(succeeded)
    renderPage()

    const progress = await screen.findByRole('group', { name: 'point-service 배포 진행' })
    expect(get).toHaveBeenCalledWith('dep-2')
    expect(within(progress).getByText(/완료 · 소요 42초/)).toBeInTheDocument()
    expect(sessionStorage.getItem('modu-deploy-open:point-service')).toBeNull()

    await userEvent.click(within(progress).getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('group', { name: 'point-service 배포 진행' })).not.toBeInTheDocument()
  })

  it('shows an error when deploy-service is unreachable', async () => {
    vi.spyOn(deploy, 'getDeployServices').mockRejectedValue(new Error('503'))
    renderPage()
    expect(await screen.findByText(/배포 서비스에 연결하지 못했습니다/)).toBeInTheDocument()
  })
})
