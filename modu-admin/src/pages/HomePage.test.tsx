import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as stats from '../api/stats'
import HomePage from './HomePage'

const days = ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']

const renderPage = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )

describe('HomePage', () => {
  beforeEach(() => {
    vi.spyOn(stats, 'getMemberStats').mockResolvedValue({
      zone: 'Asia/Seoul',
      days: days.map((date, i) => ({ date, signups: i === 6 ? 3 : i === 5 ? 1 : 0 })),
      totalMembers: 42,
      active: [
        { service: 'CHAT', today: 5, week: 9 },
        { service: 'COMMERCE', today: 2, week: 4 },
      ],
    })
    vi.spyOn(stats, 'getChatStats').mockResolvedValue({
      zone: 'Asia/Seoul',
      days: days.map((date, i) => ({ date, messages: i === 6 ? 120 : 10, roomsCreated: 0 })),
    })
    vi.spyOn(stats, 'getOrderStats').mockResolvedValue({
      zone: 'Asia/Seoul',
      days: days.map((date, i) => ({ date, orders: i === 6 ? 2 : 0, amount: i === 6 ? 35000 : 0, couponUsed: 0, cancelled: 0 })),
    })
    vi.spyOn(stats, 'getPointStats').mockRejectedValue(new ApiError(503, 'down'))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('shows each service section with today, delta and 7-day totals, and an error only for the failed one', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('42명')).toBeInTheDocument())
    expect(stats.getMemberStats).toHaveBeenCalledWith(7, expect.any(String))

    expect(screen.getByRole('heading', { name: '지표' })).toBeInTheDocument()

    // 맨 위 요약: 오늘 값 + 어제 대비 + 7일 합
    const hero = screen.getByRole('region', { name: '오늘 요약' })
    expect(within(hero).getByText('신규 가입').nextElementSibling).toHaveTextContent('3명')
    expect(within(hero).getByText('+2 (+200%)')).toBeInTheDocument()
    expect(within(hero).getByText('7일 4명')).toBeInTheDocument()
    expect(within(hero).getByText('실결제액').nextElementSibling).toHaveTextContent('35,000원')

    const member = screen.getByRole('region', { name: '회원' })
    expect(within(member).getByText('신규 가입').nextElementSibling).toHaveTextContent('3명')
    expect(within(member).getByText('7일 9명')).toBeInTheDocument()
    expect(within(member).getByLabelText('7일 추이')).toBeInTheDocument()

    const chat = screen.getByRole('region', { name: '메신저' })
    expect(within(chat).getByText('보낸 메시지').nextElementSibling).toHaveTextContent('120건')
    expect(within(chat).getByText('180건')).toBeInTheDocument()

    const commerce = screen.getByRole('region', { name: '커머스' })
    expect(within(commerce).getByText('실결제액').nextElementSibling).toHaveTextContent('35,000원')

    await waitFor(() => expect(screen.getByText('포인트 지표를 불러오지 못했습니다')).toBeInTheDocument())
    expect(screen.getByText(/10\.17 ~ 10\.23/)).toBeInTheDocument()
  })

  it('changing the period reloads every service with that many days and remembers the choice', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('42명')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '7일' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: '30일' }))

    await waitFor(() => expect(stats.getMemberStats).toHaveBeenLastCalledWith(30, expect.any(String)))
    expect(stats.getChatStats).toHaveBeenLastCalledWith(30, expect.any(String))
    expect(stats.getOrderStats).toHaveBeenLastCalledWith(30, expect.any(String))
    expect(stats.getPointStats).toHaveBeenLastCalledWith(30, expect.any(String))
    expect(screen.getByRole('button', { name: '30일' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('modu-admin-metrics-days')).toBe('30')
    await waitFor(() => expect(screen.getByText(/오늘 포함 30일/)).toBeInTheDocument())
  })
})
