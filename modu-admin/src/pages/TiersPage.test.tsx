import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as coupons from '../api/coupons'
import * as tiers from '../api/tiers'
import type { AdminTier, TierRun } from '../api/tiers'
import TiersPage from './TiersPage'

const tier = (code: string, name: string, minAmount: number, earnRate: number, sortOrder: number, customerCount = 0): AdminTier => ({
  code,
  name,
  color: '#64748B',
  minAmount,
  earnRate,
  sortOrder,
  coupons: [],
  customerCount,
})
const TIERS = [tier('WELCOME', '웰컴', 0, 1, 0, 12), tier('SILVER', '실버', 100000, 2, 1, 3), tier('GOLD', '골드', 300000, 3, 2, 1), tier('VIP', 'VIP', 700000, 5, 3)]
const run = (id: number, status: TierRun['status']): TierRun => ({
  id,
  periodLabel: '2026.03 ~ 2026.08',
  startedAt: '2026-09-27T03:00:00',
  finishedAt: status === 'RUNNING' ? null : '2026-09-27T03:00:05',
  reason: 'MANUAL',
  customers: 16,
  changed: 2,
  countsByTier: '{"WELCOME":12,"SILVER":3,"GOLD":1}',
  couponsIssued: 4,
  couponsSkipped: 1,
  status,
  message: null,
})
const page = (content: TierRun[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 15 })

const renderPage = () =>
  render(
    <MemoryRouter>
      <TiersPage />
    </MemoryRouter>,
  )

describe('TiersPage', () => {
  beforeEach(() => {
    vi.spyOn(tiers, 'getTiers').mockResolvedValue(TIERS)
    vi.spyOn(tiers, 'getTierRuns').mockResolvedValue(page([run(1, 'DONE')]))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('lists the 4 tiers with customer counts and the runs table', async () => {
    renderPage()
    expect(await screen.findByLabelText('골드 기준 금액')).toHaveValue(300000)
    expect(screen.getByText('12명')).toBeInTheDocument()
    expect(screen.getByText('웰컴 12 · 실버 3 · 골드 1')).toBeInTheDocument()
    expect(screen.getAllByText('2026-09-27 12:00')).toHaveLength(2)
    expect(screen.getByText('완료')).toHaveClass('status-badge--done')
    // 바꾼 것이 없으면 저장할 수 없다.
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('shows client validation and does not call the server', async () => {
    const update = vi.spyOn(tiers, 'updateTiers')
    const user = userEvent.setup()
    renderPage()
    const gold = await screen.findByLabelText('골드 기준 금액')
    await user.clear(gold)
    await user.type(gold, '50000')
    expect(screen.getByText('골드: 기준 금액은 아래 등급보다 커야 합니다')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(update).not.toHaveBeenCalled()
  })

  it('saves the full list with coupon ids and shows the server message on failure', async () => {
    vi.spyOn(coupons, 'searchCoupons').mockResolvedValue({
      content: [
        {
          id: 9, name: '골드 5천원', code: null, discountType: 'FIXED', discountValue: 5000, maxDiscount: null, minOrderAmount: 0, scope: 'ALL', scopeLabel: '전체 상품',
          issueStart: '2026-09-01', issueEnd: '2026-12-31', validUntil: null, validDays: 30, totalQuantity: null, issuedCount: 0, usedCount: 0, downloadable: false, active: true, createdAt: null,
        },
      ],
      totalElements: 1, totalPages: 1, number: 0, size: 15,
    })
    const update = vi.spyOn(tiers, 'updateTiers').mockRejectedValueOnce(new ApiError(400, '{"message":"쿠폰 99 이 없습니다"}'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '골드 쿠폰 추가' }))
    await user.click(screen.getByRole('button', { name: '쿠폰 찾기' }))
    await user.click(await screen.findByRole('button', { name: '골드 5천원 추가' }))
    expect(within(screen.getByLabelText('골드 매월 쿠폰')).getByText('골드 5천원')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('쿠폰 99 이 없습니다')).toBeInTheDocument()
    const body = update.mock.calls[0][0]
    expect(body).toHaveLength(4)
    expect(body[2]).toEqual({ code: 'GOLD', name: '골드', color: '#64748B', minAmount: 300000, earnRate: 3, couponIds: [9] })

    update.mockResolvedValueOnce(TIERS.map((t) => (t.code === 'GOLD' ? { ...t, coupons: [{ id: 9, name: '골드 5천원', discountLabel: '5,000원' }] } : t)))
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했습니다')).toBeInTheDocument()
  })

  it('asks in place before re-running, then polls every 2s while RUNNING and stops when done', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const getRuns = vi.spyOn(tiers, 'getTierRuns')
    getRuns.mockResolvedValue(page([run(1, 'DONE')]))
    const start = vi.spyOn(tiers, 'startTierRun').mockResolvedValue(run(2, 'RUNNING'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()

    await user.click(await screen.findByRole('button', { name: '지금 다시 산정' }))
    const confirm = screen.getByRole('group', { name: '다시 산정 확인' })
    expect(start).not.toHaveBeenCalled()

    // 시작 직후 다시 읽은 목록은 아직 산정 중이다.
    getRuns.mockResolvedValue(page([run(2, 'RUNNING'), run(1, 'DONE')]))
    await user.click(within(confirm).getByRole('button', { name: '산정 시작' }))
    expect(start).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('산정 중')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '산정 중...' })).toBeDisabled()

    const callsBefore = getRuns.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(getRuns.mock.calls.length).toBe(callsBefore + 1)

    // 끝났다고 오면 폴링을 멈춘다.
    getRuns.mockResolvedValue(page([run(2, 'DONE'), run(1, 'DONE')]))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    await waitFor(() => expect(screen.queryByText('산정 중')).toBeNull())
    const callsAfterDone = getRuns.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(getRuns.mock.calls.length).toBe(callsAfterDone)
    // 끝나면 등급별 고객 수를 다시 읽는다.
    expect(tiers.getTiers).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: '지금 다시 산정' })).toBeEnabled()
  })

  it('shows the 409 message when a run is already going', async () => {
    vi.spyOn(tiers, 'startTierRun').mockRejectedValue(new ApiError(409, 'conflict'))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: '지금 다시 산정' }))
    await user.click(screen.getByRole('button', { name: '산정 시작' }))
    expect(await screen.findByText('이미 산정 중입니다')).toBeInTheDocument()
  })
})
