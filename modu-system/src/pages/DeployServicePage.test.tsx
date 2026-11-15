import { act, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, setDisplayTimeZone } from '@modu/console-core'
import * as deploy from '../api/deploy'
import DeployServicePage from './DeployServicePage'

const services: deploy.DeployServicesResponse = {
  services: [
    {
      name: 'point-service',
      repo: 'modu_chat',
      image: 'ghcr.io/tear94fall/modu-chat/point-service',
      gitTag: 'develop-9378b00',
      runningTag: 'develop-5708871',
      readyReplicas: 1,
      desiredReplicas: 2,
      updatedReplicas: 1,
      status: 'PROGRESSING',
      lastDeployment: { id: 'dep-1', tag: 'develop-5708871', by: 'joonsub2990@gmail.com', finishedAt: '2026-10-06T04:00:00Z', status: 'SUCCEEDED' },
      canaryCapable: true,
      canarySteps: [50],
      rolloutPaused: null,
    },
  ],
  argocd: { application: 'modu-dev', url: 'http://localhost:8090/applications/modu-dev' },
  temporal: { namespace: 'platform', url: 'http://localhost:8233' },
}

const history: deploy.Deployment[] = [
  {
    id: 'dep-2',
    service: 'point-service',
    tag: 'develop-9378b00',
    previousTag: 'develop-5708871',
    by: 'joonsub2990@gmail.com',
    startedAt: '2026-10-06T05:00:00Z',
    finishedAt: '2026-10-06T05:01:00Z',
    status: 'FAILED',
    step: 'ROLLOUT',
    percent: 50,
    steps: [
      { name: 'COMMIT', status: 'SUCCEEDED', message: '커밋 abc1234' },
      { name: 'SYNC', status: 'SUCCEEDED', message: 'Synced' },
      { name: 'ROLLOUT', status: 'FAILED', message: 'CrashLoopBackOff' },
    ],
    commit: { sha: 'abc1234def', url: 'https://github.com/x/c' },
    error: 'point-service-new-1: CrashLoopBackOff',
    workflowRunId: 'run-2',
    workflowUrl: 'http://localhost:8233/namespaces/platform/workflows/deploy-point-service/run-2/history',
  },
  {
    id: 'dep-1',
    service: 'point-service',
    tag: 'develop-5708871',
    by: 'joonsub2990@gmail.com',
    startedAt: '2026-10-06T03:59:30Z',
    finishedAt: '2026-10-06T04:00:00Z',
    status: 'SUCCEEDED',
    step: 'DONE',
    percent: 100,
  },
]

const tags: deploy.ImageTag[] = [
  { tag: 'develop-5708871', sha: '5708871', createdAt: '2026-10-06T03:45:00Z', commitMessage: 'Merge pull request #423', commitUrl: 'https://github.com/x/1', current: true },
  { tag: 'develop-9378b00', sha: '9378b00', createdAt: '2026-10-05T03:45:00Z', commitMessage: 'Merge pull request #422', commitUrl: 'https://github.com/x/2', current: false },
]

