import type { CustomerLookup } from '../api/customers'
import { type MemberService, SERVICE_LABELS } from '../api/members'
import { CommerceBadge } from './TierBadge'

interface Props {
  /** 회원 서비스가 준 이용 기록. */
  services?: MemberService[]
  /** 커머스 고객 조회 결과. 있으면 등급 색 배지("커머스 · 골드"), 없는데 이용 기록만 있으면 회색 "커머스". */
  customer?: CustomerLookup | null
  /** 아무 서비스도 안 쓸 때 보일 것. null 이면 아무것도 그리지 않는다. */
  empty?: string | null
}

/** "이용 서비스" 배지: 채팅(무채색) + 커머스(등급 색). 회원 목록과 회원 상세 프로필이 같이 쓴다. */
export default function ServiceBadges({ services, customer, empty = '-' }: Props) {
  const chat = services?.includes('CHAT') ?? false
  const commerce = !!customer || (services?.includes('COMMERCE') ?? false)
  if (!chat && !commerce) return empty === null ? null : <span className="card-muted">{empty}</span>
  return (
    <span className="service-badges">
      {chat && <ServiceBadge service="CHAT" />}
      {commerce && <ServiceBadge service="COMMERCE" customer={customer} />}
    </span>
  )
}

/** 서비스 하나의 배지. 커머스는 고객이면 등급 색, 아니면 다른 서비스처럼 무채색. */
export function ServiceBadge({ service, customer }: { service: MemberService; customer?: CustomerLookup | null }) {
  if (service === 'COMMERCE' && customer) return <CommerceBadge customer={customer} />
  return <span className="tier-badge service-badge">{SERVICE_LABELS[service] ?? service}</span>
}
