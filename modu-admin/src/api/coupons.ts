import { api, PAGE_SIZE } from './client'
import type { Page } from './members'
import { formatPeriod, formatPromotionDate } from './promotions'
import { formatPrice } from '../util/format'

/** 정액(원) · 정률(%, 최대 할인으로 상한). */
export type DiscountType = 'FIXED' | 'PERCENT'

/** 적용 범위. 카테고리는 하위 카테고리까지 포함한다. */
export type CouponScope = 'ALL' | 'CATEGORY' | 'PRODUCT'

/** 회원이 쿠폰을 받은 경로. */
export type CouponSource = 'DOWNLOAD' | 'CODE' | 'ADMIN' | 'EVENT'

export type UserCouponStatus = 'AVAILABLE' | 'USED' | 'EXPIRED'

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = { FIXED: '정액', PERCENT: '정률' }

export const SCOPE_LABELS: Record<CouponScope, string> = { ALL: '전체', CATEGORY: '카테고리', PRODUCT: '상품' }

export const SOURCE_LABELS: Record<CouponSource, string> = { DOWNLOAD: '받기', CODE: '코드', ADMIN: '관리자', EVENT: '이벤트' }

export const ISSUE_STATUS_LABELS: Record<UserCouponStatus, string> = { AVAILABLE: '사용 가능', USED: '사용함', EXPIRED: '만료' }

export const issueStatusClass = (status: UserCouponStatus) =>
  status === 'AVAILABLE' ? 'status-badge status-badge--selling' : status === 'USED' ? 'status-badge status-badge--done' : 'status-badge'

/**
 * 어드민 목록 한 줄. 날짜(issueStart·issueEnd·validUntil)는 KST 날짜 "YYYY-MM-DD", createdAt 은 시간대 없는 UTC 시각.
 * 사용 기한은 validUntil(날짜까지) 과 validDays(받은 날부터 N일) 중 하나만 있다.
 */
export interface CouponSummary {
  id: number
  name: string
  code: string | null
  discountType: DiscountType
  discountValue: number
  maxDiscount: number | null
  minOrderAmount: number
  scope: CouponScope
  /** "전체 상품" | "'문구' 카테고리" | "지정 상품 3개" */
  scopeLabel: string
  issueStart: string
  issueEnd: string
  validUntil: string | null
  validDays: number | null
  /** null 이면 무제한 */
  totalQuantity: number | null
  issuedCount: number
  usedCount: number
  downloadable: boolean
  active: boolean
  createdAt: string | null
}

export interface ScopeTarget {
  id: number
  name: string
}

export interface CouponDetail extends CouponSummary {
  description: string | null
  scopeIds: number[]
  /** scopeIds 의 이름(카테고리명 또는 상품명). */
  scopeTargets: ScopeTarget[]
}

/** 등록·수정 본문. */
export interface CouponInput {
  name: string
  description: string | null
  discountType: DiscountType
  discountValue: number
  /** 정률만. 정액이면 null. */
  maxDiscount: number | null
  minOrderAmount: number
  scope: CouponScope
  /** 전체면 빈 배열 */
  scopeIds: number[]
  issueStart: string
  issueEnd: string
  validUntil: string | null
  validDays: number | null
  totalQuantity: number | null
  code: string | null
  downloadable: boolean
  active: boolean
}

/** 발급 한 건. issuedAt/usedAt 은 UTC 시각, expiresOn 은 KST 날짜. */
export interface CouponIssue {
  id: number
  userId: string
  source: CouponSource
  status: UserCouponStatus
  issuedAt: string | null
  expiresOn: string
  usedAt: string | null
  orderId: number | null
  orderNo: string | null
}

export interface GrantResult {
  issued: number
  skipped: { userId: string; reason: string }[]
}

export interface CouponFilter {
  active?: boolean | null
}

/** 한 번에 지급할 수 있는 회원 수(서버 규칙). */
export const MAX_GRANT = 100

const BASE = '/commerce-service/api-admin/v1/coupons'

export const searchCoupons = (keyword: string, page: number, filter: CouponFilter = {}) => {
  const params = new URLSearchParams({ q: keyword, page: String(page), size: String(PAGE_SIZE) })
  if (filter.active != null) params.set('active', String(filter.active))
  return api<Page<CouponSummary>>(`${BASE}?${params.toString()}`)
}

export const getCoupon = (id: string) => api<CouponDetail>(`${BASE}/${encodeURIComponent(id)}`)

export const createCoupon = (input: CouponInput) => api<CouponDetail>(BASE, { method: 'POST', body: JSON.stringify(input) })

export const updateCoupon = (id: string, input: CouponInput) =>
  api<CouponDetail>(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })

