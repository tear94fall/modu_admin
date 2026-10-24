import { api } from './client'

/**
 * 재고 경고 — 판매 중 상품만. 품절은 모든 옵션 재고가 0 인 상품, 부족은 그 밖의 상품에서 부족 기준 이하인 옵션(SKU),
 * 과다는 과다 기준 이상인 옵션. 줄마다 최근 salesDays 일 판매 수량(sold)이 붙는다.
 */
export interface StockProduct {
  productId: number
  name: string
  imageUrl: string | null
  wishCount: number
  skuCount: number
  sold: number
}

export interface StockSku {
  skuId: number
  productId: number
  productName: string
  imageUrl: string | null
  /** "블랙 / M". 옵션이 없으면 빈 문자열. */
  optionLabel: string
  stock: number
  wishCount: number
  sold: number
}

export interface StockAlerts {
  low: number
  high: number
  salesDays: number
  sellingProducts: number
  soldOut: StockProduct[]
  lowStock: StockSku[]
  overstock: StockSku[]
}

export interface StockCriteria {
  low?: number
  high?: number
}

export const LOW_MIN = 0
export const LOW_MAX = 1000
export const HIGH_MIN = 1
export const HIGH_MAX = 100000

/** 기준을 안 주면 서버 설정값(부족 5, 과다 100)을 쓴다. */
export const getStockAlerts = (criteria: StockCriteria = {}) => {
  const params = new URLSearchParams()
  if (criteria.low !== undefined) params.set('low', String(criteria.low))
  if (criteria.high !== undefined) params.set('high', String(criteria.high))
  const qs = params.toString()
  return api<StockAlerts>(`/commerce-service/api-admin/v1/stock/alerts${qs ? `?${qs}` : ''}`)
}

const CRITERIA_KEY = 'modu-admin-stock-criteria'

/** 이 브라우저에서 마지막으로 고른 기준. 없거나 범위 밖인 값은 빼고(서버 기본값) 돌려준다. */
export function storedCriteria(): StockCriteria {
  try {
    const raw = localStorage.getItem(CRITERIA_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const pick = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined)
    const low = pick(parsed.low, LOW_MIN, LOW_MAX)
    const high = pick(parsed.high, HIGH_MIN, HIGH_MAX)
    return { ...(low !== undefined && { low }), ...(high !== undefined && { high }) }
  } catch {
    return {}
  }
}

export function rememberCriteria(c: StockCriteria) {
  try {
    localStorage.setItem(CRITERIA_KEY, JSON.stringify(c))
  } catch {
    // 저장 못 해도 이번 화면에는 적용된다.
  }
}

/**
 * 지금 재고가 최근 판매 속도로 며칠(또는 몇 달)치인지. 판매가 없으면 null.
 * 부족 줄은 "약 12일분", 과다 줄은 "약 8개월치"처럼 읽힌다.
 */
export function coverageText(stock: number, sold: number, salesDays: number): string | null {
  if (sold <= 0 || stock <= 0) return null
  const days = (stock / sold) * salesDays
  if (days >= 60) return `약 ${Math.round(days / 30).toLocaleString('ko-KR')}개월치`
  return `약 ${Math.max(1, Math.round(days)).toLocaleString('ko-KR')}일분`
}
