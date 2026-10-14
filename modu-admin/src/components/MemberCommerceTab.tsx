import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type AdminCustomer,
  type CustomerOrderStatus,
  type CustomerSummary,
  getCustomer,
  getCustomerSummary,
  isAgreed,
  type TierHistoryEntry,
} from '../api/customers'
import { ORDER_STATUS_LABELS } from '../api/orders'
import { getTiers, nextTierProgress, type TierSummary } from '../api/tiers'
import { statusClass } from '../pages/OrdersPage'
import { formatPrice } from '../util/format'
import { formatUtcDateTime } from '../util/timeZone'
import TierBadge from './TierBadge'
import TierHistoryTable from './TierHistoryTable'

const kst = (v: string | null | undefined) => formatUtcDateTime(v, 'Asia/Seoul') || '-'
const ORDER_STATUSES: CustomerOrderStatus[] = ['PAID', 'SHIPPING', 'DELIVERED', 'CANCELLED']
/** 주문 막대 아래 범례용 짧은 이름. */
const ORDER_SHORT_LABELS: Record<CustomerOrderStatus, string> = { PAID: '결제', SHIPPING: '배송중', DELIVERED: '완료', CANCELLED: '취소' }
const count = (n: number | undefined) => (n ?? 0).toLocaleString('ko-KR')

type SummaryState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; summary: CustomerSummary }
/** 등급 이력은 따로 읽는다. 못 읽어도 요약은 그대로 보인다. */
type HistoryState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; history: TierHistoryEntry[] }

/**
 * 회원 상세의 커머스 탭. 탭을 열 때 처음 읽는다(요약 + 등급 이력 + 등급 목록). 커머스가 실패해도 이 탭 안에만 안내가 뜬다.
 * 배치: 등급·가입 카드 → 숫자 4칸 → 최근 주문 → 등급 이력. 시각은 모두 한국 시간.
 */
