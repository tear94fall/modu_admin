import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDisplayTimeZone } from '@modu/console-core'
import type { BatchRun } from '../api/batch'
import { RunsTable } from './BatchPanels'

const base: BatchRun = {
  id: 'job-1',
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
  result: { relayed: 2 },
}
const runs: BatchRun[] = [{ ...base, id: 'job-2', jobName: 'push-campaigns', result: { sent: 1 } }, base]

const table = (initialOpen: string | null) => (
  <MemoryRouter>
    <RunsTable runs={runs} showJob initialOpen={initialOpen} emptyText="없다" />
  </MemoryRouter>
)

describe('RunsTable', () => {
  beforeEach(() => setDisplayTimeZone('UTC'))
  afterEach(() => {
    setDisplayTimeZone(null)
    vi.restoreAllMocks()
  })

  it('keeps the open row when initialOpen goes away, and re-opens it when the same id comes back', async () => {
    const { rerender } = render(table('job-1'))
    expect(screen.getByText(/"relayed": 2/)).toBeInTheDocument()

    // 사용자가 행을 눌러 닫았다가(?open= 은 아직 그대로) 필터 변경으로 ?open= 이 지워지고, 뒤로가기로 같은 id 가 다시 오면 다시 펼친다.
    await userEvent.click(screen.getByText('point-outbox-relay').closest('tr')!)
    expect(screen.queryByText(/"relayed": 2/)).not.toBeInTheDocument()
    rerender(table(null))
    expect(screen.queryByText(/"relayed": 2/)).not.toBeInTheDocument()
    rerender(table('job-1'))
    expect(screen.getByText(/"relayed": 2/)).toBeInTheDocument()

    // ?open= 이 지워져도(필터 변경 등) 펼친 행은 그대로.
    rerender(table(null))
    expect(screen.getByText(/"relayed": 2/)).toBeInTheDocument()

    // 다른 회차로 바꾸면 그 회차를 펼친다.
    rerender(table('job-2'))
    expect(screen.getByText(/"sent": 1/)).toBeInTheDocument()
    expect(screen.queryByText(/"relayed": 2/)).not.toBeInTheDocument()
  })
})
