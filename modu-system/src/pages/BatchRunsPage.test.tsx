import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDisplayTimeZone } from '@modu/console-core'
import { chooseOption } from '@modu/console-core/test/select'
import * as batch from '../api/batch'
import BatchRunsPage from './BatchRunsPage'

const base: batch.BatchRun = {
  id: 'job-0000000000000001',
  batchJobId: 1,
  service: 'commerce-service',
  jobName: 'point-outbox-relay',
  trigger: 'CRON',
  triggeredBy: null,
  status: 'SUCCEEDED',
  startedAt: '2026-10-17T03:00:00Z',
  finishedAt: '2026-10-17T03:00:01Z',
  durationMs: 49,
  httpStatus: 200,
  result: { outcome: 'ok', result: { relayed: 2 } },
}

const runs: batch.BatchRun[] = [
  { ...base, id: 'job-0000000000000003', jobName: 'push-campaigns', batchJobId: 2, trigger: 'MANUAL', triggeredBy: '임준섭', status: 'FAILED', httpStatus: 500, result: null, error: 'java.lang.IllegalStateException: boom', startedAt: '2026-10-17T03:10:00Z' },
  { ...base, id: 'job-0000000000000002', service: 'point-service', jobName: 'x', batchJobId: 3, status: 'SKIPPED', durationMs: 0, result: null, error: '앞 회차가 아직 RUNNING 이라 건너뛰었다', startedAt: '2026-10-17T03:05:00Z' },
  base,
]

const renderPage = (entry = '/batch/runs') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <BatchRunsPage />
    </MemoryRouter>,
  )

describe('BatchRunsPage', () => {
  beforeEach(() => {
    setDisplayTimeZone('UTC')
    vi.spyOn(batch, 'listRuns').mockResolvedValue(runs)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    setDisplayTimeZone(null)
  })

  it('lists runs newest first and filters by service and status', async () => {
    renderPage()

    expect(await screen.findByText('push-campaigns')).toBeInTheDocument()
    expect(batch.listRuns).toHaveBeenCalledWith(undefined, undefined, 100)
    // 배치 이름과 서비스는 따로 칸을 둔다(머리줄: 시작 · 배치 이름 · 서비스 · 실행 …).
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent).slice(0, 4)).toEqual(['시작', '배치 이름', '서비스', '실행'])
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '실행 이력' })).toBeInTheDocument()
    const failedRow = screen.getByText('push-campaigns').closest('tr')!
    expect(within(failedRow).getByText('commerce-service')).toBeInTheDocument()
    expect(within(failedRow).getByText('실패')).toBeInTheDocument()
    expect(within(failedRow).getByText(/임준섭/)).toBeInTheDocument()

    await chooseOption(userEvent, '서비스', 'point-service')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(within(screen.getByText('x').closest('tr')!).getByText('건너뜀')).toBeInTheDocument()

    await chooseOption(userEvent, '서비스', '모든 서비스')
    await userEvent.click(screen.getByRole('radio', { name: '성공' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: '진행 중' }))
    expect(screen.getByText('조건에 맞는 회차가 없다')).toBeInTheDocument()
  })

  it('filters by service and then by one of that service\'s batch jobs', async () => {
    renderPage()
    expect(await screen.findByText('push-campaigns')).toBeInTheDocument()

    // 서비스를 고르기 전에는 모든 배치가, 고른 뒤에는 그 서비스의 배치만 후보로 뜬다.
    await chooseOption(userEvent, '서비스', 'commerce-service')
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox', { name: '배치' }))
    expect(screen.getByRole('option', { name: 'push-campaigns' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'x' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: 'push-campaigns' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.queryByText('point-outbox-relay')).not.toBeInTheDocument()

    // 서비스를 바꾸면 배치 선택은 풀린다.
    await chooseOption(userEvent, '서비스', 'point-service')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByText('x')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '배치' })).toHaveTextContent('모든 배치')
  })

  it('expands a row to show the service response, the error and the OpenSearch link', async () => {
    renderPage()

    await userEvent.click((await screen.findByText('point-outbox-relay')).closest('tr')!)
    expect(screen.getByText(/"relayed": 2/)).toBeInTheDocument()
    // 펼친 줄은 배포 이력과 같은 모양(deploy-panel-row)이고 표는 카드 끝까지 닿는다.
    expect(screen.getByText(/"relayed": 2/).closest('tr')).toHaveClass('deploy-panel-row')
    expect(screen.getByText(/"relayed": 2/).closest('.card-table-wrap')).not.toBeNull()
    const link = screen.getByRole('link', { name: 'OpenSearch 에서 이 회차 로그 보기' })
    expect(link.getAttribute('href')).toContain('job-0000000000000001')
    expect(link.getAttribute('href')).toContain('localhost:5601')

    await userEvent.click(screen.getByText('push-campaigns').closest('tr')!)
    expect(screen.getByRole('alert')).toHaveTextContent('java.lang.IllegalStateException: boom')
  })

  it('keeps the opened row when the service filter changes', async () => {
    renderPage('/batch/runs?open=job-0000000000000003')
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')

    await chooseOption(userEvent, '서비스', 'commerce-service')
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
  })

  it('shows runs as cards on a phone', async () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query.includes('768'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia
    try {
      renderPage()
      expect(await screen.findByText('push-campaigns')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /push-campaigns/ }))
      expect(screen.getByRole('alert')).toHaveTextContent('boom')
    } finally {
      window.matchMedia = original
    }
  })

  it('opens the run named by ?open=', async () => {
    renderPage('/batch/runs?open=job-0000000000000003')
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
  })
})
