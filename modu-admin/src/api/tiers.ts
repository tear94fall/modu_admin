import { api, PAGE_SIZE } from './client'
import type { Page } from './members'

/** 등급 한 줄 요약. earnRate 는 퍼센트(3 이면 3%), minAmount 는 원. color 는 #RRGGBB. */
export interface TierSummary {
  code: string
  name: string
  color: string
  earnRate: number
  minAmount: number
}

/** 등급의 매월 쿠폰. discountLabel 은 서버가 채워 줄 때만 있다("3,000원" · "10%"). */
export interface TierCoupon {
  id: number
  name: string
  discountLabel?: string | null
}

export interface AdminTier extends TierSummary {
  sortOrder: number
  coupons: TierCoupon[]
  customerCount: number
}

/** PUT 본문 한 줄. 코드는 바꿀 수 없고 4개 모두 보낸다. */
export interface TierInput {
  code: string
  name: string
  color: string
  minAmount: number
  earnRate: number
  couponIds: number[]
}

export type TierRunStatus = 'RUNNING' | 'DONE' | 'FAILED'
export type TierRunReason = 'MONTHLY' | 'MANUAL'

/** 등급 산정 한 번. 시각(startedAt·finishedAt)은 시간대 없는 UTC 값이다. countsByTier 는 {"GOLD": 3} (JSON 문자열로 올 수도 있다). */
export interface TierRun {
  id: number
  periodLabel: string
  startedAt: string | null
  finishedAt: string | null
  reason: TierRunReason
  customers: number
  changed: number
  countsByTier: Record<string, number> | string | null
  couponsIssued: number
  couponsSkipped: number
  status: TierRunStatus
  message: string | null
}

export const RUN_STATUS_LABELS: Record<TierRunStatus, string> = { RUNNING: '산정 중', DONE: '완료', FAILED: '실패' }
export const RUN_REASON_LABELS: Record<TierRunReason, string> = { MONTHLY: '정기', MANUAL: '수동' }

/** 산정 중 주황 · 완료 초록 · 실패 빨강. */
export const runStatusClass = (status: TierRunStatus) =>
  status === 'RUNNING' ? 'status-badge status-badge--amber' : status === 'DONE' ? 'status-badge status-badge--done' : 'status-badge status-badge--cancelled'

/** 서버 규칙: 적립률 0..20%. */
export const MAX_EARN_RATE = 20
export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
export const MAX_TIER_NAME = 20
/** 색이 이상하면 쓰는 회색(웰컴 기본색). */
export const FALLBACK_TIER_COLOR = '#64748B'

const BASE = '/commerce-service/api-admin/v1/tiers'

/** sortOrder 순(낮은 등급 먼저). */
export const getTiers = () => api<AdminTier[]>(BASE).then((list) => [...list].sort((a, b) => a.sortOrder - b.sortOrder))

export const updateTiers = (input: TierInput[]) =>
  api<AdminTier[]>(BASE, { method: 'PUT', body: JSON.stringify(input) }).then((list) => [...list].sort((a, b) => a.sortOrder - b.sortOrder))

export const getTierRuns = (page: number) =>
  api<Page<TierRun>>(`${BASE}/runs?${new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) }).toString()}`)

/** 지금 다시 산정. 202 로 RUNNING 인 산정 한 건이 온다. 이미 산정 중이면 409. */
export const startTierRun = () => api<TierRun>(`${BASE}/runs`, { method: 'POST' })

