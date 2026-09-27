import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { type AdminCustomerDetail, getCustomer, isAgreed } from '../api/customers'
import { errorMessage } from '../api/pushCampaigns'
import { getTiers, type TierSummary } from '../api/tiers'
import TierBadge from '../components/TierBadge'
import TierHistoryTable from '../components/TierHistoryTable'
import { formatPrice } from '../util/format'
import { formatUtcDateTime } from '../util/timeZone'

const kst = (v: string | null) => formatUtcDateTime(v, 'Asia/Seoul') || '-'

/** /customers/:userId. 고객 정보(동의·금액)와 등급 이력. */
export default function CustomerDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null)
  const [tiers, setTiers] = useState<TierSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setError(null)
    getCustomer(userId)
      .then((c) => {
        if (!cancelled) setCustomer(c)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setError(errorMessage(err, '고객 정보를 불러오지 못했습니다'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    getTiers()
      .then((list) => {
        if (!cancelled) setTiers(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  const backLink = (
    <Link to="/customers" className="back-link">
      ← 고객 목록
    </Link>
  )

  if (loading) return <p>불러오는 중...</p>
  if (!customer)
    return (
      <div>
        {backLink}
        {notFound || !error ? <p>고객을 찾을 수 없습니다</p> : <p className="error-text">{error}</p>}
      </div>
    )

  const c = customer
  return (
    <div>
      {backLink}
      <div className="info-card">
        <h1 className="customer-title">
          {c.name ?? c.userId} <TierBadge tier={c.tier} />
          {c.status === 'WITHDRAWN' && <span className="status-badge status-badge--cancelled">탈퇴</span>}
        </h1>
        <dl className="detail-grid">
          <dt>이메일</dt>
          <dd>{c.email ?? '-'}</dd>
          <dt>사용자 ID</dt>
          <dd>{c.userId}</dd>
          <dt>커머스 가입</dt>
          <dd>
            {kst(c.joinedAt)}
            {c.migrated && <span className="card-muted"> (이전 이용 기록으로 등록)</span>}
          </dd>
          <dt>약관 동의</dt>
          <dd>{c.termsAgreedAt ? kst(c.termsAgreedAt) : '동의 전'}</dd>
          <dt>개인정보 동의</dt>
          <dd>{c.privacyAgreedAt ? kst(c.privacyAgreedAt) : '동의 전'}</dd>
          <dt>상태</dt>
          <dd>{c.status === 'WITHDRAWN' ? '탈퇴' : isAgreed(c) ? '이용 중' : '약관 동의 전'}</dd>
          <dt>등급</dt>
          <dd>
            {c.tier.name} · 적립 {c.tier.earnRate}%
          </dd>
          <dt>등급 기준 금액</dt>
          <dd>{formatPrice(c.basisAmount)}</dd>
          <dt>최근 6개월 구매</dt>
          <dd>{formatPrice(c.rollingAmount)}</dd>
        </dl>
        <p className="form-hint">
          시각은 한국 시간입니다. 기준 금액은 지금 등급을 정한 금액, 최근 6개월은 이번 달까지의 배송 완료 금액입니다.
        </p>
      </div>

      <h2>등급 이력</h2>
      <TierHistoryTable history={c.tierHistory ?? []} tiers={tiers} />
    </div>
  )
}
