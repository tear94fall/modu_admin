/** 날짜 칸(DateField)이 쓰는 달력 날짜 계산. 값은 "YYYY-MM-DD" 문자열이라 시간대가 끼지 않는다. */
export interface DatePreset {
  label: string
  /** 오늘(또는 기준일)을 받아 고를 날짜를 돌려준다. */
  pick: (base: string) => string
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export const pad = (n: number) => String(n).padStart(2, '0')

export function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

/** 브라우저 시간대와 상관없이 오늘(한국 날짜). */
export function todayKst(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return parts
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return toIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

export function endOfMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m, 0))
  return toIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** 입력 글자를 날짜로. 안 되면 null. */
export function parseDate(text: string): string | null {
  const digits = text.trim().replace(/[.\-/\s]+/g, '-')
  const m = /^(\d{4})-?(\d{1,2})-?(\d{1,2})-?$/.exec(digits) ?? /^(\d{4})(\d{2})(\d{2})$/.exec(text.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1) return null
  const last = Number(endOfMonth(toIso(y, mo, 1)).slice(8))
  if (d > last) return null
  return toIso(y, mo, d)
}

export const formatDisplay = (iso: string) => (iso ? iso.replaceAll('-', '.') : '')

/** 종료일 칸의 빠른 선택: 시작일 기준 기간. */
export const PERIOD_PRESETS: DatePreset[] = [
  { label: '1주', pick: (b) => addDays(b, 6) },
  { label: '2주', pick: (b) => addDays(b, 13) },
  { label: '30일', pick: (b) => addDays(b, 29) },
  { label: '그달 말', pick: (b) => endOfMonth(b) },
]

/** 시작일 칸의 빠른 선택. */
export const START_PRESETS: DatePreset[] = [
  { label: '내일', pick: (b) => addDays(b, 1) },
  { label: '다음 주', pick: (b) => addDays(b, 7) },
]
