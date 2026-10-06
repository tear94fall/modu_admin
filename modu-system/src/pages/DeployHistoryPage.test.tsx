import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDisplayTimeZone } from '@modu/console-core'
import * as deploy from '../api/deploy'
import DeployHistoryPage from './DeployHistoryPage'

const base: deploy.Deployment = {
  id: 'dep-0',
  service: 'point-service',
  tag: 'develop-5708871',
  by: 'joonsub2990@gmail.com',
  startedAt: '2026-10-06T03:59:30Z',
  finishedAt: '2026-10-06T04:00:00Z',
  status: 'SUCCEEDED',
  step: 'DONE',
  percent: 100,
}

const deployments: deploy.Deployment[] = [
  { ...base, id: 'dep-3', service: 'chat-service', tag: 'develop-aaaaaaa', startedAt: '2026-10-06T06:00:00Z', finishedAt: null, status: 'RUNNING', step: 'SYNC', percent: 30 },
  { ...base, id: 'dep-2', service: 'point-service', tag: 'develop-9378b00', status: 'FAILED', step: 'ROLLOUT', percent: 50, error: 'CrashLoopBackOff' },
  { ...base, id: 'dep-1' },
]

const renderPage = (entry = '/deploy/history') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <DeployHistoryPage />
    </MemoryRouter>,
  )

describe('DeployHistoryPage', () => {
  beforeEach(() => {
    setDisplayTimeZone('UTC')
    vi.spyOn(deploy, 'listDeployments').mockResolvedValue(deployments)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    setDisplayTimeZone(null)
  })

  it('lists the last 50 with a running one, and filters by service and status', async () => {
    renderPage()

    expect(await screen.findByText('develop-aaaaaaa')).toBeInTheDocument()
    expect(deploy.listDeployments).toHaveBeenCalledWith(undefined, 50)
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    const runningRow = screen.getByText('develop-aaaaaaa').closest('tr')!
    expect(within(runningRow).getByText('진행 중')).toBeInTheDocument()
    expect(within(runningRow).getByText('-')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '서비스' }), 'point-service')
    expect(screen.queryByText('develop-aaaaaaa')).not.toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: '실패' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    const failedRow = screen.getByText('develop-9378b00').closest('tr')!
    await userEvent.click(failedRow)
    expect(screen.getByText('CrashLoopBackOff')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: '진행 중' }))
    expect(screen.getByText('조건에 맞는 배포가 없다')).toBeInTheDocument()
  })

  it('preselects the service from the query string', async () => {
    renderPage('/deploy/history?service=chat-service')
    expect(await screen.findByText('develop-aaaaaaa')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '서비스' })).toHaveValue('chat-service')
    expect(screen.queryByText('develop-9378b00')).not.toBeInTheDocument()
  })

  it('says so when there is no history yet', async () => {
    vi.spyOn(deploy, 'listDeployments').mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('아직 배포 이력이 없다')).toBeInTheDocument()
  })
})
