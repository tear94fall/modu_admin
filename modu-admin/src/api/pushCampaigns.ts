import { ApiError, api, PAGE_SIZE } from './client'
import type { Page } from './members'
import { pad } from '../util/dateInput'
import { formatUtcDateTime } from '../util/timeZone'

/** 눌렀을 때 앱이 여는 화면. 상품·기획전은 targetId 가 있어야 한다. */
export type PushTargetType = 'PRODUCT' | 'PROMOTION' | 'COUPONS' | 'HOME'

export type PushCampaignStatus = 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELED' | 'FAILED'

/** 폼의 대상 칩 글자. */
export const TARGET_CHIP_LABELS: Record<PushTargetType, string> = {
  PRODUCT: '상품',
  PROMOTION: '기획전·이벤트',
  COUPONS: '쿠폰함',
  HOME: '홈',
}

export const PUSH_STATUS_LABELS: Record<PushCampaignStatus, string> = {
  SCHEDULED: '예약',
  SENDING: '보내는 중',
  SENT: '보냄',
  CANCELED: '취소',
  FAILED: '실패',
}

/** 예약 파랑 · 보내는 중 주황 · 보냄 초록 · 취소 회색 · 실패 빨강. */
export const pushStatusClass = (status: PushCampaignStatus) => {
  switch (status) {
    case 'SCHEDULED':
      return 'status-badge status-badge--shipping'
    case 'SENDING':
      return 'status-badge status-badge--amber'
    case 'SENT':
      return 'status-badge status-badge--done'
    case 'FAILED':
      return 'status-badge status-badge--cancelled'
    default:
      return 'status-badge'
  }
}

/** 어드민 캠페인 한 건. 시각(scheduledAt·sentAt·canceledAt·createdAt)은 시간대 없는 UTC 값이다. */
export interface AdminPushCampaign {
  id: number
  title: string
  body: string
  imageUrl: string | null
  targetType: PushTargetType
  targetId: number | null
  /** 만들 때의 대상 이름(상품명·기획전 제목). 쿠폰함·홈은 null 일 수 있다. */
  targetLabel: string | null
  /** 앱이 여는 경로: /products/1, /promotions/2, /coupons, / */
  path: string
  status: PushCampaignStatus
  scheduledAt: string | null
  sentAt: string | null
  canceledAt: string | null
  /** 야간(21시~08시) 발송이라 야간 수신 동의자에게만 보냈는지. */
  nightApplied: boolean
  targetUsers: number
  targetDevices: number
  successCount: number
  failureCount: number
  removedTokens: number
  openedCount: number
  createdBy: string | null
  createdAt: string | null
  failureMessage: string | null
}

/** 등록 본문. scheduledAt 은 오프셋이 붙은 ISO("2026-09-27T21:30:00+09:00"), null 이면 지금 보내기. */
export interface PushCampaignRequest {
  title: string
  body: string
  imageUrl: string | null
  targetType: PushTargetType
  targetId: number | null
  scheduledAt: string | null
}

/** 그 시각에 받을 사람. night 이면 users/devices 는 야간 동의자만 센 값이다. */
export interface PushAudience {
  night: boolean
  users: number
  devices: number
  consentedUsers: number
  nightUsers: number
}

export interface PushTestRequest {
  title: string
  body: string
  imageUrl: string | null
  targetType: PushTargetType
  targetId: number | null
  userIds: string[]
}

export interface PushTestResult {
  users: number
  devices: number
  success: number
  failure: number
  noDeviceUserIds: string[]
}

export interface PushCampaignFilter {
  status?: PushCampaignStatus | null
}

export const MAX_TITLE = 40
export const MAX_BODY = 120
export const MAX_TEST_USERS = 5
/** 예약은 30일 안쪽만(서버 규칙). */
export const MAX_SCHEDULE_DAYS = 30

/** 서버가 붙이는 광고 표시. 미리보기도 같은 글자를 쓴다. */
export const AD_PREFIX = '(광고) '
export const OPT_OUT_SUFFIX = '\n수신거부: 마이페이지 > 알림 설정'

const BASE = '/commerce-service/api-admin/v1/push-campaigns'

export const searchPushCampaigns = (keyword: string, page: number, filter: PushCampaignFilter = {}) => {
  const params = new URLSearchParams({ q: keyword, page: String(page), size: String(PAGE_SIZE) })
  if (filter.status) params.set('status', filter.status)
  return api<Page<AdminPushCampaign>>(`${BASE}?${params.toString()}`)
}

export const getPushCampaign = (id: string) => api<AdminPushCampaign>(`${BASE}/${encodeURIComponent(id)}`)

export const createPushCampaign = (input: PushCampaignRequest) =>
  api<AdminPushCampaign>(BASE, { method: 'POST', body: JSON.stringify(input) })

