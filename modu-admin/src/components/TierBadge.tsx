import type { CSSProperties } from 'react'
import type { CustomerLookup } from '../api/customers'
import { FALLBACK_TIER_COLOR, HEX_COLOR, type TierSummary } from '../api/tiers'

/** 등급 색으로 칠한 배지 모양. 글자는 등급 색, 바탕은 옅게. */
function tierBadgeStyle(color: string | null | undefined): CSSProperties {
  const c = color && HEX_COLOR.test(color) ? color : FALLBACK_TIER_COLOR
  return { color: c, background: `${c}1A`, borderColor: `${c}66` }
}

interface TierBadgeProps {
  tier: Pick<TierSummary, 'name' | 'color'> | null | undefined
  /** 등급 이름 앞에 붙는 말. 예: "커머스" → "커머스 · 골드" */
  prefix?: string
  /** tier 가 없을 때 보일 글자(예: 코드). */
  fallback?: string
}

export default function TierBadge({ tier, prefix, fallback }: TierBadgeProps) {
  const name = tier?.name ?? fallback
  if (!name) return null
  return (
    <span className="tier-badge" style={tierBadgeStyle(tier?.color)}>
      {prefix ? `${prefix} · ${name}` : name}
    </span>
  )
}

/**
 * 회원 목록·상세의 커머스 배지. 동의한 고객은 등급 색 "커머스 · 골드", 약관 동의 전(옛 이용 기록으로 만든 고객)은 흐린 "커머스 · 동의 전",
 * 탈퇴한 고객은 흐린 "커머스 · 탈퇴". 고객이 아니면(조회 결과 없음) 아무것도 그리지 않는다.
 */
export function CommerceBadge({ customer }: { customer: CustomerLookup | null | undefined }) {
  if (!customer) return null
  if (customer.status === 'WITHDRAWN') return <span className="tier-badge tier-badge--muted">커머스 · 탈퇴</span>
  if (!customer.agreed) return <span className="tier-badge tier-badge--muted">커머스 · 동의 전</span>
  return <TierBadge tier={customer.tier} prefix="커머스" />
}