const started: deploy.Deployment = {
  id: 'dep-3',
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

/** 목록의 배포 버튼처럼 state.pick 을 주면 태그 고르기가 열린 채로 시작한다. */
const renderPage = (name = 'point-service', pick = false) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: `/deploy/${name}`, state: pick ? { pick: true } : null }]}>
      <Routes>
        <Route path="/deploy/:name" element={<DeployServicePage />} />
        <Route path="/deploy/history" element={<p>이력 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('DeployServicePage', () => {
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
    sessionStorage.clear()
  })

  it('shows every field of the service and its own history with expandable steps', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'point-service' })).toBeInTheDocument()
    expect(screen.getByText('modu_chat', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('ghcr.io/tear94fall/modu-chat/point-service', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('develop-9378b00', { selector: 'dd' })).toHaveClass('deploy-tag--diff')
    expect(screen.getByText(/실행 중인 태그와 다르다/)).toBeInTheDocument()
    expect(screen.getByText('진행 중', { selector: '.status-badge' })).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← 목록' })).toHaveAttribute('href', '/deploy')
    expect(screen.getByRole('link', { name: 'Argo CD 열기' })).toHaveAttribute('href', 'http://localhost:8090/applications/modu-dev')
    expect(screen.getByRole('link', { name: '전체 이력' })).toHaveAttribute('href', '/deploy/history?service=point-service')
    expect(deploy.listDeployments).toHaveBeenCalledWith('point-service', 20)

    const section = screen.getByText('배포 이력').closest('section')!
    expect(screen.queryByRole('columnheader', { name: '서비스' })).not.toBeInTheDocument()
    const failedRow = within(section).getByText('develop-9378b00').closest('tr')!
    expect(within(failedRow).getByText('실패')).toBeInTheDocument()
    expect(within(failedRow).getByText('60초')).toBeInTheDocument()

    await userEvent.click(failedRow)
    const steps = within(section).getByRole('list', { name: '배포 단계' })
    expect(within(steps).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['✓커밋성공커밋 abc1234', '✓Argo 동기화성공Synced', '!롤아웃실패CrashLoopBackOff'])
    expect(within(section).getByText('point-service-new-1: CrashLoopBackOff').closest('.deploy-error-box')).not.toBeNull()
    expect(within(section).getByRole('link', { name: 'abc1234' })).toHaveAttribute('href', 'https://github.com/x/c')
    expect(within(section).getByRole('link', { name: 'Temporal 에서 보기' })).toHaveAttribute('href', 'http://localhost:8233/namespaces/platform/workflows/deploy-point-service/run-2/history')
    const facts = within(section).getByText('develop-5708871 → develop-9378b00').closest('dl')!
    expect(within(facts).getByText('2026-10-06 05:00')).toBeInTheDocument()
    expect(within(facts).getByText('2026-10-06 05:01')).toBeInTheDocument()
    expect(within(facts).getByText('60초')).toBeInTheDocument()
    expect(within(facts).getByTitle('joonsub2990@gmail.com')).toHaveTextContent('joonsub2990')
  })

  it('shows no Temporal link for a record without a workflow run (old thread-era record)', async () => {
    renderPage()
    const section = (await screen.findByText('배포 이력')).closest('section')!
    await userEvent.click(within(section).getByText('develop-5708871', { selector: 'td' }).closest('tr')!)
    expect(within(section).queryByRole('link', { name: 'Temporal 에서 보기' })).not.toBeInTheDocument()
  })

  it('opens the tag picker from the detail card', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '배포' }))
    expect(await screen.findByRole('group', { name: 'point-service 배포 태그 선택' })).toBeInTheDocument()
    expect(deploy.getServiceTags).toHaveBeenCalledWith('point-service')
  })

  it('opens the picker right away when coming from the list 배포 button, and hides the history while picking', async () => {
    renderPage('point-service', true)
    expect(await screen.findByRole('group', { name: 'point-service 배포 태그 선택' })).toBeInTheDocument()
    expect(screen.queryByText('배포 이력')).not.toBeInTheDocument()
  })

  it('lists tags with date and commit message, marks the current one and asks before redeploying it', async () => {
    renderPage('point-service', true)
    const panel = await screen.findByRole('group', { name: 'point-service 배포 태그 선택' })
    expect(await within(panel).findByText(/2026-10-05 03:45 · Merge pull request #422/)).toBeInTheDocument()
    expect(within(panel).getByText('현재')).toBeInTheDocument()
    const next = within(panel).getByRole('button', { name: '배포' })
    expect(next).toBeDisabled()

    await userEvent.click(within(panel).getByRole('radio', { name: /develop-5708871/ }))
    expect(next).toBeDisabled()
    await userEvent.click(within(panel).getByRole('checkbox', { name: '같은 태그 다시 배포' }))
    expect(next).toBeEnabled()

    await userEvent.click(within(panel).getByRole('radio', { name: /develop-9378b00/ }))
    expect(screen.queryByRole('checkbox', { name: '같은 태그 다시 배포' })).not.toBeInTheDocument()
    expect(next).toBeEnabled()
  })

  it('asks in a dialog before deploying: 취소 calls nothing, 확인 starts it once, then shows progress, pods and the result banner', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const start = vi.spyOn(deploy, 'deployService').mockResolvedValue(started)
    const get = vi.spyOn(deploy, 'getDeployment').mockResolvedValue(running)
    renderPage('point-service', true)

    const picker = await screen.findByRole('group', { name: 'point-service 배포 태그 선택' })
    await user.click(await within(picker).findByRole('radio', { name: /develop-9378b00/ }))
    await user.click(within(picker).getByRole('button', { name: '배포' }))

    let dialog = screen.getByRole('dialog', { name: 'point-service 배포' })
    expect(within(dialog).getByText('develop-9378b00', { selector: 'strong' })).toBeInTheDocument()
    expect(within(dialog).getByText(/develop-5708871 →/)).toBeInTheDocument()
    expect(within(dialog).getByText('Merge pull request #422')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(start).not.toHaveBeenCalled()

    await user.click(within(picker).getByRole('button', { name: '배포' }))
    dialog = screen.getByRole('dialog', { name: 'point-service 배포' })
    await user.click(within(dialog).getByRole('button', { name: 'develop-9378b00 배포' }))
    expect(start).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith('point-service', 'develop-9378b00', 'DIRECT')

    const progress = await screen.findByRole('group', { name: 'point-service 배포 진행' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(progress).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5')
    expect(within(progress).getByText('커밋 진행 중', { exact: false })).toBeInTheDocument()
    expect(sessionStorage.getItem('modu-deploy-open:point-service')).toBe('dep-3')
    // 진행 중에는 다시 배포·롤백할 수 없다.
    expect(screen.getByRole('button', { name: '롤백' })).toBeDisabled()
    expect(screen.getByText(/배포가 진행 중이다/)).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(get).toHaveBeenCalledWith('dep-3')
    expect(within(progress).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75')
    expect(within(progress).getByText(/준비 1\/2/)).toBeInTheDocument()
    expect(within(progress).getByText('point-service-abc-xyz')).toBeInTheDocument()
    expect(within(progress).getByText('커밋 abc1234')).toBeInTheDocument()

    get.mockResolvedValue(succeeded)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(within(progress).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    const banner = within(progress).getByRole('status')
    expect(banner).toHaveTextContent('배포 성공')
    expect(within(banner).getByText(/완료 · 소요 42초/)).toBeInTheDocument()
    expect(within(banner).getByRole('link', { name: '이력에서 보기' })).toHaveAttribute('href', '/deploy/history?service=point-service&open=dep-3')
    expect(sessionStorage.getItem('modu-deploy-open:point-service')).toBeNull()

    // 끝나면 더 읽지 않는다.
    const getCalls = get.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(get.mock.calls.length).toBe(getCalls)
  })

  it('shows a failure banner with the error when the deployment fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.spyOn(deploy, 'deployService').mockResolvedValue(started)
    vi.spyOn(deploy, 'getDeployment').mockResolvedValue(failed)
    renderPage('point-service', true)

    const picker = await screen.findByRole('group', { name: 'point-service 배포 태그 선택' })
    await user.click(await within(picker).findByRole('radio', { name: /develop-9378b00/ }))
    await user.click(within(picker).getByRole('button', { name: '배포' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'develop-9378b00 배포' }))
    const progress = await screen.findByRole('group', { name: 'point-service 배포 진행' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    const alert = within(progress).getByRole('alert')
    expect(alert).toHaveTextContent('배포 실패')
    expect(alert).toHaveTextContent('실패: point-service-new-1: CrashLoopBackOff · 소요 60초')
    expect(within(alert).getByRole('link', { name: '이력에서 보기' })).toHaveAttribute('href', '/deploy/history?service=point-service&open=dep-3')
    expect(within(progress).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(within(progress).getByText('CrashLoopBackOff', { selector: 'span' })).toBeInTheDocument()
    expect(within(progress).getByRole('button', { name: '닫기' })).toBeInTheDocument()
  })

  it('rolls back only after a danger confirm that shows current → target tag: 취소 calls nothing, 확인 once; a 409 shows its message', async () => {
    vi.spyOn(deploy, 'listDeployments').mockResolvedValue([{ ...history[1], previousTag: 'develop-9378b00' }])
    const rollback = vi.spyOn(deploy, 'rollbackService').mockResolvedValue({ ...started, tag: 'develop-9378b00', previousTag: 'develop-5708871' })
    vi.spyOn(deploy, 'getDeployment').mockResolvedValue(running)
    renderPage()

    const button = await screen.findByRole('button', { name: '롤백' })
    expect(button).toHaveClass('btn--danger')
    await userEvent.click(button)
    let dialog = screen.getByRole('dialog', { name: 'point-service 롤백' })
    expect(within(dialog).getByText(/develop-5708871 →/)).toBeInTheDocument()
    expect(within(dialog).getByText('develop-9378b00', { selector: 'strong' })).toBeInTheDocument()
    expect(await within(dialog).findByText('Merge pull request #422')).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'develop-9378b00 로 롤백' })
    expect(confirm).toHaveClass('btn--danger-solid')
    expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus()

    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rollback).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '롤백' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rollback).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '롤백' }))
    dialog = screen.getByRole('dialog', { name: 'point-service 롤백' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'develop-9378b00 로 롤백' }))
    expect(rollback).toHaveBeenCalledTimes(1)
    expect(rollback).toHaveBeenCalledWith('point-service')
    expect(await screen.findByRole('group', { name: 'point-service 배포 진행' })).toBeInTheDocument()

    // 진행 카드를 닫고 다시 롤백 → 409 는 그 문구를 보여 준다.
    rollback.mockRejectedValue(new ApiError(409, JSON.stringify({ error: 'no_previous', message: '되돌릴 배포가 없습니다' })))
    vi.spyOn(deploy, 'getDeployment').mockResolvedValue(succeeded)
    await userEvent.click(screen.getByRole('button', { name: '숨기기' }))
    expect(sessionStorage.getItem('modu-deploy-open:point-service')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '롤백' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'develop-9378b00 로 롤백' }))
    expect(await screen.findByText('되돌릴 배포가 없습니다')).toBeInTheDocument()
    expect(rollback).toHaveBeenCalledTimes(2)
  })

  it('cannot roll back a service that has never been deployed', async () => {
    vi.spyOn(deploy, 'getDeployServices').mockResolvedValue({ ...services, services: [{ ...services.services[0], lastDeployment: null }] })
    vi.spyOn(deploy, 'listDeployments').mockResolvedValue([])
    renderPage()
    expect(await screen.findByRole('button', { name: '롤백' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '롤백' })).toHaveAttribute('title', '배포 이력이 없어 되돌릴 수 없다')
    expect(screen.getByRole('button', { name: '배포' })).toBeEnabled()
  })

  it('locks 배포 and 롤백 with a reason while a deployment of the service is running, and resumes its progress', async () => {
    vi.spyOn(deploy, 'listDeployments').mockResolvedValue([{ ...running, id: 'dep-9' }, ...history])
    vi.spyOn(deploy, 'getDeployment').mockResolvedValue({ ...running, id: 'dep-9' })
    renderPage()
    expect(await screen.findByRole('group', { name: 'point-service 배포 진행' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '배포' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '롤백' })).toBeDisabled()
    expect(screen.getByText('이 서비스의 배포가 진행 중이다. 끝난 뒤에 배포·롤백할 수 있다.')).toBeInTheDocument()
  })

  it('disables 롤백 with a reason when the rollback target is the tag already running', async () => {
    vi.spyOn(deploy, 'listDeployments').mockResolvedValue([{ ...history[1], previousTag: 'develop-5708871' }])
    const rollback = vi.spyOn(deploy, 'rollbackService')
    renderPage()
    const button = await screen.findByRole('button', { name: '롤백' })
    await waitFor(() => expect(button).toBeDisabled())
    expect(button).toHaveAttribute('title', '되돌릴 태그가 지금 실행 중인 태그와 같아 롤백할 것이 없다.')
    expect(screen.getByText('되돌릴 태그가 지금 실행 중인 태그와 같아 롤백할 것이 없다.')).toBeInTheDocument()
    expect(rollback).not.toHaveBeenCalled()
  })

  it('tells when the service is not a deploy target', async () => {
    renderPage('nope-service')
    expect(await screen.findByText('배포 대상 서비스가 아닙니다: nope-service')).toBeInTheDocument()
  })

  // ---- 카나리 ------------------------------------------------------------------------------------------------------------

  const canaryWaiting: deploy.Deployment = {
    ...running,
    id: 'dep-c',
    mode: 'CANARY',
    step: 'ROLLOUT',
    percent: 75,
    steps: [running.steps![0], running.steps![1], { name: 'ROLLOUT', status: 'RUNNING', message: '카나리 50% · 준비 2/2' }],
    canary: {
      totalSteps: 1, currentStep: 1, weight: 50, waiting: true, waitingSince: '2026-10-06T05:00:30Z',
      canaryPods: ['point-service-new-1'], stablePods: ['point-service-old-1'], history: [],
      live: { phase: 'Paused', weight: 50, ready: 2, desired: 2, pods: [{ name: 'point-service-new-1', phase: 'Running', ready: true, reason: '' }, { name: 'point-service-old-1', phase: 'Running', ready: true, reason: '' }] },
    },
  }

  it('카나리 배포 is disabled with the reason when the service has a single pod', async () => {
    vi.spyOn(deploy, 'getDeployServices').mockResolvedValue({ ...services, services: [{ ...services.services[0], canaryCapable: false, canarySteps: [] }] })
    renderPage()
    const btn = await screen.findByRole('button', { name: '카나리 배포' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', '파드가 1개라 카나리 배포를 할 수 없다')
  })

  it('카나리 배포 opens the picker in canary mode and starts the deployment with mode CANARY', async () => {
    const start = vi.spyOn(deploy, 'deployService').mockResolvedValue(canaryWaiting)
    vi.spyOn(deploy, 'getDeployment').mockResolvedValue(canaryWaiting)
    vi.spyOn(deploy, 'getDeploymentErrors').mockResolvedValue({ count: 0, lines: [], error: null })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '카나리 배포' }))
    const picker = await screen.findByRole('group', { name: 'point-service 카나리 배포 태그 선택' })
    await user.click(within(picker).getByRole('radio', { name: /develop-9378b00/ }))
    await user.click(within(picker).getByRole('button', { name: '카나리 배포' }))
    const dialog = screen.getByRole('dialog', { name: 'point-service 카나리 배포' })
    await user.click(within(dialog).getByRole('button', { name: 'develop-9378b00 카나리 배포' }))
    expect(start).toHaveBeenCalledWith('point-service', 'develop-9378b00', 'CANARY')
  })

  it('the promote button names the next step weight from the live rollout steps, not 100%', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const twoSteps: deploy.Deployment = {
      ...canaryWaiting,
      canary: { ...canaryWaiting.canary!, totalSteps: 2, currentStep: 1, weight: 33, live: { ...canaryWaiting.canary!.live!, weight: 33, stepWeights: [33, 66] } },
    }
    vi.spyOn(deploy, 'getDeployment').mockResolvedValue(twoSteps)
    vi.spyOn(deploy, 'getDeploymentErrors').mockResolvedValue({ count: 0, lines: [], error: null })
    sessionStorage.setItem('modu-deploy-open:point-service', 'dep-c')
    renderPage()

    const progress = await screen.findByRole('group', { name: 'point-service 배포 진행' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(within(progress).getByRole('button', { name: '다음 단계 → 66%' })).toBeInTheDocument()
    expect(within(progress).queryByRole('button', { name: /100%/ })).not.toBeInTheDocument()
  })

  it('a waiting canary shows the ratio, live pods, error logs and promote/abort buttons', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(deploy, 'getDeployment').mockResolvedValue(canaryWaiting)
    const errors = vi.spyOn(deploy, 'getDeploymentErrors').mockResolvedValue({ count: 2, lines: [{ time: '2026-10-06T05:00:40Z', pod: 'point-service-new-1', message: 'NullPointerException' }], error: null })
    const promote = vi.spyOn(deploy, 'promoteDeployment').mockResolvedValue(undefined)
    sessionStorage.setItem('modu-deploy-open:point-service', 'dep-c')
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    const progress = await screen.findByRole('group', { name: 'point-service 배포 진행' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(within(progress).getByText(/단계 1\/1/)).toBeInTheDocument()
    expect(within(progress).getByRole('progressbar', { name: '카나리 비율' })).toHaveAttribute('aria-valuenow', '50')
    expect(within(progress).getAllByText('point-service-new-1')[0].closest('tr')).toHaveTextContent('새')
    expect(within(progress).getAllByText('point-service-old-1')[0].closest('tr')).toHaveTextContent('옛')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(errors).toHaveBeenCalledWith('dep-c', '2026-10-06T05:00:30Z')
    const logs = within(progress).getByRole('region', { name: '새 파드 에러 로그' })
    expect(logs).toHaveTextContent('2건')
    expect(logs).toHaveTextContent('NullPointerException')

    await user.click(within(progress).getByRole('button', { name: '완료 → 100%' }))
    expect(promote).toHaveBeenCalledWith('dep-c')
    expect(within(progress).getByRole('button', { name: '중단' })).toBeInTheDocument()
  })

  it('an aborted canary record shows the 중단 pill and its step history', async () => {
    const aborted: deploy.Deployment = {
      ...canaryWaiting, status: 'ABORTED', finishedAt: '2026-10-06T05:10:00Z', error: '운영자가 중단(joonsub2990@gmail.com) — 옛 태그 develop-5708871 로 되돌림',
      canary: { ...canaryWaiting.canary!, waiting: false, live: null, history: [{ step: 1, weight: 50, action: 'ABORT', by: 'joonsub2990@gmail.com', at: '2026-10-06T05:09:00Z' }] },
    }
    vi.spyOn(deploy, 'listDeployments').mockResolvedValue([aborted, ...history])
    const user = userEvent.setup()
    renderPage()

    const section = (await screen.findByText('배포 이력')).closest('section')!
    const row = within(section).getByText('중단', { selector: '.status-badge' }).closest('tr')!
    await user.click(row)
    const timeline = within(section).getByRole('list', { name: '카나리 단계 이력' })
    expect(timeline).toHaveTextContent('50%')
    expect(timeline).toHaveTextContent('중단')
    expect(timeline).toHaveTextContent('joonsub2990')
  })
})