export const deleteCoupon = (id: string) => api<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const getCouponIssues = (id: string, page: number, status: UserCouponStatus | null = null) => {
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
  if (status) params.set('status', status)
  return api<Page<CouponIssue>>(`${BASE}/${encodeURIComponent(id)}/issues?${params.toString()}`)
}

export const grantCoupon = (id: string, userIds: string[]) =>
  api<GrantResult>(`${BASE}/${encodeURIComponent(id)}/issues`, { method: 'POST', body: JSON.stringify({ userIds }) })

type DiscountFields = Pick<CouponSummary, 'discountType' | 'discountValue' | 'maxDiscount'>

/** "3,000원" | "10%" | "10% (최대 5,000원)" */
export const discountLabel = (c: DiscountFields) =>
  c.discountType === 'FIXED'
    ? formatPrice(c.discountValue)
    : `${c.discountValue}%${c.maxDiscount != null ? ` (최대 ${formatPrice(c.maxDiscount)})` : ''}`

/** "2026.10.31까지" | "받은 날부터 7일" */
export const expiryLabel = (c: Pick<CouponSummary, 'validUntil' | 'validDays'>) =>
  c.validUntil ? `${formatPromotionDate(c.validUntil)}까지` : c.validDays != null ? `받은 날부터 ${c.validDays}일` : '-'

/** "없음" | "10,000원 이상" */
export const minOrderLabel = (amount: number) => (amount > 0 ? `${formatPrice(amount)} 이상` : '없음')

/** "12 / 100장 · 사용 3" | "12장 / 무제한 · 사용 3" */
export const quantityLabel = (c: Pick<CouponSummary, 'issuedCount' | 'totalQuantity' | 'usedCount'>) =>
  `${c.totalQuantity != null ? `${c.issuedCount} / ${c.totalQuantity}장` : `${c.issuedCount}장 / 무제한`} · 사용 ${c.usedCount}`

export const issuePeriodLabel = (c: Pick<CouponSummary, 'issueStart' | 'issueEnd'>) => formatPeriod(c.issueStart, c.issueEnd)

export const COUPON_CODE = /^[A-Z0-9]{4,20}$/

const isWhole = (n: number) => Number.isInteger(n)

/**
 * 폼 값 검사. 서버 규칙(이름 1..40, 설명 ..200, 정률 1..90%, 최소 주문 ≥ 0, 범위 대상, 종료 ≥ 시작,
 * 사용 기한 하나, 수량 ≥ 1, 코드 A-Z0-9 4..20)을 먼저 본다. 통과하면 null, 아니면 첫 번째 이유.
 */
export function validateCoupon(input: CouponInput): string | null {
  if (input.name.length === 0) return '쿠폰 이름을 입력하세요'
  if (input.name.length > 40) return '쿠폰 이름은 40자까지입니다'
  if ((input.description ?? '').length > 200) return '설명은 200자까지입니다'
  if (!isWhole(input.discountValue) || input.discountValue < 1) return '할인 값을 1 이상의 정수로 입력하세요'
  if (input.discountType === 'PERCENT') {
    if (input.discountValue > 90) return '할인율은 1~90% 사이여야 합니다'
    if (input.maxDiscount != null && (!isWhole(input.maxDiscount) || input.maxDiscount < 1)) return '최대 할인은 1원 이상의 정수여야 합니다'
  }
  if (!isWhole(input.minOrderAmount) || input.minOrderAmount < 0) return '최소 주문 금액은 0 이상의 정수여야 합니다'
  if (input.scope === 'CATEGORY' && input.scopeIds.length === 0) return '적용할 카테고리를 1개 이상 고르세요'
  if (input.scope === 'PRODUCT' && input.scopeIds.length === 0) return '적용할 상품을 1개 이상 고르세요'
  if (!input.issueStart || !input.issueEnd) return '발급 시작일과 종료일을 입력하세요'
  if (input.issueEnd < input.issueStart) return '발급 종료일은 시작일보다 빠를 수 없습니다'
  if ((input.validUntil == null) === (input.validDays == null)) return '사용 기한을 입력하세요'
  if (input.validUntil != null && input.validUntil < input.issueStart) return '사용 기한은 발급 시작일보다 빠를 수 없습니다'
  if (input.validDays != null && (!isWhole(input.validDays) || input.validDays < 1)) return '사용 기한 일수는 1 이상의 정수여야 합니다'
  if (input.totalQuantity != null && (!isWhole(input.totalQuantity) || input.totalQuantity < 1)) return '총 수량은 1 이상의 정수여야 합니다 (비우면 무제한)'
  if (input.code != null && !COUPON_CODE.test(input.code)) return '쿠폰 코드는 영문 대문자·숫자 4~20자입니다'
  return null
}