export const cancelPushCampaign = (id: number | string) =>
  api<AdminPushCampaign>(`${BASE}/${encodeURIComponent(String(id))}/cancel`, { method: 'POST' })

/** at 이 없으면 지금 기준. */
export const getPushAudience = (at: string | null) =>
  api<PushAudience>(`${BASE}/audience${at ? `?${new URLSearchParams({ at }).toString()}` : ''}`)

export const sendPushTest = (input: PushTestRequest) => api<PushTestResult>(`${BASE}/test`, { method: 'POST', body: JSON.stringify(input) })

/** 목록의 대상 글자: "상품 · 가을 다이어리" | "기획전 · 가을 신상" | "쿠폰함" | "홈". */
export function targetText(c: Pick<AdminPushCampaign, 'targetType' | 'targetId' | 'targetLabel'>): string {
  const name = c.targetLabel ?? (c.targetId != null ? `#${c.targetId}` : '')
  switch (c.targetType) {
    case 'PRODUCT':
      return `상품 · ${name}`
    case 'PROMOTION':
      return `기획전 · ${name}`
    case 'COUPONS':
      return '쿠폰함'
    default:
      return '홈'
  }
}

/** 보낸 캠페인은 보낸 시각, 아니면 예약 시각. 한국 시간 "2026-09-27 21:30". */
export const sendTimeText = (c: Pick<AdminPushCampaign, 'sentAt' | 'scheduledAt'>) => formatUtcDateTime(c.sentAt ?? c.scheduledAt, 'Asia/Seoul') || '-'

/** 열어 봄 비율 = 열어 봄 / 성공. 성공이 0 이면 "-". "12.5%" */
export function openRate(c: Pick<AdminPushCampaign, 'openedCount' | 'successCount'>): string {
  if (c.successCount <= 0) return '-'
  return `${Math.round((c.openedCount / c.successCount) * 1000) / 10}%`
}

/** 한국 날짜·시·분 → "2026-09-27T21:30:00+09:00". */
export const kstIso = (date: string, hour: number, minute: number) => `${date}T${pad(hour)}:${pad(minute)}:00+09:00`

/** 지금부터 minutesAhead 분 뒤 이후의 첫 10분 칸(KST). 예약 기본값. */
export function nextKstSlot(now: Date = new Date(), minutesAhead = 10): { date: string; hour: number; minute: number } {
  const t = new Date(now.getTime() + 9 * 3600_000 + minutesAhead * 60_000)
  const rounded = Math.ceil((t.getUTCHours() * 60 + t.getUTCMinutes() + (t.getUTCSeconds() > 0 ? 1 : 0)) / 10) * 10
  const day = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 0, rounded))
  return {
    date: `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`,
    hour: day.getUTCHours(),
    minute: day.getUTCMinutes(),
  }
}

/** 예약 시각 검사. 지났거나 30일 넘게 뒤면 이유, 괜찮으면 null. */
export function scheduleProblem(iso: string, now: Date = new Date()): string | null {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return '예약 날짜를 입력하세요'
  if (at <= now.getTime()) return '지난 시각으로는 예약할 수 없습니다'
  if (at > now.getTime() + MAX_SCHEDULE_DAYS * 86_400_000) return `예약은 ${MAX_SCHEDULE_DAYS}일 안쪽으로만 할 수 있습니다`
  return null
}

/** 폼 값 검사(서버 규칙을 먼저 본다). 통과하면 null. */
export function validatePushCampaign(input: Omit<PushCampaignRequest, 'scheduledAt'>): string | null {
  if (input.title.length === 0) return '제목을 입력하세요'
  if (input.title.length > MAX_TITLE) return `제목은 ${MAX_TITLE}자까지입니다`
  if (input.body.length === 0) return '내용을 입력하세요'
  if (input.body.length > MAX_BODY) return `내용은 ${MAX_BODY}자까지입니다`
  if (input.imageUrl !== null && !/^https?:\/\/\S+$/i.test(input.imageUrl)) return '이미지 URL 은 http(s):// 로 시작해야 합니다'
  if (input.targetType === 'PRODUCT' && input.targetId == null) return '상품을 고르세요'
  if (input.targetType === 'PROMOTION' && input.targetId == null) return '기획전·이벤트를 고르세요'
  return null
}

/** 서버 오류 본문 {"message": "..."} 을 꺼낸다(상태 코드와 상관없이). 없으면 fallback. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) {
    try {
      const body = JSON.parse(err.message) as { message?: unknown }
      if (typeof body.message === 'string' && body.message.trim() !== '') return body.message
    } catch {
      // JSON 이 아니면 fallback
    }
  }
  return fallback
}