export default function MemberCommerceTab({ userId }: { userId: string }) {
  const [summary, setSummary] = useState<SummaryState>({ kind: 'loading' })
  const [history, setHistory] = useState<HistoryState>({ kind: 'loading' })
  const [tiers, setTiers] = useState<TierSummary[]>([])

  useEffect(() => {
    let cancelled = false
    setSummary({ kind: 'loading' })
    setHistory({ kind: 'loading' })
    getCustomerSummary(userId)
      .then((s) => {
        if (!cancelled) setSummary({ kind: 'ok', summary: s })
      })
      .catch(() => {
        if (!cancelled) setSummary({ kind: 'error' })
      })
    getCustomer(userId)
      .then((c) => {
        if (!cancelled) setHistory({ kind: 'ok', history: c.tierHistory ?? [] })
      })
      .catch(() => {
        // 고객이 아니면(404) 이력도 없다. 그 밖의 실패만 안내한다 — 요약 쪽에서 고객 여부가 보인다.
        if (!cancelled) setHistory({ kind: 'error' })
      })
    // 이력의 등급 이름·색과 다음 등급까지 남은 금액에 쓴다. 못 읽으면 코드가 보이고 진행 막대가 빠진다.
    getTiers()
      .then((list) => {
        if (!cancelled) setTiers(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  if (summary.kind === 'loading') return <p className="card-muted">불러오는 중...</p>
  if (summary.kind === 'error') return <p className="error-text">커머스 정보를 불러오지 못했습니다</p>

  const s = summary.summary
  const orderTotal = ORDER_STATUSES.reduce((sum, st) => sum + (s.orderCounts?.[st] ?? 0), 0)
  return (
    <div className="member-tab-body member-commerce-tab">
      {s.customer ? (
        <div className="commerce-top">
          <TierCard customer={s.customer} tiers={tiers} />
          <AgreementCard customer={s.customer} />
        </div>
      ) : (
        <p className="card-muted">커머스 고객 정보가 없어요(약관 동의 기록 없음)</p>
      )}

      <div className="kpi-grid kpi-grid--4">
        <div className="kpi">
          <div className="kpi-label">배송 완료 누적</div>
          <div className="kpi-value">{formatPrice(s.deliveredAmountTotal ?? 0)}</div>
          <div className="kpi-sub">마지막 주문 {kst(s.lastOrderAt)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">주문</div>
          <div className="kpi-value">{count(orderTotal)}건</div>
          <div className="order-bar" aria-hidden="true">
            {orderTotal > 0 &&
              ORDER_STATUSES.map((st) => {
                const n = s.orderCounts?.[st] ?? 0
                return n > 0 ? <span key={st} className={`order-bar-seg order-bar-seg--${st.toLowerCase()}`} style={{ flexGrow: n }} /> : null
              })}
          </div>
          <div className="kpi-sub order-legend">
            {ORDER_STATUSES.map((st) => (
              <span key={st} title={ORDER_STATUS_LABELS[st]}>
                <i className={`order-dot order-bar-seg--${st.toLowerCase()}`} aria-hidden="true" />
                {ORDER_SHORT_LABELS[st]} {count(s.orderCounts?.[st])}
              </span>
            ))}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">쿠폰</div>
          <div className="kpi-value">보유 {count(s.coupons?.available)}장</div>
          <div className="kpi-sub">
            사용 {count(s.coupons?.used)} · 만료 {count(s.coupons?.expired)}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">찜 · 리뷰</div>
          <div className="kpi-pair">
            <div>
              <div className="kpi-value">{count(s.wishlistCount)}</div>
              <div className="kpi-sub">찜</div>
            </div>
            <div>
              <div className="kpi-value">{count(s.reviewCount)}</div>
              <div className="kpi-sub">리뷰</div>
            </div>
          </div>
        </div>
      </div>

      <section className="sub-card" aria-label="최근 주문">
        <h3 className="sub-card-title">최근 주문</h3>
        {(s.recentOrders ?? []).length === 0 ? (
          <p className="card-muted sub-card-empty">주문이 없습니다</p>
        ) : (
          <div className="table-scroll">
            <table className="recent-orders-table sub-card-table">
              <thead>
                <tr>
                  <th>주문번호</th>
                  <th>상품</th>
                  <th>상태</th>
                  <th className="amount-cell">결제 금액</th>
                  <th>주문 시각</th>
                </tr>
              </thead>
              <tbody>
                {s.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`}>{o.orderNo}</Link>
                    </td>
                    <td className="recent-orders-item" title={o.itemSummary}>
                      {o.itemSummary}
                    </td>
                    <td>
                      <span className={statusClass(o.status)}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                    </td>
                    <td className="amount-cell">{formatPrice(o.paymentAmount)}</td>
                    <td className="nowrap">{kst(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sub-card" aria-label="등급 이력">
        <h3 className="sub-card-title">등급 이력</h3>
        {history.kind === 'loading' && <p className="card-muted sub-card-empty">불러오는 중...</p>}
        {history.kind === 'error' && (
          <p className="card-muted sub-card-empty">{s.customer ? '등급 이력을 불러오지 못했습니다' : '등급 변경 이력이 없어요'}</p>
        )}
        {history.kind === 'ok' && <TierHistoryTable history={history.history} tiers={tiers} />}
      </section>
    </div>
  )
}

/** 등급 카드: 큰 배지·적립률, 기준·최근 6개월 금액, 다음 등급까지 진행 막대. */
function TierCard({ customer: c, tiers }: { customer: AdminCustomer; tiers: TierSummary[] }) {
  const progress = nextTierProgress(tiers, c.tier.code, c.rollingAmount)
  return (
    <section className="sub-card tier-card" aria-label="커머스 등급">
      <div className="tier-card-head">
        {c.status === 'WITHDRAWN' ? (
          <span className="tier-badge tier-badge--lg tier-badge--muted">탈퇴</span>
        ) : (
          <TierBadge tier={c.tier} size="lg" />
        )}
        <span className="tier-card-rate">적립 {c.tier.earnRate}%</span>
      </div>
      <div className="tier-card-stats">
        <div>
          <div className="kpi-label">기준 금액</div>
          <div className="kpi-value">{formatPrice(c.basisAmount)}</div>
        </div>
        <div>
          <div className="kpi-label">최근 6개월</div>
          <div className="kpi-value">{formatPrice(c.rollingAmount)}</div>
        </div>
      </div>
      {progress && (
        <div className="tier-progress">
          <div
            className="tier-progress-track"
            role="progressbar"
            aria-label="다음 등급까지"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((progress.kind === 'top' ? 1 : progress.ratio) * 100)}
          >
            <span
              className="tier-progress-fill"
              style={{
                width: `${(progress.kind === 'top' ? 1 : progress.ratio) * 100}%`,
                background: progress.kind === 'next' ? progress.next.color : c.tier.color,
              }}
            />
          </div>
          <div className="tier-progress-text">
            {progress.kind === 'top'
              ? '최고 등급'
              : progress.remaining > 0
                ? `${progress.next.name}까지 ${formatPrice(progress.remaining)}`
                : `${progress.next.name} 기준 달성`}
          </div>
        </div>
      )}
      <p className="form-hint tier-card-note">기준 금액은 지금 등급을 정한 지난 6개월 배송 완료 금액, 최근 6개월은 이번 달까지의 금액입니다.</p>
    </section>
  )
}

/** 가입·약관 카드. 동의 전(옛 이용 기록으로 만든 고객)이면 동의 시각 대신 "약관 동의 전". */
function AgreementCard({ customer: c }: { customer: AdminCustomer }) {
  const agreed = isAgreed(c)
  return (
    <section className="sub-card agreement-card" aria-label="커머스 가입">
      <dl className="compact-facts">
        <dt>커머스 가입</dt>
        <dd>
          {kst(c.joinedAt)}
          {c.migrated && <div className="card-muted compact-facts-note">이전 이용 기록으로 등록</div>}
        </dd>
        {agreed ? (
          <>
            <dt>약관 동의</dt>
            <dd>{kst(c.termsAgreedAt)}</dd>
            <dt>개인정보 동의</dt>
            <dd>{kst(c.privacyAgreedAt)}</dd>
          </>
        ) : (
          <>
            <dt>약관</dt>
            <dd>
              <span className="status-badge status-badge--amber">약관 동의 전</span>
            </dd>
          </>
        )}
      </dl>
    </section>
  )
}
