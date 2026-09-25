import { useSyncExternalStore } from 'react'

/**
 * 백오피스가 시각을 보여 줄 시간대. 기본은 브라우저(OS) 시간대이고 '내 정보'에서 바꿀 수 있다(이 브라우저에만 저장).
 *
 * 서버가 주는 채팅 시각·방 생성 시각은 시간대 표시가 없는 UTC 값이다(`2026-09-22 14:45:03`). 서버 시계가 UTC 이고
 * ws-service 가 채팅 시각을 그 시계로 저장한다. 그래서 [formatUtcDateTime] 이 UTC 로 읽어 고른 시간대로 바꿔 보여 준다.
 */
const STORAGE_KEY = 'modu-admin.timeZone'
const CHANGE_EVENT = 'modu-admin:time-zone'

/** 고를 수 있는 시간대. 브라우저 시간대가 목록에 없으면 화면이 맨 앞에 더한다. */
export const TIME_ZONE_CHOICES = ['Asia/Seoul', 'UTC', 'Asia/Tokyo', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Los_Angeles']

export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** 직접 고른 시간대. 고르지 않았으면(브라우저를 따르면) null. */
export function getStoredTimeZone(): string | null {
  const stored = readStored()
  return stored && isValidTimeZone(stored) ? stored : null
}

/** 고른 시간대. 저장값이 없거나 잘못됐으면 브라우저 시간대. */
export function getDisplayTimeZone(): string {
  return getStoredTimeZone() ?? browserTimeZone()
}

/** null 이면 선택을 지워 브라우저 시간대를 따른다. */
export function setDisplayTimeZone(tz: string | null): void {
  try {
    if (tz === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, tz)
  } catch {
    // 저장소를 못 쓰면(비공개 창 등) 이번 화면에만 반영되지 않을 뿐이다.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** 고른 시간대를 구독한다. 바꾸면 이 훅을 쓰는 화면이 다시 그려진다. */
export function useDisplayTimeZone(): string {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGE_EVENT, onChange)
      window.addEventListener('storage', onChange)
      return () => {
        window.removeEventListener(CHANGE_EVENT, onChange)
        window.removeEventListener('storage', onChange)
      }
    },
    getDisplayTimeZone,
  )
}

/** 시간대 표시가 없는 서버 값은 UTC 로 읽는다. `yyyy-MM-dd HH:mm:ss`, `T` 구분, 소수 초, 명시된 오프셋 모두 받는다. */
function parseUtc(value: string): Date | null {
  const v = value.trim().replace(' ', 'T')
  const hasZone = /(Z|[+-]\d\d:?\d\d)$/.test(v)
  const d = new Date(hasZone ? v : `${v}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** UTC 서버 시각 → [tz] 의 `yyyy-MM-dd HH:mm`. 값이 없거나 읽을 수 없으면 빈 문자열. */
export function formatUtcDateTime(value?: string | null, tz: string = getDisplayTimeZone()): string {
  if (!value) return ''
  const d = parseUtc(value)
  if (!d) return ''
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

/** `Asia/Seoul (UTC+9)`. 오프셋은 [at] 시점 기준(서머타임 반영). */
export function timeZoneLabel(tz: string, at: Date = new Date()): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value
  // 'GMT+09:00' → 'UTC+9', 'GMT' → 'UTC+0', 'GMT-04:00' → 'UTC-4', 'GMT+05:30' → 'UTC+5:30'
  const m = name?.match(/GMT([+-])(\d\d):(\d\d)/)
  const offset = m ? `UTC${m[1]}${Number(m[2])}${m[3] === '00' ? '' : `:${m[3]}`}` : 'UTC+0'
  return `${tz} (${offset})`
}
