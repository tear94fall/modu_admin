import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCustomer, getCustomerSummary, isAgreed, lookupCustomers, searchCustomers } from './customers'

const tier = { code: 'GOLD', name: '골드', color: '#D97706', earnRate: 3, minAmount: 300000 }
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

describe('customer api', () => {
  afterEach(() => vi.restoreAllMocks())

  it('searches with q, page, size and only the filters that are set', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ content: [] }))
    await searchCustomers('demo', 2)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/commerce-service\/api-admin\/v1\/customers\?q=demo&page=2&size=15$/)
    await searchCustomers('', 0, { tier: 'GOLD', agreed: false })
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/customers\?q=&page=0&size=15&tier=GOLD&agreed=false$/)
  })

  it('reads one customer by encoded userId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ userId: 'a b' }))
    await getCustomer('a b')
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/customers\/a%20b$/)
  })

  it('reads the member commerce summary by encoded userId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ customer: null }))
    await getCustomerSummary('a b')
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/commerce-service\/api-admin\/v1\/customers\/a%20b\/summary$/)
  })

  it('does not call the server for an empty page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    expect((await lookupCustomers([])).size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('looks up unique userIds in chunks of 100 and maps them by userId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const ids = new URL(String(input)).searchParams.get('userIds')!.split(',')
      return json(ids.filter((id) => id.endsWith('7')).map((userId) => ({ userId, status: 'ACTIVE', tier, agreed: true })))
    })
    const ids = Array.from({ length: 150 }, (_, i) => `u${i}`)
    const found = await lookupCustomers([...ids, 'u7'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = new URL(String(fetchMock.mock.calls[0][0]))
    expect(first.pathname).toBe('/commerce-service/api-admin/v1/customers/lookup')
    expect(first.searchParams.get('userIds')!.split(',')).toHaveLength(100)
    expect(found.get('u7')?.tier.name).toBe('골드')
    expect(found.get('u147')?.agreed).toBe(true)
    expect(found.has('u1')).toBe(false)
  })

  it('treats a customer as agreed only when both terms and privacy are agreed', () => {
    expect(isAgreed({ termsAgreedAt: '2026-09-27T00:00:00', privacyAgreedAt: '2026-09-27T00:00:00' })).toBe(true)
    expect(isAgreed({ termsAgreedAt: '2026-09-27T00:00:00', privacyAgreedAt: null })).toBe(false)
    expect(isAgreed({ termsAgreedAt: null, privacyAgreedAt: null })).toBe(false)
  })
})
