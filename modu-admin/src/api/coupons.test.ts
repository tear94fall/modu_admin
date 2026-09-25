import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type CouponInput,
  discountLabel,
  expiryLabel,
  getCouponIssues,
  grantCoupon,
  minOrderLabel,
  quantityLabel,
  searchCoupons,
  validateCoupon,
} from './coupons'

const valid: CouponInput = {
  name: '웰컴 쿠폰',
  description: null,
  discountType: 'FIXED',
  discountValue: 3000,
  maxDiscount: null,
  minOrderAmount: 10000,
  scope: 'ALL',
  scopeIds: [],
  issueStart: '2026-10-01',
  issueEnd: '2026-10-31',
  validUntil: '2026-11-30',
  validDays: null,
  totalQuantity: null,
  code: null,
  downloadable: true,
  active: true,
}

describe('coupon labels', () => {
  it('formats discounts', () => {
    expect(discountLabel({ discountType: 'FIXED', discountValue: 3000, maxDiscount: null })).toBe('3,000원')
    expect(discountLabel({ discountType: 'PERCENT', discountValue: 10, maxDiscount: 5000 })).toBe('10% (최대 5,000원)')
    expect(discountLabel({ discountType: 'PERCENT', discountValue: 15, maxDiscount: null })).toBe('15%')
  })

  it('formats expiry, minimum order and quantity', () => {
    expect(expiryLabel({ validUntil: '2026-10-31', validDays: null })).toBe('2026.10.31까지')
    expect(expiryLabel({ validUntil: null, validDays: 7 })).toBe('받은 날부터 7일')
    expect(minOrderLabel(0)).toBe('없음')
    expect(minOrderLabel(20000)).toBe('20,000원 이상')
    expect(quantityLabel({ issuedCount: 12, totalQuantity: 100, usedCount: 3 })).toBe('12 / 100장 · 사용 3')
    expect(quantityLabel({ issuedCount: 12, totalQuantity: null, usedCount: 0 })).toBe('12장 / 무제한 · 사용 0')
  })
})

describe('validateCoupon', () => {
  it('accepts a valid coupon', () => {
    expect(validateCoupon(valid)).toBeNull()
    expect(validateCoupon({ ...valid, discountType: 'PERCENT', discountValue: 90, maxDiscount: 5000, validUntil: null, validDays: 1, code: 'AB12' })).toBeNull()
  })

  it.each<[Partial<CouponInput>, string]>([
    [{ name: '' }, '쿠폰 이름을 입력하세요'],
    [{ name: 'x'.repeat(41) }, '쿠폰 이름은 40자까지입니다'],
    [{ description: 'x'.repeat(201) }, '설명은 200자까지입니다'],
    [{ discountValue: Number.NaN }, '할인 값을 1 이상의 정수로 입력하세요'],
    [{ discountValue: 0 }, '할인 값을 1 이상의 정수로 입력하세요'],
    [{ discountType: 'PERCENT', discountValue: 91 }, '할인율은 1~90% 사이여야 합니다'],
    [{ discountType: 'PERCENT', discountValue: 10, maxDiscount: 0 }, '최대 할인은 1원 이상의 정수여야 합니다'],
    [{ minOrderAmount: -1 }, '최소 주문 금액은 0 이상의 정수여야 합니다'],
    [{ scope: 'CATEGORY', scopeIds: [] }, '적용할 카테고리를 1개 이상 고르세요'],
    [{ scope: 'PRODUCT', scopeIds: [] }, '적용할 상품을 1개 이상 고르세요'],
    [{ issueStart: '' }, '발급 시작일과 종료일을 입력하세요'],
    [{ issueEnd: '2026-09-30' }, '발급 종료일은 시작일보다 빠를 수 없습니다'],
    [{ validUntil: null }, '사용 기한을 입력하세요'],
    [{ validDays: 7 }, '사용 기한을 입력하세요'],
    [{ validUntil: '2026-09-01' }, '사용 기한은 발급 시작일보다 빠를 수 없습니다'],
    [{ validUntil: null, validDays: 0 }, '사용 기한 일수는 1 이상의 정수여야 합니다'],
    [{ totalQuantity: 0 }, '총 수량은 1 이상의 정수여야 합니다 (비우면 무제한)'],
    [{ code: 'AB1' }, '쿠폰 코드는 영문 대문자·숫자 4~20자입니다'],
    [{ code: 'WELCOME-1' }, '쿠폰 코드는 영문 대문자·숫자 4~20자입니다'],
  ])('rejects %j', (patch, message) => {
    expect(validateCoupon({ ...valid, ...patch })).toBe(message)
  })
})

describe('coupon requests', () => {
  afterEach(() => vi.restoreAllMocks())

  const stubFetch = (body: unknown) =>
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))

  it('sends the active filter only when set', async () => {
    const fetch = stubFetch({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 15 })
    await searchCoupons('웰컴', 1)
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/commerce-service\/api-admin\/v1\/coupons\?q=%EC%9B%B0%EC%BB%B4&page=1&size=15$/)
    await searchCoupons('', 0, { active: false })
    expect(String(fetch.mock.calls[1][0])).toMatch(/coupons\?q=&page=0&size=15&active=false$/)
  })

  it('reads issues by status and grants to user ids', async () => {
    const fetch = stubFetch({ issued: 1, skipped: [] })
    await getCouponIssues('7', 0, 'USED')
    expect(String(fetch.mock.calls[0][0])).toMatch(/coupons\/7\/issues\?page=0&size=15&status=USED$/)
    await grantCoupon('7', ['u1', 'u2'])
    const [url, init] = fetch.mock.calls[1]
    expect(String(url)).toMatch(/coupons\/7\/issues$/)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ userIds: ['u1', 'u2'] })
  })
})
