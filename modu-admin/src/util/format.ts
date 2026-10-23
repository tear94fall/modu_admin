export function formatDateTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 직원 권한. 서버(member-service staff)가 이 순서로 내려준다. */
export type StaffPermission = 'SUPER' | 'ADMIN' | 'SYSTEM' | 'INTERNAL'

export const STAFF_LABELS: Record<StaffPermission, string> = {
  SUPER: '최상위',
  ADMIN: '어드민',
  SYSTEM: '시스템',
  INTERNAL: '인터널',
}

/** 89000 → "89,000원". 앱의 가격 표기와 같게 둔다. */
export function formatPrice(price: number): string {
  return `${price.toLocaleString('ko-KR')}원`
}

/** '2026-10-23' → '10.23' (막대 라벨·기간 문구). */
export const shortMonthDay = (iso: string) => iso.slice(5).replace('-', '.')

