import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type AdminTier,
  countsText,
  getTierRuns,
  getTiers,
  parseCountsByTier,
  startTierRun,
  type TierDraft,
  toDraft,
  toTierInputs,
  updateTiers,
  validateTiers,
} from './tiers'

const tier = (code: string, name: string, minAmount: number, earnRate: number, sortOrder: number): AdminTier => ({
  code,
  name,
  color: '#64748B',
  minAmount,
  earnRate,
  sortOrder,
  coupons: [],
  customerCount: 0,
})
const TIERS = [tier('WELCOME', '웰컴', 0, 1, 0), tier('SILVER', '실버', 100000, 2, 1), tier('GOLD', '골드', 300000, 3, 2), tier('VIP', 'VIP', 700000, 5, 3)]
const drafts = (): TierDraft[] => TIERS.map(toDraft)
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('tier validation', () => {
  it('passes the seeded tiers', () => {
    expect(validateTiers(drafts())).toBeNull()
  })

  it('requires the lowest tier to start at 0원', () => {
    const d = drafts()
    d[0].minAmount = '1000'
    expect(validateTiers(d)).toBe('가장 낮은 등급(웰컴)의 기준 금액은 0원이어야 합니다')
  })

  it('requires strictly increasing min amounts', () => {
    const d = drafts()
    d[2].minAmount = '100000'
    expect(validateTiers(d)).toBe('골드: 기준 금액은 아래 등급보다 커야 합니다')
    d[2].minAmount = '-1'
    expect(validateTiers(d)).toMatch(/0 이상의 정수/)
  })

  it('limits earn rate to whole numbers 0..20', () => {
    const d = drafts()
    d[3].earnRate = '21'
    expect(validateTiers(d)).toBe('VIP: 적립률은 0~20% 사이의 정수여야 합니다')
    d[3].earnRate = '2.5'
    expect(validateTiers(d)).toMatch(/적립률/)
    d[3].earnRate = '0'
    expect(validateTiers(d)).toBeNull()
    d[3].earnRate = '20'
    expect(validateTiers(d)).toBeNull()
  })

  it('checks name and color', () => {
    const d = drafts()
    d[1].name = ' '
    expect(validateTiers(d)).toBe('SILVER 등급 이름을 입력하세요')
    d[1].name = '실버'
    d[1].color = 'red'
    expect(validateTiers(d)).toBe('실버: 색은 #RRGGBB 형식이어야 합니다')
  })

  it('builds the PUT body with numbers, upper-case colors and coupon ids', () => {
    const d = drafts()
    d[2].color = '#d97706'
    d[2].coupons = [{ id: 7, name: '골드 3천원' }]
    expect(toTierInputs(d)[2]).toEqual({ code: 'GOLD', name: '골드', color: '#D97706', minAmount: 300000, earnRate: 3, couponIds: [7] })
  })
})

describe('tier runs helpers', () => {
  it('reads counts from an object or a JSON string', () => {
    expect(parseCountsByTier({ GOLD: 2 })).toEqual({ GOLD: 2 })
    expect(parseCountsByTier('{"VIP":1}')).toEqual({ VIP: 1 })
    expect(parseCountsByTier('oops')).toEqual({})
    expect(parseCountsByTier(null)).toEqual({})
  })

  it('shows counts in tier order with names', () => {
    expect(countsText({ countsByTier: '{"VIP":1,"WELCOME":1200,"NEW":3}' }, TIERS)).toBe('웰컴 1,200 · VIP 1 · NEW 3')
    expect(countsText({ countsByTier: null }, TIERS)).toBe('-')
  })
})

describe('tier api', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sorts tiers by sortOrder', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json([TIERS[2], TIERS[0], TIERS[3], TIERS[1]]))
    expect((await getTiers()).map((t) => t.code)).toEqual(['WELCOME', 'SILVER', 'GOLD', 'VIP'])
  })

  it('PUTs the full list and POSTs a run', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(TIERS))
    await updateTiers(toTierInputs(drafts()))
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/commerce-service\/api-admin\/v1\/tiers$/)
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(String(init?.body))).toHaveLength(4)

    fetchMock.mockImplementation(async () => json({ id: 1, status: 'RUNNING' }, 202))
    await startTierRun()
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/tiers\/runs$/)
    expect(fetchMock.mock.calls[1][1]?.method).toBe('POST')

    fetchMock.mockImplementation(async () => json({ content: [] }))
    await getTierRuns(1)
    expect(String(fetchMock.mock.calls[2][0])).toMatch(/\/tiers\/runs\?page=1&size=15$/)
  })
})
