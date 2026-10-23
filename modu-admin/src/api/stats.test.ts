import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from './client'
import { deltaText, getMemberStats, getOrderStats, periodText, trend } from './stats'

describe('stats api', () => {
  afterEach(() => vi.restoreAllMocks())

  it('calls each service with days and an encoded zone', async () => {
    const spy = vi.spyOn(client, 'api').mockResolvedValue({ zone: 'Asia/Seoul', days: [] })
    await getMemberStats(7, 'Asia/Seoul')
    await getOrderStats(30, 'America/New_York')
    expect(spy).toHaveBeenNthCalledWith(1, '/member-service/api-admin/member/stats?days=7&zone=Asia%2FSeoul')
    expect(spy).toHaveBeenNthCalledWith(2, '/commerce-service/api-admin/v1/stats?days=30&zone=America%2FNew_York')
  })

  it('trend takes today from the last day, yesterday from the one before, and sums the window', () => {
    const t = trend(
      [
        { date: '2026-10-21', n: 1 },
        { date: '2026-10-22', n: 4 },
        { date: '2026-10-23', n: 3 },
      ],
      (d) => d.n,
    )
    expect(t).toEqual({ today: 3, yesterday: 4, total: 8, series: [1, 4, 3] })
    expect(trend([], () => 1)).toEqual({ today: 0, yesterday: 0, total: 0, series: [] })
  })

  it('deltaText shows sign, amount and percent, and special-cases equal and zero-yesterday', () => {
    expect(deltaText({ today: 3, yesterday: 4, total: 0, series: [] })).toBe('−1 (−25%)')
    expect(deltaText({ today: 6, yesterday: 4, total: 0, series: [] })).toBe('+2 (+50%)')
    expect(deltaText({ today: 4, yesterday: 4, total: 0, series: [] })).toBe('어제와 같음')
    expect(deltaText({ today: 2, yesterday: 0, total: 0, series: [] })).toBe('+2 (어제 0)')
    expect(deltaText({ today: 12000, yesterday: 0, total: 0, series: [] })).toBe('+12,000 (어제 0)')
  })

  it('periodText shows the first and last day with the zone', () => {
    expect(periodText([{ date: '2026-10-17' }, { date: '2026-10-23' }], 'Asia/Seoul')).toBe('10.17 ~ 10.23 · Asia/Seoul')
    expect(periodText([], 'UTC')).toBe('UTC')
  })
})
