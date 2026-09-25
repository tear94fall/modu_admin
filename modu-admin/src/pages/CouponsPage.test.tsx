import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as coupons from '../api/coupons'
import { mockViewport } from '../test/viewport'
import CouponsPage from './CouponsPage'

const welcome: coupons.CouponSummary = {
  id: 7,
  name: '웰컴 3천원',
  code: 'WELCOME',
  discountType: 'FIXED',
  discountValue: 3000,
  maxDiscount: null,
  minOrderAmount: 10000,
  scope: 'ALL',
  scopeLabel: '전체 상품',
  issueStart: '2026-10-01',
  issueEnd: '2026-10-31',
  validUntil: '2026-11-30',
  validDays: null,
  totalQuantity: 100,
  issuedCount: 12,
  usedCount: 3,
  downloadable: true,
  active: true,
  createdAt: '2026-09-25 01:00:00',
}

const stationery: coupons.CouponSummary = {
  ...welcome,
  id: 8,
  name: '문구 10%',
  code: null,
  discountType: 'PERCENT',
  discountValue: 10,
  maxDiscount: 5000,
  minOrderAmount: 0,
  scope: 'CATEGORY',
  scopeLabel: "'문구' 카테고리",
  validUntil: null,
  validDays: 7,
  totalQuantity: null,
  issuedCount: 40,
  usedCount: 0,
  downloadable: false,
  active: false,
}

const page = (content: coupons.CouponSummary[], totalPages = 1) => ({ content, totalElements: content.length, totalPages, number: 0, size: 15 })

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/coupons']}>
      <Routes>
        <Route path="/coupons" element={<CouponsPage />} />
        <Route path="/coupons/:id" element={<p>수정 화면</p>} />
        <Route path="/coupons/new" element={<p>만들기 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('CouponsPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('lists coupons with discount, minimum order, scope, periods, counts, visibility and status', async () => {
    vi.spyOn(coupons, 'searchCoupons').mockResolvedValue(page([welcome, stationery]))
    const { container } = renderPage()

    const row = (await screen.findByText('웰컴 3천원')).closest('tr')!
    expect(within(row).getByText('WELCOME')).toBeInTheDocument()
    expect(within(row).getByText('3,000원')).toBeInTheDocument()
    expect(within(row).getByText('10,000원 이상')).toBeInTheDocument()
    expect(within(row).getByText('전체 상품')).toBeInTheDocument()
    expect(within(row).getByText('2026.10.01 ~ 2026.10.31')).toBeInTheDocument()
    expect(within(row).getByText('2026.11.30까지')).toBeInTheDocument()
    expect(within(row).getByText('12 / 100장 · 사용 3')).toBeInTheDocument()
    expect(within(row).getByText('노출')).toBeInTheDocument()
    expect(within(row).getByText('활성')).toBeInTheDocument()

    const other = screen.getByText('문구 10%').closest('tr')!
    expect(within(other).getByText('10% (최대 5,000원)')).toBeInTheDocument()
    expect(within(other).getByText('없음')).toBeInTheDocument()
    expect(within(other).getByText("'문구' 카테고리")).toBeInTheDocument()
    expect(within(other).getByText('받은 날부터 7일')).toBeInTheDocument()
    expect(within(other).getByText('40장 / 무제한 · 사용 0')).toBeInTheDocument()
    expect(within(other).getByText('숨김')).toBeInTheDocument()
    expect(within(other).getByText('비활성')).toBeInTheDocument()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('filters by 활성 and searches from the first page', async () => {
    const search = vi.spyOn(coupons, 'searchCoupons').mockResolvedValue(page([welcome], 3))
    renderPage()
    await screen.findByText('웰컴 3천원')
    expect(search).toHaveBeenLastCalledWith('', 0, { active: null })
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(search).toHaveBeenLastCalledWith('', 1, { active: null })

    await userEvent.click(screen.getByRole('button', { name: '비활성' }))
    expect(search).toHaveBeenLastCalledWith('', 0, { active: false })
    expect(screen.getByRole('button', { name: '비활성' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '활성' }))
    expect(search).toHaveBeenLastCalledWith('', 0, { active: true })

    await userEvent.type(screen.getByLabelText('쿠폰 검색'), ' WELCOME ')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(search).toHaveBeenLastCalledWith('WELCOME', 0, { active: true })
  })

  it('shows an empty message, links to 새 쿠폰 and opens a coupon', async () => {
    const search = vi.spyOn(coupons, 'searchCoupons').mockResolvedValue(page([]))
    renderPage()
    expect(await screen.findByText('등록된 쿠폰이 없습니다')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '새 쿠폰' })).toHaveAttribute('href', '/coupons/new')

    await userEvent.click(screen.getByRole('button', { name: '활성' }))
    expect(await screen.findByText('검색 결과가 없습니다')).toBeInTheDocument()

    search.mockResolvedValue(page([welcome]))
    await userEvent.click(screen.getByRole('button', { name: '전체' }))
    await userEvent.click(await screen.findByText('웰컴 3천원'))
    expect(await screen.findByText('수정 화면')).toBeInTheDocument()
  })

  it('shows an error when the list fails', async () => {
    vi.spyOn(coupons, 'searchCoupons').mockRejectedValue(new Error('down'))
    renderPage()
    expect(await screen.findByText('쿠폰 목록을 불러오지 못했습니다')).toBeInTheDocument()
  })

  describe('on a narrow screen', () => {
    let restore: () => void
    afterEach(() => restore())

    it('renders cards instead of a table', async () => {
      restore = mockViewport(true)
      vi.spyOn(coupons, 'searchCoupons').mockResolvedValue(page([stationery]))
      const { container } = renderPage()

      expect(await screen.findByText('문구 10%')).toBeInTheDocument()
      expect(container.querySelector('table')).toBeNull()
      expect(screen.getByText("10% (최대 5,000원) · 최소 주문 없음 · '문구' 카테고리")).toBeInTheDocument()
      expect(screen.getByText('발급 2026.10.01 ~ 2026.10.31 · 사용 받은 날부터 7일')).toBeInTheDocument()
      expect(screen.getByText('40장 / 무제한 · 사용 0')).toBeInTheDocument()
    })
  })
})
