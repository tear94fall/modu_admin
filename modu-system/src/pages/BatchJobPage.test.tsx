import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDisplayTimeZone } from '@modu/console-core'
import * as batch from '../api/batch'
import BatchJobPage from './BatchJobPage'

const run: batch.BatchRun = {
  id: 'job-0000000000000001',
  batchJobId: 1,
  service: 'commerce-service',
  jobName: 'point-outbox-relay',
  trigger: 'MANUAL',
  triggeredBy: '임준섭',
  status: 'TIMEOUT',
  startedAt: '2026-10-17T03:00:00Z',
  finishedAt: '2026-10-17T03:02:00Z',
  durationMs: 120000,
  error: '120초 안에 응답하지 않았다',
}
const job: batch.BatchJob = { id: 1, service: 'commerce-service', jobName: 'point-outbox-relay', description: '아웃박스 릴레이', cron: '0 */2 * * * *', zone: 'Asia/Seoul', enabled: true, timeoutSeconds: 120, nextRunAt: '2026-10-17T03:02:00Z', lastRun: run }
const changes: batch.BatchChange[] = [
  { id: 2, batchJobId: 1, changedBy: '임준섭', changedAt: '2026-10-17T02:50:00Z', field: 'cron', before: '0 * * * * *', after: '0 */2 * * * *' },
  { id: 1, batchJobId: 1, changedBy: '임준섭', changedAt: '2026-10-17T02:40:00Z', field: 'created', before: null, after: '0 * * * * * Asia/Seoul enabled=true timeout=120s' },
]

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/batch/jobs/1']}>
      <Routes>
        <Route path="/batch/jobs/:id" element={<BatchJobPage />} />
        <Route path="/batch" element={<p>잡 목록 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('BatchJobPage', () => {
  beforeEach(() => {
    setDisplayTimeZone('UTC')
    vi.spyOn(batch, 'getJob').mockResolvedValue(job)
    vi.spyOn(batch, 'listJobRuns').mockResolvedValue([run])
    vi.spyOn(batch, 'listJobChanges').mockResolvedValue(changes)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    setDisplayTimeZone(null)
  })

  it('shows the definition, the runs and the change log', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'commerce-service/point-outbox-relay' })).toBeInTheDocument()
    expect(screen.getByText('0 */2 * * * *')).toBeInTheDocument()
    expect(screen.getByText('스케줄 켜짐')).toBeInTheDocument()
    expect(screen.getAllByText('시간 초과').length).toBeGreaterThan(0)
    const changeRow = screen.getByText('주기(cron)').closest('tr')!
    expect(within(changeRow).getByText('0 * * * * * → 0 */2 * * * *')).toBeInTheDocument()
    expect(screen.getByText('등록')).toBeInTheDocument()
  })

  it('edits only the changed fields', async () => {
    const updated = { ...job, cron: '0 0 4 * * *', enabled: false }
    vi.spyOn(batch, 'updateJob').mockImplementation(async () => {
      // 저장 뒤 화면이 다시 읽어도 바뀐 정의가 보이게.
      vi.spyOn(batch, 'getJob').mockResolvedValue(updated)
      return updated
    })
    vi.spyOn(batch, 'cronPreview').mockResolvedValue(['2026-10-17T19:00:00Z'])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: '수정' }))
    const form = screen.getByRole('form', { name: '잡 수정' })
    const cron = within(form).getByLabelText(/주기/)
    await userEvent.clear(cron)
    await userEvent.type(cron, '0 0 4 * * *')
    await userEvent.click(within(form).getByLabelText(/스케줄 사용/))
    await userEvent.click(within(form).getByRole('button', { name: '저장' }))

    expect(batch.updateJob).toHaveBeenCalledWith(1, { cron: '0 0 4 * * *', enabled: false })
    expect(await screen.findByText('저장했습니다')).toBeInTheDocument()
    expect(screen.getByText('스케줄 꺼짐(수동 실행만)')).toBeInTheDocument()
  })

  it('deletes after a confirmation and goes back to the list', async () => {
    vi.spyOn(batch, 'deleteJob').mockResolvedValue(undefined)
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: '삭제' }))
    await userEvent.click(screen.getByRole('button', { name: 'point-outbox-relay 삭제' }))

    expect(batch.deleteJob).toHaveBeenCalledWith(1)
    expect(await screen.findByText('잡 목록 화면')).toBeInTheDocument()
  })
})
