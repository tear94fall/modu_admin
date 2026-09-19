import { ApiError, api, PAGE_SIZE } from './client'
import type { Page } from './members'

export type ProductStatus = 'SELLING' | 'HIDDEN'

export const STATUS_LABELS: Record<ProductStatus, string> = { SELLING: '판매중', HIDDEN: '숨김' }

/** 어드민 상품 목록 한 줄. */
export interface ProductSummary {
  id: number
  name: string
  description: string
  imageUrl: string | null
  price: number
  listPrice: number | null
  status: ProductStatus
  totalStock: number
  categoryId: number | null
  categoryName: string | null
}

export interface OptionValue {
  id: number
  name: string
}

export interface OptionGroup {
  id: number
  name: string
  values: OptionValue[]
}

export interface Sku {
  id: number
  optionValueIds: number[]
  optionLabel: string
  extraPrice: number
  stock: number
}

/** 어드민 단건·등록·수정 응답. 앱 상세와 같은 모양이다. */
export interface ProductDetail {
  id: number
  name: string
  description: string
  detail: string | null
  imageUrl: string | null
  images: string[]
  price: number
  listPrice: number | null
  discountRate: number
  status: ProductStatus
  soldOut: boolean
  wishCount: number
  categoryId: number | null
  categoryPath: string[]
  optionGroups: OptionGroup[]
  skus: Sku[]
}

export interface OptionGroupInput {
  name: string
  values: string[]
}

/** options 는 그룹명 → 값명. 옵션 없는 상품은 빈 객체 하나. */
export interface SkuInput {
  options: Record<string, string>
  extraPrice: number
  stock: number
}

/** 등록·수정 본문. 길이·범위·URL·조합 규칙은 서버가 검증하고 400 으로 이유를 준다. */
export interface ProductInput {
  name: string
  description: string
  detail: string | null
  price: number
  listPrice: number | null
  categoryId: number | null
  status: ProductStatus
  images: string[]
  optionGroups: OptionGroupInput[]
  skus: SkuInput[]
}

export interface ProductFilter {
  categoryId?: number | null
  status?: ProductStatus | null
}

const BASE = '/commerce-service/api-admin/v1/products'

export const searchProducts = (keyword: string, page: number, filter: ProductFilter = {}) => {
  const params = new URLSearchParams({ q: keyword, page: String(page), size: String(PAGE_SIZE) })
  if (filter.categoryId != null) params.set('categoryId', String(filter.categoryId))
  if (filter.status) params.set('status', filter.status)
  return api<Page<ProductSummary>>(`${BASE}?${params.toString()}`)
}

export const getProduct = (id: string) => api<ProductDetail>(`${BASE}/${encodeURIComponent(id)}`)

export const createProduct = (input: ProductInput) => api<ProductDetail>(BASE, { method: 'POST', body: JSON.stringify(input) })

export const updateProduct = (id: string, input: ProductInput) =>
  api<ProductDetail>(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })

export const deleteProduct = (id: string) => api<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })

/** 400 응답 본문 {"message": "price: ..."} 에서 사람이 읽을 이유를 꺼낸다. 그 밖의 오류는 null. */
export function validationMessage(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.status !== 400) return null
  try {
    const body = JSON.parse(err.message) as { message?: unknown }
    return typeof body.message === 'string' ? body.message : null
  } catch {
    return null
  }
}
