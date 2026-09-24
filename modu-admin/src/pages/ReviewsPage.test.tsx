import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as reviews from '../api/reviews'
import ReviewsPage from './ReviewsPage'

const review = (over: Partial<reviews.Review> = {}): reviews.Review => ({
  id: 1,
  productId: 20,
  productName: '모두 머그컵 세트',
  optionLabel: '',
  productImageUrl: null,
  orderItemId: 5,
  userId: '11',
  authorName: '임준섭',
  authorEmail: 'me@modu.local',
  rating: 5,
  content: '머그컵이 튼튼하고 색이 예뻐요',
  hidden: false,
  hiddenReason: null,
  mine: false,
  createdAt: '2026-09-23T05:00:00',
  updatedAt: '2026-09-23T05:00:00',
  ...over,
})
const page = (content: reviews.Review[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 15 })

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/reviews']}>
      <Routes>
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/reviews/:id" element={<p>리뷰 상세 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('ReviewsPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('lists reviews with product, stars, author and status, and opens the detail', async () => {
    vi.spyOn(reviews, 'searchReviews').mockResolvedValue(
      page([review(), review({ id: 2, productName: '모두 베이직 티셔츠', optionLabel: '블랙 / M', authorName: '모두 회원', authorEmail: null, rating: 2, content: '배송이 느려요 포장도 찢어짐', hidden: true, hiddenReason: '고객센터 문의' })]),
    )
    renderPage()

    expect(await screen.findByText('모두 머그컵 세트')).toBeInTheDocument()
    expect(screen.getByText('임준섭')).toBeInTheDocument()
    expect(screen.getByText('me@modu.local')).toBeInTheDocument()
    expect(screen.getByText('모두 회원')).toBeInTheDocument()
    expect(screen.getByText('블랙 / M')).toBeInTheDocument()
    expect(screen.getByLabelText('별점 5점')).toHaveTextContent('★★★★★')
    expect(screen.getByLabelText('별점 2점')).toHaveTextContent('★★☆☆☆')
    // 필터 select 의 <option>노출/숨김</option> 과 겹치지 않게 표 안에서만 찾는다
    const table = within(screen.getByRole('table'))
    expect(table.getByText('노출')).toHaveClass('status-badge--selling')
    expect(table.getByText('숨김')).toHaveClass('status-badge--cancelled')

    await userEvent.click(screen.getByText('머그컵이 튼튼하고 색이 예뻐요'))
    expect(await screen.findByText('리뷰 상세 화면')).toBeInTheDocument()
  })

  it('passes the keyword, rating and hidden filters to the search', async () => {
    const search = vi.spyOn(reviews, 'searchReviews').mockResolvedValue(page([]))
    renderPage()

    expect(await screen.findByText('리뷰가 없습니다')).toBeInTheDocument()
    expect(search).toHaveBeenLastCalledWith('', 0, { rating: null, hidden: null })

    await userEvent.selectOptions(screen.getByLabelText('별점'), '3')
    expect(search).toHaveBeenLastCalledWith('', 0, { rating: 3, hidden: null })

    await userEvent.selectOptions(screen.getByLabelText('노출 상태'), 'hidden')
    expect(search).toHaveBeenLastCalledWith('', 0, { rating: 3, hidden: true })

    await userEvent.type(screen.getByLabelText('리뷰 검색'), '머그컵')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(search).toHaveBeenLastCalledWith('머그컵', 0, { rating: 3, hidden: true })
    expect(await screen.findByText('검색 결과가 없습니다')).toBeInTheDocument()
  })

  it('shows an error when the list cannot be loaded', async () => {
    vi.spyOn(reviews, 'searchReviews').mockRejectedValue(new Error('down'))
    renderPage()

    expect(await screen.findByText('리뷰 목록을 불러오지 못했습니다')).toBeInTheDocument()
  })
})
