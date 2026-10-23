import { useEffect, useState } from 'react'
import { type CouponPerformance, getCouponPerformance, SOURCE_LABELS } from '../api/coupons'
import { errorMessage } from '../api/pushCampaigns'
import { formatPrice } from '../util/format'
import { useDisplayTimeZone } from '../util/timeZone'
import DayBars from './DayBars'
import PerfTile, { PerfRow } from './PerfTile'

const num = (n: number) => n.toLocaleString('ko-KR')
/** 사용 추이 며칠 치(오늘 포함). */
export const PERFORMANCE_DAYS = 14

/** 쿠폰 카드에서 쓰는 쿠폰 자체의 수량 정보(상세 응답). */
export interface CouponQuantity {
  issuedCount: number
  totalQuantity: number | null
}

/**
 * 쿠폰 상세의 "성과" 카드 하나 — 윗줄 타일(발급·사용률·쿠폰 주문·매출 기여), 아랫줄 [세부 지표 | 14일 사용 추이].
 * 예전의 "발급 요약" 카드가 하던 발급·남은 수량도 여기에 들어온다. 저장된 쿠폰(편집 모드)에서만 보인다.
 */
export default function CouponPerformanceSection({ couponId, coupon }: { couponId: string; coupon: CouponQuantity }) {
  const zone = useDisplayTimeZone()
  const [data, setData] = useState<CouponPerformance | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getCouponPerformance(couponId, PERFORMANCE_DAYS, zone)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(errorMessage(err, '성과를 불러오지 못했습니다')))
    return () => {
      cancelled = true
    }
  }, [couponId, zone])

  const remaining = coupon.totalQuantity == null ? null : Math.max(0, coupon.totalQuantity - coupon.issuedCount)

  return (
    <section className="section-card perf" aria-label="성과">
      <div className="section-card-head">
        <h2 className="section-card-title">성과</h2>
        <span className="card-muted">장 수는 받은 쿠폰, 돈은 이 쿠폰을 쓴 주문 기준 · 취소 제외</span>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!error && !data && <p className="muted">불러오는 중…</p>}
      {data && (
        <>
          <div className="perf-tiles">
            <PerfTile
              label="발급"
              value={`${num(data.issued)}장`}
              sub={coupon.totalQuantity == null ? '총 수량 무제한' : `총 ${num(coupon.totalQuantity)}장 중 · 남은 ${num(remaining ?? 0)}장`}
              tone="indigo"
            />
            <PerfTile
              label="사용률"
              value={data.usageRate == null ? '–' : `${data.usageRate}%`}
              sub={`사용 ${num(data.used)} · 사용 가능 ${num(data.available)} · 만료 ${num(data.expired)}`}
              tone="violet"
            />
            <PerfTile
              label="쿠폰 주문"
              value={`${num(data.orders)}건`}
              sub={data.cancelledOrders > 0 ? `취소 ${num(data.cancelledOrders)}건 제외` : '취소 없음'}
              tone="amber"
            />
            <PerfTile
              label="매출 기여"
              value={formatPrice(data.revenue)}
              sub={`할인 총액 ${formatPrice(data.discountTotal)}`}
              tone="green"
            />
          </div>
          <div className="perf-body">
            <div className="home-metrics">
              <PerfRow label="주문당 실결제액" value={data.avgOrderAmount == null ? '–' : formatPrice(data.avgOrderAmount)} sub="상품 − 쿠폰 − 포인트" />
              <PerfRow label="주문당 할인" value={data.orders > 0 ? formatPrice(Math.round(data.discountTotal / data.orders)) : '–'} />
              <PerfRow label="사용 가능 / 만료" value={`${num(data.available)} / ${num(data.expired)}장`} />
              <div className="home-metric perf-sources" aria-label="발급 경로">
                <span className="home-metric-label">발급 경로</span>
                <span className="perf-chips">
                  {data.bySource.length === 0 && <span className="card-muted">아직 없음</span>}
                  {data.bySource.map((s) => (
                    <span key={s.source} className="status-pill">
                      {SOURCE_LABELS[s.source] ?? s.source} {num(s.count)}장
                    </span>
                  ))}
                </span>
              </div>
            </div>
            <DayBars
              dates={data.usedByDay.map((d) => d.date)}
              series={[{ name: '사용', values: data.usedByDay.map((d) => d.count), fmt: (n) => `${num(n)}장` }]}
              tone="violet"
              label={`${data.days}일 사용 추이`}
            />
          </div>
        </>
      )}
    </section>
  )
}
