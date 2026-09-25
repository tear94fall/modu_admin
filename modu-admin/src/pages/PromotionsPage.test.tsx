import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as promotions from '../api/promotions'
import { mockViewport } from '../test/viewport'
import PromotionsPage from './PromotionsPage'

const autumn: promotions.PromotionSummary = {
  id: 3,
  type: 'EXHIBITION',
  eventKind: null,
  title: '가을 신상 기획전',
  startDate: '2026-09-20',
  endDate: '2026-10-05',
  status: 'ONGOING',
  visible: true,
  sortOrder: 0,
  productCount: 12,
  attendanceCount: 0,
  couponCount: 0,
  bannerImageUrl: 'https://img/autumn.png',
  bannerColor: '#E11D48',
  createdAt: '2026-09-19 03:00:00',
  updatedAt: '2026-09-19 03:00:00',
}

const checkin: promotions.PromotionSummary = {
  ...autumn,
  id: 4,
  type: 'EVENT',
  eventKind: 'ATTENDANCE',
  title: '10월 출석 체크',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  status: 'UPCOMING',
  visible: false,
  sortOrder: 2,
  productCount: 0,
  attendanceCount: 37,
  bannerImageUrl: null,
  bannerColor: '#2563EB',
}

const page = (content: promotions.PromotionSummary[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 15 })

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/promotions']}>
      <Routes>
        <Route path="/promotions" element={<PromotionsPage />} />
        <Route path="/promotions/:id" element={<p>상세 화면</p>} />
        <Route path="/promotions/new" element={<p>만들기 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('PromotionsPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('lists exhibitions and events with period, status, visibility, order and counts', async () => {
    vi.spyOn(promotions, 'searchPromotions').mockResolvedValue(page([autumn, checkin]))
    const { container } = renderPage()

    const autumnRow = (await screen.findByText('가을 신상 기획전')).closest('tr')!
    expect(within(autumnRow).getByText('기획전')).toBeInTheDocument()
    expect(within(autumnRow).getByText('2026.09.20 ~ 2026.10.05')).toBeInTheDocument()
    expect(within(autumnRow).getByText('진행 중')).toBeInTheDocument()
    expect(within(autumnRow).getByText('노출')).toBeInTheDocument()
    expect(within(autumnRow).getByText('상품 12개')).toBeInTheDocument()
    expect(autumnRow.querySelector('img.promotion-thumb')).toHaveAttribute('src', 'https://img/autumn.png')

    const eventRow = screen.getByText('10월 출석 체크').closest('tr')!
    expect(within(eventRow).getByText('이벤트 · 출석')).toBeInTheDocument()
    expect(within(eventRow).getByText('예정')).toBeInTheDocument()
    expect(within(eventRow).getByText('숨김')).toBeInTheDocument()
    expect(within(eventRow).getByText('출석 37회')).toBeInTheDocument()
    expect(within(eventRow).getByTestId('banner-swatch')).toHaveStyle({ background: '#2563EB' })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('shows 쿠폰 받기 events and exhibition coupons distinctly', async () => {
    const couponEvent: promotions.PromotionSummary = { ...checkin, id: 5, title: '웰컴 쿠폰팩', eventKind: 'COUPON', attendanceCount: 0, couponCount: 3 }
    vi.spyOn(promotions, 'searchPromotions').mockResolvedValue(page([{ ...autumn, couponCount: 2 }, couponEvent]))
    renderPage()

    const autumnRow = (await screen.findByText('가을 신상 기획전')).closest('tr')!
    expect(within(autumnRow).getByText('상품 12개 · 쿠폰 2장')).toBeInTheDocument()
    const couponRow = screen.getByText('웰컴 쿠폰팩').closest('tr')!
    expect(within(couponRow).getByText('이벤트 · 쿠폰')).toBeInTheDocument()
    expect(within(couponRow).getByText('쿠폰 3장')).toBeInTheDocument()
  })

  it('filters by type and searches by title from the first page', async () => {
    const search = vi.spyOn(promotions, 'searchPromotions').mockResolvedValue(page([autumn]))
    renderPage()
    await screen.findByText('가을 신상 기획전')
    expect(search).toHaveBeenLastCalledWith('', 0, { type: null })
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: '이벤트' }))
    expect(search).toHaveBeenLastCalledWith('', 0, { type: 'EVENT' })
    expect(screen.getByRole('button', { name: '이벤트' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.type(screen.getByLabelText('제목 검색'), ' 가을 ')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(search).toHaveBeenLastCalledWith('가을', 0, { type: 'EVENT' })
  })

  it('shows an empty message and links to 새로 만들기 and the detail', async () => {
    const search = vi.spyOn(promotions, 'searchPromotions').mockResolvedValue(page([]))
    renderPage()
    expect(await screen.findByText('등록된 기획전·이벤트가 없습니다')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '새로 만들기' })).toHaveAttribute('href', '/promotions/new')

    search.mockResolvedValue(page([autumn]))
    await userEvent.click(screen.getByRole('button', { name: '기획전' }))
    await userEvent.click(await screen.findByText('가을 신상 기획전'))
    expect(await screen.findByText('상세 화면')).toBeInTheDocument()
  })

  it('shows an error when the list fails', async () => {
    vi.spyOn(promotions, 'searchPromotions').mockRejectedValue(new Error('down'))
    renderPage()
    expect(await screen.findByText('기획전·이벤트 목록을 불러오지 못했습니다')).toBeInTheDocument()
  })

  describe('on a narrow screen', () => {
    let restore: () => void
    afterEach(() => restore())

    it('renders cards instead of a table', async () => {
      restore = mockViewport(true)
      vi.spyOn(promotions, 'searchPromotions').mockResolvedValue(page([checkin]))
      const { container } = renderPage()

      expect(await screen.findByText('[이벤트 · 출석] 10월 출석 체크')).toBeInTheDocument()
      expect(container.querySelector('table')).toBeNull()
      expect(screen.getByText('순서 2 · 출석 37회')).toBeInTheDocument()
      expect(screen.getByText('2026.10.01 ~ 2026.10.31')).toBeInTheDocument()
    })
  })
})
