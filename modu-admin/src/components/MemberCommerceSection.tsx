import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { type AdminCustomerDetail, getCustomer, isAgreed } from '../api/customers'
import { getTiers, type TierSummary } from '../api/tiers'
import { formatPrice } from '../util/format'
import { formatUtcDateTime } from '../util/timeZone'
import { CommerceBadge } from './TierBadge'
import TierHistoryTable from './TierHistoryTable'

const kst = (v: string | null | undefined) => formatUtcDateTime(v, 'Asia/Seoul') || '-'

type State =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'error' }
  | { kind: 'customer'; customer: AdminCustomerDetail }

/**
 * 회원 상세의 커머스 칸. 커머스 고객이면 가입·동의 시각, 금액, 등급 이력과 고객 화면 링크를 보여 준다.
 * 고객이 아니면(404) 한 줄 안내, 못 읽으면 흐린 안내만 — 회원 화면은 그대로 쓸 수 있어야 한다.
 */
export default function MemberCommerceSection({ userId }: { userId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [tiers, setTiers] = useState<TierSummary[]>([])

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    getCustomer(userId)
      .then((customer) => {
        if (!cancelled) setState({ kind: 'customer', customer })
      })
      .catch((err) => {
        if (!cancelled) setState(err instanceof ApiError && err.status === 404 ? { kind: 'none' } : { kind: 'error' })
      })
    // 이력의 등급 코드를 이름·색으로 바꾸는 데만 쓴다. 못 읽으면 코드가 보인다.
    getTiers()
      .then((list) => {
        if (!cancelled) setTiers(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <section className="info-card commerce-card" aria-label="커머스">
      <h2 className="commerce-card-title">커머스</h2>
      {state.kind === 'loading' && <p className="card-muted">불러오는 중...</p>}
      {state.kind === 'none' && <p className="card-muted">커머스 고객이 아닙니다</p>}
      {state.kind === 'error' && <p className="card-muted">커머스 정보를 불러오지 못했습니다</p>}
      {state.kind === 'customer' && <CustomerSummary customer={state.customer} tiers={tiers} />}
    </section>
  )
}

function CustomerSummary({ customer: c, tiers }: { customer: AdminCustomerDetail; tiers: TierSummary[] }) {
  const agreed = isAgreed(c)
  return (
    <>
      <div className="commerce-card-head">
        <CommerceBadge customer={{ userId: c.userId, status: c.status, tier: c.tier, agreed }} />
        <Link to={`/customers/${encodeURIComponent(c.userId)}`}>고객 화면 →</Link>
      </div>
      <dl className="detail-grid">
        <dt>커머스 가입</dt>
        <dd>
          {kst(c.joinedAt)}
          {c.migrated && <span className="card-muted"> (이전 이용 기록으로 등록)</span>}
        </dd>
        <dt>약관 동의</dt>
        <dd>{c.termsAgreedAt ? kst(c.termsAgreedAt) : '동의 전'}</dd>
        <dt>개인정보 동의</dt>
        <dd>{c.privacyAgreedAt ? kst(c.privacyAgreedAt) : '동의 전'}</dd>
        <dt>등급 기준 금액</dt>
        <dd>{formatPrice(c.basisAmount)}</dd>
        <dt>최근 6개월 구매</dt>
        <dd>{formatPrice(c.rollingAmount)}</dd>
      </dl>
      <h3 className="commerce-card-subtitle">등급 이력</h3>
      <TierHistoryTable history={c.tierHistory ?? []} tiers={tiers} />
    </>
  )
}
