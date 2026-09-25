import { api, PAGE_SIZE } from './client'
import type { CouponSummary } from './coupons'
import type { Page } from './members'
import { formatPoints, type PointRule } from './points'
import type { ProductStatus } from './products'

/** 기획전(상품 묶음) · 이벤트(출석 체크 또는 쿠폰 받기). */
export type PromotionType = 'EXHIBITION' | 'EVENT'

/** 이벤트 종류. 만든 뒤에는 바꿀 수 없다. 기획전은 null. */
export type EventKind = 'ATTENDANCE' | 'COUPON'

export const EVENT_KIND_LABELS: Record<EventKind, string> = { ATTENDANCE: '출석 체크', COUPON: '쿠폰 받기' }

/** 이벤트·기획전에 걸 수 있는 쿠폰 수. 쿠폰 받기 이벤트는 1개 이상. */
export const MAX_PROMOTION_COUPONS = 10

/** 오늘(Asia/Seoul) 기준으로 서버가 매긴다. 시작 전 · 기간 안 · 종료 후. */
export type PromotionStatus = 'UPCOMING' | 'ONGOING' | 'ENDED'

export const TYPE_LABELS: Record<PromotionType, string> = { EXHIBITION: '기획전', EVENT: '이벤트' }

/** 목록의 종류 글자. 이벤트는 종류까지 붙인다: "이벤트 · 출석" | "이벤트 · 쿠폰". */
export const promotionKindLabel = (p: { type: PromotionType; eventKind?: EventKind | null }) =>
  p.type === 'EVENT' && p.eventKind ? `이벤트 · ${p.eventKind === 'COUPON' ? '쿠폰' : '출석'}` : TYPE_LABELS[p.type]

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = { UPCOMING: '예정', ONGOING: '진행 중', ENDED: '종료' }

export const promotionStatusClass = (status: PromotionStatus) =>
  status === 'ONGOING' ? 'status-badge status-badge--done' : status === 'UPCOMING' ? 'status-badge status-badge--shipping' : 'status-badge'

/** 앱 배너 기본색(브랜드 빨강). 배너 색을 비워 두면 앱이 이 색을 쓴다. */
export const DEFAULT_BANNER_COLOR = '#E11D48'

/** 어드민 목록 한 줄. 기간은 KST 날짜("YYYY-MM-DD"), createdAt/updatedAt 은 시간대 없는 UTC 시각이다. */
export interface PromotionSummary {
  id: number
  type: PromotionType
  /** 이벤트만. 기획전은 null. */
  eventKind: EventKind | null
  title: string
  startDate: string
  endDate: string
  status: PromotionStatus
  visible: boolean
  sortOrder: number
  productCount: number
  attendanceCount: number
  /** 기획전 쿠폰 또는 쿠폰 받기 이벤트의 쿠폰 수 */
  couponCount: number
  bannerImageUrl: string | null
  bannerColor: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** 기획전에 걸린 상품. 숨김 상품도 온다(앱에서는 빠진다). */
export interface PromotionProduct {
  id: number
  name: string
  imageUrl: string | null
  /** 판매가 */
  price: number
  /** 정가. 할인이 없으면 null. */
  listPrice: number | null
  /** HIDDEN 이면 앱 기획전에서 빠진다. */
  status: ProductStatus
}

export interface PromotionDetail extends PromotionSummary {
  subtitle: string | null
  description: string | null
  pointRuleCode: string | null
  rewardPoints: number | null
  products: PromotionProduct[]
  /** 기획전 쿠폰(0..10) 또는 쿠폰 받기 이벤트의 쿠폰(1..10). */
  coupons: CouponSummary[]
}

/**
 * 등록·수정 본문. productIds 는 기획전만, eventKind 는 이벤트만(만든 뒤 못 바꿈),
 * pointRuleCode·rewardPoints 는 출석 체크만, couponIds 는 기획전(0..10)과 쿠폰 받기(1..10)만 쓴다.
 */
export interface PromotionInput {
  type: PromotionType
  title: string
  subtitle: string | null
  description: string | null
  bannerImageUrl: string | null
  bannerColor: string | null
  startDate: string
  endDate: string
  visible: boolean
  sortOrder: number
  productIds?: number[]
  eventKind?: EventKind
  pointRuleCode?: string | null
  rewardPoints?: number | null
  couponIds?: number[]
}

/** 출석 한 건. checkDate 는 KST 날짜, createdAt 은 UTC 시각. */
export interface Attendance {
  userId: string
  checkDate: string
  rewardPoints: number
  rewardMessage: string | null
  createdAt: string | null
}

export interface PromotionFilter {
  type?: PromotionType | null
}

const BASE = '/commerce-service/api-admin/v1/promotions'

export const searchPromotions = (keyword: string, page: number, filter: PromotionFilter = {}) => {
  const params = new URLSearchParams({ q: keyword, page: String(page), size: String(PAGE_SIZE) })
  if (filter.type) params.set('type', filter.type)
  return api<Page<PromotionSummary>>(`${BASE}?${params.toString()}`)
}

export const getPromotion = (id: string) => api<PromotionDetail>(`${BASE}/${encodeURIComponent(id)}`)

export const createPromotion = (input: PromotionInput) => api<PromotionDetail>(BASE, { method: 'POST', body: JSON.stringify(input) })

export const updatePromotion = (id: string, input: PromotionInput) =>
  api<PromotionDetail>(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })

