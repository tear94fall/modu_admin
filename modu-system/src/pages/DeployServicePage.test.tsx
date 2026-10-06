import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDisplayTimeZone } from '@modu/console-core'
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
    },
  ],
  argocd: { application: 'modu-dev', url: 'http://localhost:8090/applications/modu-dev' },
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

const renderPage = (name = 'point-service') =>
  render(
    <MemoryRouter initialEntries={[`/deploy/${name}`]}>
      <Routes>
        <Route path="/deploy/:name" element={<DeployServicePage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('DeployServicePage', () => {
  beforeEach(() => {
    setDisplayTimeZone('UTC')
    vi.spyOn(deploy, 'getDeployServices').mockResolvedValue(services)
    vi.spyOn(deploy, 'listDeployments').mockResolvedValue(history)
    vi.spyOn(deploy, 'getServiceTags').mockResolvedValue({ tags: [] })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    setDisplayTimeZone(null)
  })

  it('shows every field of the service and its own history with expandable steps', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'point-service' })).toBeInTheDocument()
    expect(screen.getByText(/modu_chat · ghcr.io\/tear94fall\/modu-chat\/point-service/)).toBeInTheDocument()
    expect(screen.getByText('develop-9378b00', { selector: 'dd' })).toHaveClass('deploy-tag--diff')
    expect(screen.getByText(/실행 중인 태그와 다르다/)).toBeInTheDocument()
    expect(screen.getByText('진행 중', { selector: '.status-badge' })).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← 목록' })).toHaveAttribute('href', '/deploy')
    expect(screen.getByRole('link', { name: 'Argo CD 열기' })).toHaveAttribute('href', 'http://localhost:8090/applications/modu-dev')
    expect(deploy.listDeployments).toHaveBeenCalledWith('point-service', 20)

    const section = screen.getByText('배포 이력').closest('section')!
    expect(screen.queryByRole('columnheader', { name: '서비스' })).not.toBeInTheDocument()
    const failedRow = within(section).getByText('develop-9378b00').closest('tr')!
    expect(within(failedRow).getByText('실패')).toBeInTheDocument()
    expect(within(failedRow).getByText('60초')).toBeInTheDocument()

    await userEvent.click(failedRow)
    expect(within(section).getByText('CrashLoopBackOff')).toBeInTheDocument()
    expect(within(section).getByText('point-service-new-1: CrashLoopBackOff')).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: 'abc1234' })).toHaveAttribute('href', 'https://github.com/x/c')
    expect(within(section).getByText(/이전 develop-5708871 · 시작 2026-10-06 05:00 · 끝 2026-10-06 05:01 · 소요 60초/)).toBeInTheDocument()
  })

  it('opens the tag picker from the detail card', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: '배포' }))
    expect(await screen.findByRole('group', { name: 'point-service 배포 태그 선택' })).toBeInTheDocument()
    expect(deploy.getServiceTags).toHaveBeenCalledWith('point-service')
  })

  it('tells when the service is not a deploy target', async () => {
    renderPage('nope-service')
    expect(await screen.findByText('배포 대상 서비스가 아닙니다: nope-service')).toBeInTheDocument()
  })
})
