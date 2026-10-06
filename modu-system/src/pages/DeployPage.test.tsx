import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, setDisplayTimeZone } from '@modu/console-core'
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

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/deploy']}>
      <Routes>
        <Route path="/deploy" element={<DeployPage />} />
        <Route path="/deploy/:name" element={<p>상세 화면</p>} />
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

const failed: deploy.Deployment = {
  ...running,
  finishedAt: '2026-10-06T05:01:00Z',
  status: 'FAILED',
  step: 'ROLLOUT',
  percent: 50,
  steps: [running.steps![0], running.steps![1], { name: 'ROLLOUT', status: 'FAILED', message: 'CrashLoopBackOff' }],
  rollout: { desired: 2, updated: 1, ready: 0, available: 0, pods: [{ name: 'point-service-new-1', phase: 'Running', ready: false, reason: 'CrashLoopBackOff' }] },
  error: 'point-service-new-1: CrashLoopBackOff',
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
    expect(within(row).getByRole('button', { name: 'point-service 롤백' })).toBeEnabled()

    const chatRow = screen.getByRole('button', { name: 'chat-service 배포' }).closest('tr')!
    expect(within(chatRow).getByText('develop-9378b00')).toHaveClass('deploy-tag--diff')
    expect(within(chatRow).getByText('진행 중')).toBeInTheDocument()
    expect(within(chatRow).getByText('0/2')).toBeInTheDocument()
    expect(within(chatRow).getByRole('button', { name: 'chat-service 롤백' })).toBeDisabled()

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
    expect(await screen.findByText('상세 화면')).toBeInTheDocument()
  })

  it('clicking a row on a wide screen opens the service page too', async () => {
    renderPage()
    await userEvent.click(await screen.findByText('chat-service', { selector: 'td' }))
    expect(await screen.findByText('상세 화면')).toBeInTheDocument()
  })

  it('opens the tag list, enables 배포 after choosing a tag, and asks before redeploying the current one', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'point-service 배포' }))

    const panel = await screen.findByRole('group', { name: 'point-service 배포 태그 선택' })
    expect(within(panel).getByText(/2026-10-05 03:45 · Merge pull request #422/)).toBeInTheDocument()
    expect(within(panel).getByText('현재')).toBeInTheDocument()
    const confirm = within(panel).getByRole('button', { name: '배포' })
    expect(confirm).toBeDisabled()

    await userEvent.click(within(panel).getByRole('radio', { name: /develop-5708871/ }))
    expect(confirm).toBeDisabled()
    await userEvent.click(within(panel).getByRole('checkbox', { name: '같은 태그 다시 배포' }))
    expect(confirm).toBeEnabled()

    await userEvent.click(within(panel).getByRole('radio', { name: /develop-9378b00/ }))
    expect(screen.queryByRole('checkbox', { name: '같은 태그 다시 배포' })).not.toBeInTheDocument()
    expect(confirm).toBeEnabled()
  })

  it('starts the deployment, shows the progress bar and pods while polling, then 완료 and a refreshed table', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const start = vi.spyOn(deploy, 'deployService').mockResolvedValue(started)
    const get = vi.spyOn(deploy, 'getDeployment').mockResolvedValue(running)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'point-service 배포' }))
    const picker = await screen.findByRole('group', { name: 'point-service 배포 태그 선택' })
    await user.click(within(picker).getByRole('radio', { name: /develop-9378b00/ }))
    await user.click(within(picker).getByRole('button', { name: '배포' }))
    expect(start).toHaveBeenCalledWith('point-service', 'develop-9378b00')

    const progress = await screen.findByRole('group', { name: 'point-service 배포 진행' })
    expect(within(progress).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5')
    expect(within(progress).getByText('커밋 진행 중', { exact: false })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(get).toHaveBeenCalledWith('dep-2')
    expect(within(progress).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75')
    expect(within(progress).getByText(/준비 1\/2/)).toBeInTheDocument()
    expect(within(progress).getByText('point-service-abc-xyz')).toBeInTheDocument()
    expect(within(progress).getByText('커밋 abc1234')).toBeInTheDocument()

    const servicesCalls = (deploy.getDeployServices as ReturnType<typeof vi.fn>).mock.calls.length
    get.mockResolvedValue(succeeded)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(within(progress).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(within(progress).getByText(/완료 · 소요 42초/)).toBeInTheDocument()
    expect(deploy.getDeployServices).toHaveBeenCalledTimes(servicesCalls + 1)

    // 끝나면 더 읽지 않는다.
    const getCalls = get.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(get.mock.calls.length).toBe(getCalls)
  })

  it('shows the error in the panel when the deployment fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.spyOn(deploy, 'deployService').mockResolvedValue(started)
    vi.spyOn(deploy, 'getDeployment').mockResolvedValue(failed)
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'point-service 배포' }))
    const picker = await screen.findByRole('group', { name: 'point-service 배포 태그 선택' })
    await user.click(within(picker).getByRole('radio', { name: /develop-9378b00/ }))
    await user.click(within(picker).getByRole('button', { name: '배포' }))
    const progress = await screen.findByRole('group', { name: 'point-service 배포 진행' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(within(progress).getByRole('alert')).toHaveTextContent('실패: point-service-new-1: CrashLoopBackOff')
    expect(within(progress).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(within(progress).getByText('CrashLoopBackOff', { selector: 'span' })).toBeInTheDocument()
    expect(within(progress).getByRole('button', { name: '닫기' })).toBeInTheDocument()
  })

  it('rolls back straight into the progress view and shows the 409 message when there is nothing to roll back', async () => {
    const rollback = vi.spyOn(deploy, 'rollbackService').mockResolvedValue({ ...started, tag: 'develop-35db83f', previousTag: 'develop-5708871' })
    vi.spyOn(deploy, 'getDeployment').mockResolvedValue(running)
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'point-service 롤백' }))
    expect(rollback).toHaveBeenCalledWith('point-service')
    expect(await screen.findByRole('group', { name: 'point-service 배포 진행' })).toBeInTheDocument()

    rollback.mockRejectedValue(new ApiError(409, JSON.stringify({ error: 'no_previous', message: '되돌릴 배포가 없습니다' })))
    await userEvent.click(screen.getByRole('button', { name: 'point-service 롤백' }))
    expect(await screen.findByText('되돌릴 배포가 없습니다')).toBeInTheDocument()
  })

  it('reopens the progress panel on mount for a deployment that is still RUNNING, without clicking 배포', async () => {
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

    // 새로 배포를 시작하면 적어 두고, 닫으면 지운다.
    vi.spyOn(deploy, 'deployService').mockResolvedValue(started)
    await userEvent.click(within(progress).getByRole('button', { name: '닫기' }))
    await userEvent.click(screen.getByRole('button', { name: 'point-service 배포' }))
    const picker = await screen.findByRole('group', { name: 'point-service 배포 태그 선택' })
    await userEvent.click(within(picker).getByRole('radio', { name: /develop-9378b00/ }))
    await userEvent.click(within(picker).getByRole('button', { name: '배포' }))
    await screen.findByRole('group', { name: 'point-service 배포 진행' })
    expect(sessionStorage.getItem('modu-deploy-open:point-service')).toBe('dep-2')
    await userEvent.click(screen.getByRole('button', { name: '숨기기' }))
    expect(sessionStorage.getItem('modu-deploy-open:point-service')).toBeNull()
  })

  it('shows an error when deploy-service is unreachable', async () => {
    vi.spyOn(deploy, 'getDeployServices').mockRejectedValue(new Error('503'))
    renderPage()
    expect(await screen.findByText(/배포 서비스에 연결하지 못했습니다/)).toBeInTheDocument()
  })
})
