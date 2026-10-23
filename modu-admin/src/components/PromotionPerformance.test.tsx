import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as promotions from '../api/promotions'
import PromotionPerformanceSection from './PromotionPerformance'

describe('PromotionPerformanceSection', () => {
  afterEach(() => vi.restoreAllMocks())

  it('exhibition: sales, orders, units and a per-product table', async () => {
    vi.spyOn(promotions, 'getPromotionPerformance').mockResolvedValue({
      promotionId: 5,
      exhibition: {
        orders: 2,
        cancelledOrders: 1,
        units: 6,
        sales: 22000,
        products: [
          { productId: 102, name: '노트', units: 4, sales: 12000 },
          { productId: 101, name: '머그', units: 2, sales: 10000 },
        ],
      },
      attendance: null,
      coupons: null,
    })
    render(<PromotionPerformanceSection promotionId="5" />)
    const section = await screen.findByRole('region', { name: '성과' })
    expect(within(section).getByText('상품 매출').nextElementSibling).toHaveTextContent('22,000원')
    expect(within(section).getByText('주문').nextElementSibling).toHaveTextContent('2건')
    expect(within(section).getByText('판매 수량').nextElementSibling).toHaveTextContent('6개')
    const rows = within(section).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual(['노트412,000원', '머그210,000원'])
  })

  it('attendance: participants, checks, points and the per-day bars', async () => {
    vi.spyOn(promotions, 'getPromotionPerformance').mockResolvedValue({
      promotionId: 6,
      exhibition: null,
      attendance: { participants: 2, checks: 3, rewardPoints: 70, byDay: [{ date: '2026-10-01', count: 1 }, { date: '2026-10-02', count: 2 }] },
      coupons: null,
    })
    render(<PromotionPerformanceSection promotionId="6" />)
    const section = await screen.findByRole('region', { name: '성과' })
    expect(within(section).getByText('참여자').nextElementSibling).toHaveTextContent('2명')
    expect(within(section).getByText('1인당 1.5회')).toBeInTheDocument()
    expect(within(section).getByText('지급 포인트').nextElementSibling).toHaveTextContent('70P')
    expect(within(section).getByText('출석한 날').nextElementSibling).toHaveTextContent('2일')
    expect(within(section).getByLabelText('날짜별 출석')).toBeInTheDocument()
  })

  it('coupon event: one row per coupon with usage rate', async () => {
    vi.spyOn(promotions, 'getPromotionPerformance').mockResolvedValue({
      promotionId: 8,
      exhibition: null,
      attendance: null,
      coupons: [
        { couponId: 1, name: '가을 5천원', issued: 10, used: 4 },
        { couponId: 2, name: '무료배송', issued: 0, used: 0 },
      ],
    })
    render(<PromotionPerformanceSection promotionId="8" />)
    const section = await screen.findByRole('region', { name: '성과' })
    expect(within(section).getByText('받아 간 쿠폰').nextElementSibling).toHaveTextContent('10장')
    expect(within(section).getByText('사용률 40%')).toBeInTheDocument()
    const rows = within(section).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual(['가을 5천원10장4장40%', '무료배송0장0장–'])
  })
})