/** countsByTier 를 객체로. 문자열이면 JSON 으로 읽고, 못 읽으면 빈 객체. */
export function parseCountsByTier(value: TierRun['countsByTier']): Record<string, number> {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

/** 산정 중인 줄이 있으면 이 간격으로 산정 목록을 다시 읽는다. */
export const RUN_POLL_MS = 2000

/** 산정 한 건의 등급별 인원: "웰컴 12 · 실버 3 · 골드 1". 등급 순서를 따르고 모르는 코드는 뒤에 붙인다. */
export function countsText(run: Pick<TierRun, 'countsByTier'>, tiers: Pick<TierSummary, 'code' | 'name'>[]): string {
  const counts = parseCountsByTier(run.countsByTier)
  const n = (code: string) => Number(counts[code] ?? 0).toLocaleString('ko-KR')
  const known = tiers.filter((t) => t.code in counts).map((t) => `${t.name} ${n(t.code)}`)
  const unknown = Object.keys(counts)
    .filter((code) => !tiers.some((t) => t.code === code))
    .map((code) => `${code} ${n(code)}`)
  const all = [...known, ...unknown]
  return all.length > 0 ? all.join(' · ') : '-'
}

/** 편집 중인 한 줄. 숫자 칸은 입력 그대로(문자열) 들고 있다. */
export interface TierDraft {
  code: string
  name: string
  color: string
  minAmount: string
  earnRate: string
  coupons: TierCoupon[]
}

export const toDraft = (t: AdminTier): TierDraft => ({
  code: t.code,
  name: t.name,
  color: t.color,
  minAmount: String(t.minAmount),
  earnRate: String(t.earnRate),
  coupons: t.coupons ?? [],
})

const wholeNumber = (s: string): number | null => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null)

/**
 * 폼 값 검사. 서버 규칙(이름 필수, 색 #RRGGBB, 가장 낮은 등급 기준 0원, 기준 금액은 위로 갈수록 커짐, 적립률 0..20 정수)을 먼저 본다.
 * drafts 는 낮은 등급부터. 통과하면 null, 아니면 첫 번째 이유.
 */
export function validateTiers(drafts: TierDraft[]): string | null {
  let previous: number | null = null
  for (const [i, d] of drafts.entries()) {
    const label = d.name.trim() || d.code
    if (d.name.trim() === '') return `${d.code} 등급 이름을 입력하세요`
    if (d.name.trim().length > MAX_TIER_NAME) return `${label}: 등급 이름은 ${MAX_TIER_NAME}자까지입니다`
    if (!HEX_COLOR.test(d.color.trim())) return `${label}: 색은 #RRGGBB 형식이어야 합니다`
    const min = wholeNumber(d.minAmount)
    if (min === null) return `${label}: 기준 금액은 0 이상의 정수여야 합니다`
    if (i === 0 && min !== 0) return `가장 낮은 등급(${label})의 기준 금액은 0원이어야 합니다`
    if (previous !== null && min <= previous) return `${label}: 기준 금액은 아래 등급보다 커야 합니다`
    previous = min
    const rate = wholeNumber(d.earnRate)
    if (rate === null || rate > MAX_EARN_RATE) return `${label}: 적립률은 0~${MAX_EARN_RATE}% 사이의 정수여야 합니다`
  }
  return null
}

/** 검사를 통과한 폼 값 → PUT 본문. */
export const toTierInputs = (drafts: TierDraft[]): TierInput[] =>
  drafts.map((d) => ({
    code: d.code,
    name: d.name.trim(),
    color: d.color.trim().toUpperCase(),
    minAmount: Number(d.minAmount.trim()),
    earnRate: Number(d.earnRate.trim()),
    couponIds: d.coupons.map((c) => c.id),
  }))

/** 다음 등급까지. 등급 목록을 못 읽었거나 지금 등급이 목록에 없으면 null(진행 막대를 숨긴다). */
export type NextTierProgress =
  | { kind: 'top' }
  | { kind: 'next'; next: TierSummary; remaining: number; ratio: number }

/** 등급 목록(기준 금액 오름차순으로 다시 정렬)과 최근 6개월 금액으로 다음 등급까지 남은 금액을 구한다. */
export function nextTierProgress(tiers: TierSummary[], currentCode: string, rollingAmount: number): NextTierProgress | null {
  const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount)
  const index = sorted.findIndex((t) => t.code === currentCode)
  if (index < 0) return null
  const next = sorted.slice(index + 1).find((t) => t.minAmount > sorted[index].minAmount)
  if (!next) return { kind: 'top' }
  const remaining = Math.max(0, next.minAmount - rollingAmount)
  const ratio = next.minAmount > 0 ? Math.min(1, Math.max(0, rollingAmount / next.minAmount)) : 1
  return { kind: 'next', next, remaining, ratio }
}
