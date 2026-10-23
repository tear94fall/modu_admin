import { api, PAGE_SIZE } from './client'
import type { Page } from './members'

export type OrderStatus = 'PAID' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PAID: '결제완료',
  SHIPPING: '배송중',
  DELIVERED: '배송완료',
  CANCELLED: '취소',
}

/** 서버(Order.transition)가 허용하는 다음 상태. 화면은 이것만 버튼으로 보여 준다. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PAID: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

export interface OrderSummary {
  id: number
  orderNo: string
  userId: string
  status: OrderStatus
  totalAmount: number
  /** 결제에 쓴 포인트(1P = 1원). */
  pointAmount: number
  /** 실제 결제 금액 = 상품 금액 − 포인트. */
  paymentAmount: number
  itemCount: number
  firstItemName: string
  firstImageUrl: string | null
  createdAt: string | null
}

export interface OrderItem {
  id: number
  productId: number
  skuId: number
  productName: string
  optionLabel: string
  imageUrl: string | null
  unitPrice: number
  quantity: number
  lineAmount: number
}

/** 주문을 바꾼 주체. */
export type OrderActorType = 'CUSTOMER' | 'STAFF' | 'SYSTEM'
export const ACTOR_LABELS: Record<OrderActorType, string> = { CUSTOMER: '고객', STAFF: '직원', SYSTEM: '시스템' }

/** 처리 이력 한 줄. fromStatus 가 null 이면 주문 생성(결제). at 은 UTC. */
export interface OrderEvent {
  id: number
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  actorType: OrderActorType
  actorId: string | null
  reason: string | null
  carrier: string | null
  trackingNo: string | null
  at: string | null
}

export type PointRefundStatus = 'NONE' | 'PENDING' | 'DONE' | 'FAILED'

export interface OrderDetail {
  id: number
  orderNo: string
  userId: string
  status: OrderStatus
  totalAmount: number
  couponDiscount?: number
  couponName?: string | null
  pointAmount: number
  paymentAmount: number
  paymentMethod: string
  recipient: string
  phone: string
  zipCode: string
  address1: string
  address2: string | null
  paidAt: string
  cancelledAt: string | null
  createdAt: string | null
  deliveredAt?: string | null
  /** 배송 시작 시각·택배사·송장번호(배송중 이후). */
  shippedAt?: string | null
  carrier?: string | null
  trackingNo?: string | null
  /** 취소 사유·주체(취소일 때). */
  cancelReason?: string | null
  cancelledBy?: OrderActorType | null
  /** 결제에 쓴 포인트의 환불 진행(취소일 때). */
  pointRefundStatus?: PointRefundStatus
  items: OrderItem[]
  events?: OrderEvent[]
}

/** 자주 쓰는 택배사. 서버는 자유 문자열(30자)을 받으므로 "기타"면 직접 적는다. */
export const CARRIERS = ['CJ대한통운', '한진택배', '롯데택배', '우체국택배', '로젠택배'] as const
/** 직원 취소 사유 보기. 서버는 자유 문자열(200자). */
export const CANCEL_REASONS = ['재고 부족', '고객 요청', '결제 오류', '배송 불가 지역'] as const

export interface ChangeStatusInput {
  status: OrderStatus
  /** CANCELLED 때 필수 */
  reason?: string
  /** SHIPPING 때 필수 */
  carrier?: string
  trackingNo?: string
}

export interface ShipOrderOutcome {
  orderId: number
  ok: boolean
  message: string | null
  status: OrderStatus | null
}

/** 이력 한 줄을 사람 말로: "결제" · "배송 시작" · "배송 완료" · "취소". */
export function eventLabel(e: OrderEvent): string {
  if (e.fromStatus === null) return '주문 · 결제'
  switch (e.toStatus) {
    case 'SHIPPING':
      return '배송 시작'
    case 'DELIVERED':
      return '배송 완료'
    case 'CANCELLED':
      return '주문 취소'
    default:
      return ORDER_STATUS_LABELS[e.toStatus]
  }
}

/** 이력의 주체: "고객 11" · "직원 staff-1" · "시스템". */
export function actorLabel(e: OrderEvent): string {
  const who = ACTOR_LABELS[e.actorType] ?? e.actorType
  return e.actorId ? `${who} ${e.actorId}` : who
}

export interface OrderFilter {
  status?: OrderStatus | null
}

const BASE = '/commerce-service/api-admin/v1/orders'

export const searchOrders = (keyword: string, page: number, filter: OrderFilter = {}) => {
  const params = new URLSearchParams({ q: keyword, page: String(page), size: String(PAGE_SIZE) })
  if (filter.status) params.set('status', filter.status)
  return api<Page<OrderSummary>>(`${BASE}?${params.toString()}`)
}

export const getOrder = (id: string) => api<OrderDetail>(`${BASE}/${encodeURIComponent(id)}`)

export const changeOrderStatus = (id: string, input: ChangeStatusInput) =>
  api<OrderDetail>(`${BASE}/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify(input) })
/** 여러 건 배송 처리. 건마다 결과가 온다(하나가 실패해도 나머지는 처리됨). */
export const shipOrders = (orders: { orderId: number; carrier: string; trackingNo: string }[]) =>
  api<{ results: ShipOrderOutcome[] }>(`${BASE}/ship`, { method: 'POST', body: JSON.stringify({ orders }) })
