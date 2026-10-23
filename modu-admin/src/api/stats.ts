import { api } from './client'

/** 백오피스 홈 "오늘의 숫자". 네 서비스가 각자 표시 시간대(zone)의 달력 날짜로 묶은 최근 days 일(오늘 포함, 오래된 날부터)을 준다. */
export interface MemberStatsDay {
  date: string
  signups: number
}
export interface ActiveMembers {
  /** CHAT · COMMERCE */
  service: string
  today: number
  week: number
}
export interface MemberStats {
  zone: string
  days: MemberStatsDay[]
  totalMembers: number
  active: ActiveMembers[]
}
export interface ChatStatsDay {
  date: string
  messages: number
  roomsCreated: number
}
export interface ChatStats {
  zone: string
  days: ChatStatsDay[]
}
export interface PointStatsDay {
  date: string
  earned: number
  spent: number
  refunded: number
  adjusted: number
}
export interface PointStats {
  zone: string
  days: PointStatsDay[]
}
export interface OrderStatsDay {
  date: string
  orders: number
  /** 실결제액(상품 − 쿠폰 − 포인트, 원) */
  amount: number
  couponUsed: number
  /** 그 날 취소된 주문 수(결제한 날이 아니라 취소한 날) */
  cancelled: number
}
export interface OrderStats {
  zone: string
  days: OrderStatsDay[]
}

const query = (days: number, zone: string) => `?days=${days}&zone=${encodeURIComponent(zone)}`

export const getMemberStats = (days: number, zone: string) => api<MemberStats>(`/member-service/api-admin/member/stats${query(days, zone)}`)
export const getChatStats = (days: number, zone: string) => api<ChatStats>(`/chat-service/api-admin/chat/stats${query(days, zone)}`)
export const getPointStats = (days: number, zone: string) => api<PointStats>(`/point-service/api-admin/point/stats${query(days, zone)}`)
export const getOrderStats = (days: number, zone: string) => api<OrderStats>(`/commerce-service/api-admin/v1/stats${query(days, zone)}`)

/** 한 지표의 오늘·어제·창 전체 합과 날짜별 값(미니 막대용). days 는 오래된 날부터. */
export interface Trend {
  today: number
  yesterday: number
  total: number
  series: number[]
}

export function trend<T extends { date: string }>(days: T[], pick: (day: T) => number): Trend {
  const series = days.map(pick)
  return {
    today: series[series.length - 1] ?? 0,
    yesterday: series[series.length - 2] ?? 0,
    total: series.reduce((sum, v) => sum + v, 0),
    series,
  }
}

/** 어제 대비 증감. 같으면 "어제와 같음", 어제가 0 이면 비율 대신 값만. */
export function deltaText(t: Trend): string {
  const diff = t.today - t.yesterday
  if (diff === 0) return '어제와 같음'
  const sign = diff > 0 ? '+' : '−'
  const abs = Math.abs(diff).toLocaleString('ko-KR')
  if (t.yesterday === 0) return `${sign}${abs} (어제 0)`
  const pct = Math.round((Math.abs(diff) / t.yesterday) * 100)
  return `${sign}${abs} (${sign}${pct}%)`
}

/** "10.17 ~ 10.23 · Asia/Seoul" 같은 기간 설명. */
export function periodText(days: { date: string }[], zone: string): string {
  if (days.length === 0) return zone
  const short = (iso: string) => iso.slice(5).replace('-', '.')
  return `${short(days[0].date)} ~ ${short(days[days.length - 1].date)} · ${zone}`
}
