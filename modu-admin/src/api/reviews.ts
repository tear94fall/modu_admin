import { api, PAGE_SIZE } from './client'
import type { Page } from './members'

/** commerce-service 의 리뷰 한 건(백오피스용이라 작성자 이름·이메일이 가려지지 않는다). */
export interface Review {
  id: number
  productId: number
  productName: string
  optionLabel: string
  productImageUrl: string | null
  orderItemId: number
  userId: string
  /** member-service 조회가 안 됐으면 '모두 회원' */
  authorName: string
  authorEmail: string | null
  rating: number
  content: string
  hidden: boolean
  hiddenReason: string | null
  mine: boolean
  createdAt: string | null
  updatedAt: string | null
}

export const HIDDEN_LABELS: Record<'visible' | 'hidden', string> = { visible: '노출', hidden: '숨김' }

export const hiddenLabel = (hidden: boolean) => (hidden ? HIDDEN_LABELS.hidden : HIDDEN_LABELS.visible)

export const hiddenClass = (hidden: boolean) => (hidden ? 'status-badge status-badge--cancelled' : 'status-badge status-badge--selling')

/** 5 → "★★★★★", 3 → "★★★☆☆". */
export const stars = (rating: number) => '★'.repeat(Math.max(0, Math.min(5, rating))) + '☆'.repeat(5 - Math.max(0, Math.min(5, rating)))

export interface ReviewFilter {
  rating?: number | null
  hidden?: boolean | null
  productId?: number | null
}

const BASE = '/commerce-service/api-admin/v1/reviews'

export const searchReviews = (keyword: string, page: number, filter: ReviewFilter = {}) => {
  const params = new URLSearchParams({ q: keyword, page: String(page), size: String(PAGE_SIZE) })
  if (filter.rating != null) params.set('rating', String(filter.rating))
  if (filter.hidden != null) params.set('hidden', String(filter.hidden))
  if (filter.productId != null) params.set('productId', String(filter.productId))
  return api<Page<Review>>(`${BASE}?${params.toString()}`)
}

export const getReview = (id: string) => api<Review>(`${BASE}/${encodeURIComponent(id)}`)

export const setReviewHidden = (id: string, hidden: boolean, reason?: string) =>
  api<Review>(`${BASE}/${encodeURIComponent(id)}/hidden`, { method: 'PATCH', body: JSON.stringify(reason ? { hidden, reason } : { hidden }) })

export const deleteReview = (id: string) => api<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
