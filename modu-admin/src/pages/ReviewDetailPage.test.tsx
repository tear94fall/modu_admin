import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as reviews from '../api/reviews'
import ReviewDetailPage from './ReviewDetailPage'

const detail: reviews.Review = {
  id: 7,
  productId: 20,
  productName: '모두 머그컵 세트',
  optionLabel: '화이트',
  productImageUrl: null,
  orderItemId: 5,
  userId: '11',
  authorName: '임준섭',
  authorEmail: 'me@modu.local',
  rating: 4,
  content: '머그컵이 튼튼하고 색이 예뻐요\n선물용으로도 좋아요',
  hidden: false,
  hiddenReason: null,
  mine: false,
  createdAt: '2026-09-23T05:00:00',
  updatedAt: '2026-09-23T05:00:00',
}

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={['/reviews/7']}>
      <Routes>
        <Route path="/reviews" element={<p>리뷰 목록 화면</p>} />
        <Route path="/reviews/:id" element={<ReviewDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('ReviewDetailPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows the review with product, author, stars and content', async () => {
    vi.spyOn(reviews, 'getReview').mockResolvedValue(detail)
    renderAt()

    expect(await screen.findByText('리뷰 #7')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '모두 머그컵 세트' })).toHaveAttribute('href', '/products/20')
    expect(screen.getByText('화이트')).toBeInTheDocument()
    expect(screen.getByLabelText('별점 4점')).toHaveTextContent('★★★★☆')
    expect(screen.getByText(/머그컵이 튼튼하고 색이 예뻐요/)).toBeInTheDocument()
    expect(screen.getByText('· me@modu.local')).toBeInTheDocument()
    expect(screen.getByText('노출')).toHaveClass('status-badge--selling')
    expect(screen.getByRole('button', { name: '숨기기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '노출하기' })).not.toBeInTheDocument()
  })

  it('hides with a reason and shows the hidden badge and reason', async () => {
    vi.spyOn(reviews, 'getReview').mockResolvedValue(detail)
    const set = vi.spyOn(reviews, 'setReviewHidden').mockResolvedValue({ ...detail, hidden: true, hiddenReason: '욕설 포함' })
    renderAt()

    await userEvent.click(await screen.findByRole('button', { name: '숨기기' }))
    await userEvent.type(screen.getByLabelText('숨김 사유'), '욕설 포함')
    await userEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(set).toHaveBeenCalledWith('7', true, '욕설 포함')
    expect(await screen.findByText('리뷰를 숨겼습니다')).toBeInTheDocument()
    expect(screen.getByText('숨김')).toHaveClass('status-badge--cancelled')
    expect(screen.getByText('숨김 사유: 욕설 포함')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '노출하기' })).toBeInTheDocument()
    expect(screen.queryByLabelText('숨김 사유')).not.toBeInTheDocument()
  })

  it('unhides a hidden review', async () => {
    vi.spyOn(reviews, 'getReview').mockResolvedValue({ ...detail, hidden: true, hiddenReason: '욕설 포함' })
    const set = vi.spyOn(reviews, 'setReviewHidden').mockResolvedValue(detail)
    renderAt()

    await userEvent.click(await screen.findByRole('button', { name: '노출하기' }))

    expect(set).toHaveBeenCalledWith('7', false, undefined)
    expect(await screen.findByText('리뷰를 다시 노출했습니다')).toBeInTheDocument()
    expect(screen.getByText('노출')).toHaveClass('status-badge--selling')
    expect(screen.getByRole('button', { name: '숨기기' })).toBeInTheDocument()
  })

  it('deletes after confirmation and goes back to the list', async () => {
    vi.spyOn(reviews, 'getReview').mockResolvedValue(detail)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const del = vi.spyOn(reviews, 'deleteReview').mockResolvedValue(undefined)
    renderAt()

    await userEvent.click(await screen.findByRole('button', { name: '삭제' }))

    expect(confirm).toHaveBeenCalledWith('리뷰를 삭제할까요? 되돌릴 수 없습니다.')
    expect(del).toHaveBeenCalledWith('7')
    expect(await screen.findByText('리뷰 목록 화면')).toBeInTheDocument()
  })

  it('shows the server message on 400 and 찾을 수 없음 on 404', async () => {
    vi.spyOn(reviews, 'getReview').mockResolvedValue(detail)
    vi.spyOn(reviews, 'setReviewHidden').mockRejectedValue(new ApiError(400, '{"message":"reason: 사유는 200자까지입니다."}'))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: '숨기기' }))
    await userEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(await screen.findByText('reason: 사유는 200자까지입니다.')).toBeInTheDocument()

    vi.spyOn(reviews, 'getReview').mockRejectedValue(new ApiError(404, ''))
    render(
      <MemoryRouter initialEntries={['/reviews/99']}>
        <Routes>
          <Route path="/reviews/:id" element={<ReviewDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('리뷰를 찾을 수 없습니다')).toBeInTheDocument()
  })
})
