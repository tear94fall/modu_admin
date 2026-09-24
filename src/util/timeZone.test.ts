import { afterEach, describe, expect, it } from 'vitest'
import { browserTimeZone, formatUtcDateTime, getDisplayTimeZone, setDisplayTimeZone, timeZoneLabel } from './timeZone'

describe('formatUtcDateTime', () => {
  afterEach(() => setDisplayTimeZone(null))

  it('reads server times as UTC and shows them in the given zone', () => {
    // 서버(UTC) 2026-09-22 14:45:03 = 한국 23:45, 뉴욕(EDT) 10:45
    expect(formatUtcDateTime('2026-09-22 14:45:03', 'Asia/Seoul')).toBe('2026-09-22 23:45')
    expect(formatUtcDateTime('2026-09-22 14:45:03', 'UTC')).toBe('2026-09-22 14:45')
    expect(formatUtcDateTime('2026-09-22 14:45:03', 'America/New_York')).toBe('2026-09-22 10:45')
  })

  it('crosses the date line correctly', () => {
    expect(formatUtcDateTime('2026-09-22 16:30:00', 'Asia/Seoul')).toBe('2026-09-23 01:30')
  })

  it('accepts ISO strings with T, fractions or an explicit offset', () => {
    expect(formatUtcDateTime('2026-09-22T14:45:03.123456', 'Asia/Seoul')).toBe('2026-09-22 23:45')
    expect(formatUtcDateTime('2026-09-22T14:45:03Z', 'Asia/Seoul')).toBe('2026-09-22 23:45')
    expect(formatUtcDateTime('2026-09-22T23:45:03+09:00', 'UTC')).toBe('2026-09-22 14:45')
  })

  it('returns empty text for missing or broken values', () => {
    expect(formatUtcDateTime(undefined, 'UTC')).toBe('')
    expect(formatUtcDateTime('어제', 'UTC')).toBe('')
  })

  it('uses the chosen display zone, falling back to the browser zone', () => {
    setDisplayTimeZone(null)
    expect(getDisplayTimeZone()).toBe(browserTimeZone())
    setDisplayTimeZone('UTC')
    expect(getDisplayTimeZone()).toBe('UTC')
    expect(formatUtcDateTime('2026-09-22 14:45:03')).toBe('2026-09-22 14:45')
    setDisplayTimeZone('Not/AZone')
    expect(getDisplayTimeZone()).toBe(browserTimeZone())
  })

  it('labels a zone with its UTC offset', () => {
    expect(timeZoneLabel('Asia/Seoul', new Date('2026-09-22T00:00:00Z'))).toBe('Asia/Seoul (UTC+9)')
    expect(timeZoneLabel('UTC', new Date('2026-09-22T00:00:00Z'))).toBe('UTC (UTC+0)')
    expect(timeZoneLabel('America/New_York', new Date('2026-09-22T00:00:00Z'))).toBe('America/New_York (UTC-4)')
  })
})