export const deletePromotion = (id: string) => api<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const getAttendances = (id: string, page: number) =>
  api<Page<Attendance>>(`${BASE}/${encodeURIComponent(id)}/attendances?page=${page}&size=${PAGE_SIZE}`)

/** "2026-10-01" → "2026.10.01". 날짜만 있는 KST 값이라 시간대 변환을 하지 않는다. */
export const formatPromotionDate = (date: string) => date.replace(/-/g, '.')

export const formatPeriod = (start: string, end: string) => `${formatPromotionDate(start)} ~ ${formatPromotionDate(end)}`

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

/**
 * 폼 값 검사. 서버 규칙(제목 1..60, 부제 ..100, 설명 ..2000, #RRGGBB, 종료 ≥ 시작, 기획전 상품 1..100)을 먼저 본다.
 * 통과하면 null, 아니면 첫 번째 이유.
 */
export function validatePromotion(input: PromotionInput): string | null {
  if (input.title.length === 0) return '제목을 입력하세요'
  if (input.title.length > 60) return '제목은 60자까지입니다'
  if ((input.subtitle ?? '').length > 100) return '부제는 100자까지입니다'
  if ((input.description ?? '').length > 2000) return '설명은 2000자까지입니다'
  if (input.bannerColor !== null && !HEX_COLOR.test(input.bannerColor)) return '배너 색은 #RRGGBB 형식이어야 합니다'
  if (!input.startDate || !input.endDate) return '시작일과 종료일을 입력하세요'
  if (input.endDate < input.startDate) return '종료일은 시작일보다 빠를 수 없습니다'
  if (!Number.isInteger(input.sortOrder)) return '순서는 정수여야 합니다'
  if (input.type === 'EXHIBITION') {
    const count = input.productIds?.length ?? 0
    if (count === 0) return '기획전에는 상품을 1개 이상 넣어야 합니다'
    if (count > 100) return '기획전 상품은 100개까지입니다'
    if ((input.couponIds?.length ?? 0) > MAX_PROMOTION_COUPONS) return `기획전 쿠폰은 ${MAX_PROMOTION_COUPONS}개까지입니다`
  }
  if (input.type === 'EVENT' && input.eventKind === 'COUPON') {
    const count = input.couponIds?.length ?? 0
    if (count === 0) return '쿠폰 받기 이벤트에는 쿠폰을 1개 이상 넣어야 합니다'
    if (count > MAX_PROMOTION_COUPONS) return `이벤트 쿠폰은 ${MAX_PROMOTION_COUPONS}개까지입니다`
  }
  return null
}

/** 보상 규칙 선택지 글자. "출석 체크 (DAILY_CHECKIN) · 10 P · 하루 1회" */
export const ruleOptionLabel = (r: PointRule) =>
  `${r.name} (${r.code}) · ${formatPoints(r.points)} · ${r.dailyLimit == null ? '하루 무제한' : `하루 ${r.dailyLimit}회`}`
