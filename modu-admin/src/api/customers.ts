import { api, PAGE_SIZE } from './client'
import type { Page } from './members'
import type { TierSummary } from './tiers'

export type CustomerStatus = 'ACTIVE' | 'WITHDRAWN'
export type TierChangeReason = 'MONTHLY' | 'MANUAL' | 'JOIN'

/**
 * 커머스 고객 한 명. 시각(joinedAt·termsAgreedAt·privacyAgreedAt)은 시간대 없는 UTC 값.
 * name·email 은 회원 서비스에서 채운 값이라 없을 수 있다. migrated 는 약관 도입 전 이용 기록으로 만들어진 고객.
 */
export interface AdminCustomer {
  userId: string
  name: string | null
  email: string | null
  status: CustomerStatus
  tier: TierSummary
  /** 지금 등급을 정한 금액(지난 6개월 배송 완료). */
  basisAmount: number
  /** 이번 달을 포함한 최근 6개월 배송 완료 금액(다음 달 예상 등급의 기준). */
  rollingAmount: number
  joinedAt: string | null
  termsAgreedAt: string | null
  privacyAgreedAt: string | null
  migrated: boolean
}

export interface TierHistoryEntry {
  fromCode: string | null
  toCode: string
  basisAmount: number
  periodLabel: string | null
  changedAt: string | null
  reason: TierChangeReason
}

export interface AdminCustomerDetail extends AdminCustomer {
  /** 최신순, 최대 24건. */
  tierHistory: TierHistoryEntry[]
}

/** 회원 목록 배지용. 고객인 회원만 온다. */
export interface CustomerLookup {
  userId: string
  status: CustomerStatus
  tier: TierSummary
  agreed: boolean
}

export interface CustomerFilter {
  tier?: string | null
  agreed?: boolean | null
}

export const TIER_CHANGE_REASON_LABELS: Record<TierChangeReason, string> = { MONTHLY: '정기 산정', MANUAL: '수동 산정', JOIN: '가입' }

/** 서버가 한 번에 받아 주는 userId 수. */
export const MAX_LOOKUP = 100

const BASE = '/commerce-service/api-admin/v1/customers'

/** q 는 userId 앞부분. 가입일 최신순. */
export const searchCustomers = (q: string, page: number, filter: CustomerFilter = {}) => {
  const params = new URLSearchParams({ q, page: String(page), size: String(PAGE_SIZE) })
  if (filter.tier) params.set('tier', filter.tier)
  if (filter.agreed != null) params.set('agreed', String(filter.agreed))
  return api<Page<AdminCustomer>>(`${BASE}?${params.toString()}`)
}

export const getCustomer = (userId: string) => api<AdminCustomerDetail>(`${BASE}/${encodeURIComponent(userId)}`)

/** 회원 여러 명의 커머스 고객 여부. 비었으면 부르지 않고, 100명이 넘으면 나눠 부른다. userId → 결과. */
export async function lookupCustomers(userIds: string[]): Promise<Map<string, CustomerLookup>> {
  const unique = [...new Set(userIds.filter((id) => id))]
  const result = new Map<string, CustomerLookup>()
  for (let i = 0; i < unique.length; i += MAX_LOOKUP) {
    const chunk = unique.slice(i, i + MAX_LOOKUP)
    const found = await api<CustomerLookup[]>(`${BASE}/lookup?${new URLSearchParams({ userIds: chunk.join(',') }).toString()}`)
    for (const c of found ?? []) result.set(c.userId, c)
  }
  return result
}

export type CustomerOrderStatus = 'PAID' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED'

/** 회원 상세 커머스 탭의 최근 주문 한 줄. createdAt 은 UTC. itemSummary 는 "모두 다이어리 2027 외 1건". */
export interface CustomerRecentOrder {
  id: number
  orderNo: string
  status: CustomerOrderStatus
  paymentAmount: number
  createdAt: string | null
  itemSummary: string
}

/**
 * 회원 한 명의 커머스 요약. 고객이 아니어도 200 이고 숫자는 0, customer 는 null.
 * 포인트는 커머스가 아니라 point-service 것이라 늘 null 로 온다.
 */
export interface CustomerSummary {
  customer: AdminCustomer | null
  orderCounts: Record<CustomerOrderStatus, number>
  /** 배송 완료 주문의 결제 금액 합(전체 기간). */
  deliveredAmountTotal: number
  lastOrderAt: string | null
  /** 최신순 5건. */
  recentOrders: CustomerRecentOrder[]
  coupons: { available: number; used: number; expired: number }
  wishlistCount: number
  reviewCount: number
  points: null
}

export const getCustomerSummary = (userId: string) => api<CustomerSummary>(`${BASE}/${encodeURIComponent(userId)}/summary`)

/** 약관·개인정보 둘 다 동의했는지. */
export const isAgreed = (c: Pick<AdminCustomer, 'termsAgreedAt' | 'privacyAgreedAt'>) => !!c.termsAgreedAt && !!c.privacyAgreedAt
