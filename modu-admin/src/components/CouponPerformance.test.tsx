import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as coupons from '../api/coupons'
import CouponPerformanceSection from './CouponPerformance'

describe('CouponPerformanceSection', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows usage rate, coupon orders, discount and revenue with sources and the usage trend', async () => {
    vi.spyOn(coupons, 'getCouponPerformance').mockResolvedValue({
      couponId: 7,
      issued: 10,
      used: 3,
      available: 5,
      expired: 2,
      usageRate: 30,
      bySource: [
        { source: 'DOWNLOAD', count: 8 },
        { source: 'ADMIN', count: 2 },
      ],
      orders: 2,
      cancelledOrders: 1,
      discountTotal: 5000,
      revenue: 44000,
      avgOrderAmount: 22000,
      zone: 'Asia/Seoul',
      days: 14,
      usedByDay: [
        { date: '2026-10-22', count: 1 },
        { date: '2026-10-23', count: 1 },
      ],
    })

    render(<CouponPerformanceSection couponId="7" coupon={{ issuedCount: 1, totalQuantity: 500 }} />)

    const section = await screen.findByRole('region', { name: '성과' })
    expect(coupons.getCouponPerformance).toHaveBeenCalledWith('7', 14, expect.any(String))
    expect(within(section).getByText('발급').nextElementSibling).toHaveTextContent('10장')
    expect(within(section).getByText('총 500장 중 · 남은 499장')).toBeInTheDocument()
    expect(within(section).getByText('사용률').nextElementSibling).toHaveTextContent('30%')
    expect(within(section).getByText('사용 3 · 사용 가능 5 · 만료 2')).toBeInTheDocument()
    expect(within(section).getByText('쿠폰 주문').nextElementSibling).toHaveTextContent('2건')
    expect(within(section).getByText('취소 1건 제외')).toBeInTheDocument()
    expect(within(section).getByText('매출 기여').nextElementSibling).toHaveTextContent('44,000원')
    expect(within(section).getByText('할인 총액 5,000원')).toBeInTheDocument()
    expect(within(section).getByText('주문당 실결제액').nextElementSibling).toHaveTextContent('22,000원')
    expect(within(section).getByText('주문당 할인').nextElementSibling).toHaveTextContent('2,500원')
    expect(within(section).getByText('받기 8장')).toBeInTheDocument()
    expect(within(section).getByLabelText('14일 사용 추이')).toBeInTheDocument()
  })

  it('shows an error text when the server fails', async () => {
    vi.spyOn(coupons, 'getCouponPerformance').mockRejectedValue(new ApiError(500, ''))
    render(<CouponPerformanceSection couponId="7" coupon={{ issuedCount: 1, totalQuantity: 500 }} />)
    await waitFor(() => expect(screen.getByText('성과를 불러오지 못했습니다')).toBeInTheDocument())
  })
})
