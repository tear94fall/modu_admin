import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './client'
import {
  errorMessage,
  getPushAudience,
  kstIso,
  nextKstSlot,
  openRate,
  scheduleProblem,
  searchPushCampaigns,
  sendTimeText,
  targetText,
  validatePushCampaign,
} from './pushCampaigns'

describe('push campaign helpers', () => {
  afterEach(() => vi.restoreAllMocks())

  it('labels targets', () => {
    expect(targetText({ targetType: 'PRODUCT', targetId: 1, targetLabel: '가을 다이어리' })).toBe('상품 · 가을 다이어리')
    expect(targetText({ targetType: 'PROMOTION', targetId: 2, targetLabel: '가을 신상' })).toBe('기획전 · 가을 신상')
    expect(targetText({ targetType: 'COUPONS', targetId: null, targetLabel: null })).toBe('쿠폰함')
    expect(targetText({ targetType: 'HOME', targetId: null, targetLabel: null })).toBe('홈')
  })

  it('computes open rate against successful sends', () => {
    expect(openRate({ openedCount: 1, successCount: 8 })).toBe('12.5%')
    expect(openRate({ openedCount: 0, successCount: 0 })).toBe('-')
  })

  it('shows send time in KST from UTC values', () => {
    expect(sendTimeText({ sentAt: null, scheduledAt: '2026-09-27T12:30:00' })).toBe('2026-09-27 21:30')
    expect(sendTimeText({ sentAt: '2026-09-27 00:00:00', scheduledAt: '2026-09-26T23:50:00' })).toBe('2026-09-27 09:00')
  })

  it('builds KST schedule values and the next 10-minute slot', () => {
    expect(kstIso('2026-09-27', 9, 0)).toBe('2026-09-27T09:00:00+09:00')
    // 2026-09-27 23:55 KST + 10분 → 다음 날 00:10
    expect(nextKstSlot(new Date('2026-09-27T14:55:00Z'))).toEqual({ date: '2026-09-28', hour: 0, minute: 10 })
  })

  it('rejects past and too-far schedules', () => {
    const now = new Date('2026-09-27T03:00:00Z') // 12:00 KST
    expect(scheduleProblem('2026-09-27T11:50:00+09:00', now)).toBe('지난 시각으로는 예약할 수 없습니다')
    expect(scheduleProblem('2026-09-27T12:10:00+09:00', now)).toBeNull()
    expect(scheduleProblem('2026-10-28T12:10:00+09:00', now)).toMatch(/30일/)
  })

  it('validates the form like the server', () => {
    const base = { title: '특가', body: '보러 가기', imageUrl: null, targetType: 'HOME' as const, targetId: null }
    expect(validatePushCampaign(base)).toBeNull()
    expect(validatePushCampaign({ ...base, title: 'x'.repeat(41) })).toMatch(/40자/)
    expect(validatePushCampaign({ ...base, body: '' })).toBe('내용을 입력하세요')
    expect(validatePushCampaign({ ...base, imageUrl: 'ftp://x' })).toMatch(/http/)
    expect(validatePushCampaign({ ...base, targetType: 'PRODUCT' })).toBe('상품을 고르세요')
  })

  it('reads the server message from any error status', () => {
    expect(errorMessage(new ApiError(409, '{"message":"예약 상태가 아닙니다"}'), '실패')).toBe('예약 상태가 아닙니다')
    expect(errorMessage(new ApiError(500, '<html>'), '실패')).toBe('실패')
  })

  it('calls the admin endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"content":[]}', { status: 200 }))
    await searchPushCampaigns('특가', 1, { status: 'SENT' })
    expect(String(fetchMock.mock.calls[0][0])).toContain('/commerce-service/api-admin/v1/push-campaigns?q=%ED%8A%B9%EA%B0%80&page=1&size=15&status=SENT')
    await getPushAudience('2026-09-27T21:30:00+09:00')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/push-campaigns/audience?at=2026-09-27T21%3A30%3A00%2B09%3A00')
  })
})
