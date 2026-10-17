import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOBILE_QUERY, setDisplayTimeZone } from '@modu/console-core'
import { chooseOption } from '@modu/console-core/test/select'
import * as batch from '../api/batch'
import BatchJobsPage from './BatchJobsPage'

const run: batch.BatchRun = {
  id: 'job-0000000000000001',
  batchJobId: 1,
  service: 'commerce-service',
  jobName: 'point-outbox-relay',
  trigger: 'CRON',
  triggeredBy: null,
  status: 'SUCCEEDED',
  startedAt: '2026-10-17T03:00:00Z',
  finishedAt: '2026-10-17T03:00:01Z',
  durationMs: 1200,
  httpStatus: 200,
}

const jobs: batch.BatchJob[] = [
  { id: 1, service: 'commerce-service', jobName: 'point-outbox-relay', description: '아웃박스 릴레이', cron: '0 */2 * * * *', zone: 'Asia/Seoul', enabled: true, timeoutSeconds: 120, nextRunAt: '2026-10-17T03:02:00Z', lastRun: run },
  { id: 2, service: 'commerce-service', jobName: 'push-campaigns', description: null, cron: '0 * * * * *', zone: 'Asia/Seoul', enabled: false, timeoutSeconds: 600, nextRunAt: null, lastRun: null },
]

const Location = () => <div data-testid="location">{useLocation().pathname}</div>

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/batch']}>
      <BatchJobsPage />
      <Location />
    </MemoryRouter>,
  )

describe('BatchJobsPage', () => {
  beforeEach(() => {
    setDisplayTimeZone('UTC')
    vi.spyOn(batch, 'listJobs').mockResolvedValue(jobs)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    setDisplayTimeZone(null)
  })

  it('lists jobs with cron, next run and last run, and toggles the schedule', async () => {
    const toggled = { ...jobs[0], enabled: false, nextRunAt: null }
    vi.spyOn(batch, 'updateJob').mockResolvedValue(toggled)
    // 토글 뒤 목록을 한 번 더 읽어 맞추므로, 서버가 바뀐 상태를 돌려주는 것으로 둔다.
    vi.spyOn(batch, 'listJobs').mockResolvedValueOnce(jobs).mockResolvedValue([toggled, jobs[1]])
    renderPage()

    const row = (await screen.findByText('point-outbox-relay')).closest('tr')!
    // 배치 이름과 서비스는 따로 칸을 둔다(머리줄: 배치 이름 · 서비스 · 주기 …).
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers.slice(0, 3)).toEqual(['배치 이름', '서비스', '주기'])
    expect(within(row).getByText('commerce-service')).toBeInTheDocument()
    expect(within(row).getByText('아웃박스 릴레이')).toBeInTheDocument()
    expect(within(row).getByText('0 */2 * * * *')).toBeInTheDocument()
    expect(within(row).getByText('2026-10-17 03:02')).toBeInTheDocument()
    expect(within(row).getByText('성공')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '배치 목록' })).toBeInTheDocument()
    // 배포 화면처럼 요약 숫자 카드와 카드 제목·설명·건수를 둔다.
    const summary = screen.getByRole('region', { name: '잡 요약' })
    expect(within(summary).getByText('잡').nextElementSibling).toHaveTextContent('2')
    expect(within(summary).getByText('스케줄 켜짐').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByRole('heading', { name: '등록된 잡' })).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(row.closest('.card-table-wrap')).not.toBeNull()

    const toggle = within(row).getByRole('switch', { name: 'commerce-service/point-outbox-relay 스케줄 사용' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle)
    expect(batch.updateJob).toHaveBeenCalledWith(1, { enabled: false })
    expect(await screen.findByText('commerce-service/point-outbox-relay 스케줄을 껐습니다')).toBeInTheDocument()
    expect(within(row).getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('navigates to the job on row click and filters by keyword like the deploy list', async () => {
    renderPage()

    const row = (await screen.findByText('push-campaigns')).closest('tr')!
    await userEvent.type(screen.getByRole('searchbox', { name: '잡 검색' }), 'push')
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.queryByText('point-outbox-relay')).not.toBeInTheDocument()

    await userEvent.click(row)
    expect(screen.getByTestId('location')).toHaveTextContent('/batch/jobs/2')
  })

  it('shows jobs as cards on a phone and says what to press', async () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query === MOBILE_QUERY, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia
    try {
      renderPage()
      expect(await screen.findByRole('link', { name: 'push-campaigns' })).toHaveAttribute('href', '/batch/jobs/2')
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(screen.getByText('이름을 누르면 상세로')).toBeInTheDocument()
      expect(screen.queryByText(/행을 누르면/)).not.toBeInTheDocument()
    } finally {
      window.matchMedia = original
    }
  })

  it('runs a job now after confirming and links to the run', async () => {
    vi.spyOn(batch, 'runJob').mockResolvedValue({ runId: 'job-abc', status: 'RUNNING' })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'commerce-service/push-campaigns 지금 실행' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'push-campaigns 실행' }))

    expect(batch.runJob).toHaveBeenCalledWith(2)
    expect(await screen.findByText('commerce-service/push-campaigns 실행을 시작했습니다')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '회차 보기' })).toHaveAttribute('href', '/batch/runs?open=job-abc')
  })

  it('registers a job: pick a service, then one of its jobs, then a cron with preview', async () => {
    vi.spyOn(batch, 'listServices').mockResolvedValue([{ name: 'commerce-service', url: 'http://commerce-service:8200' }, { name: 'point-service', url: 'http://point-service:9600' }])
    vi.spyOn(batch, 'listServiceJobs').mockResolvedValue([{ name: 'point-reconcile', description: '전날 포인트 대사' }])
    vi.spyOn(batch, 'cronPreview').mockResolvedValue(['2026-10-17T19:00:00Z', '2026-10-18T19:00:00Z', '2026-10-19T19:00:00Z'])
    const created: batch.BatchJob = { ...jobs[1], id: 3, jobName: 'point-reconcile', description: '전날 포인트 대사', cron: '0 0 4 * * *', enabled: true }
    vi.spyOn(batch, 'createJob').mockResolvedValue(created)
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: '잡 등록' }))
    const form = screen.getByRole('form', { name: '잡 등록' })
    expect(within(form).getByRole('button', { name: '등록' })).toBeDisabled()

    await chooseOption(userEvent, '서비스', 'commerce-service')
    expect(batch.listServiceJobs).toHaveBeenCalledWith('commerce-service')
    await chooseOption(userEvent, '잡', 'point-reconcile — 전날 포인트 대사')
    await userEvent.type(within(form).getByLabelText(/주기/), '0 0 4 * * *')
    expect(await screen.findByText(/다음 실행: 2026-10-17 19:00/)).toBeInTheDocument()
    await userEvent.click(within(form).getByLabelText(/스케줄 사용/))
    await userEvent.click(within(form).getByRole('button', { name: '등록' }))

    expect(batch.createJob).toHaveBeenCalledWith({ service: 'commerce-service', jobName: 'point-reconcile', cron: '0 0 4 * * *', zone: 'Asia/Seoul', timeoutSeconds: 600, enabled: true, description: '전날 포인트 대사' })
    expect(await screen.findByText('commerce-service/point-reconcile 을 등록했습니다')).toBeInTheDocument()
  })
})
