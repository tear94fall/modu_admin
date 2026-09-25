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

export interface OrderDetail {
  id: number
  orderNo: string
  userId: string
  status: OrderStatus
  totalAmount: number
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
  items: OrderItem[]
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

export const changeOrderStatus = (id: string, status: OrderStatus) =>
  api<OrderDetail>(`${BASE}/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
