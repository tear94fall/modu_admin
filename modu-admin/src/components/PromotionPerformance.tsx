import { useEffect, useState } from 'react'
import { getPromotionPerformance, type PromotionPerformance } from '../api/promotions'
import { errorMessage } from '../api/pushCampaigns'
import { formatPrice } from '../util/format'
import DayBars from './DayBars'
import PerfTile from './PerfTile'

const num = (n: number) => n.toLocaleString('ko-KR')

/** 기획전·이벤트 상세의 "성과" 카드 — 윗줄 타일, 아랫줄 표 또는 막대. 종류에 맞는 것만 그린다. */
export default function PromotionPerformanceSection({ promotionId }: { promotionId: string }) {
  const [data, setData] = useState<PromotionPerformance | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getPromotionPerformance(promotionId)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(errorMessage(err, '성과를 불러오지 못했습니다')))
    return () => {
      cancelled = true
    }
  }, [promotionId])

  const e = data?.exhibition
  const a = data?.attendance
  const c = data?.coupons
  const couponIssued = c?.reduce((s, r) => s + r.issued, 0) ?? 0
  const couponUsed = c?.reduce((s, r) => s + r.used, 0) ?? 0

  return (
    <section className="section-card perf" aria-label="성과">
      <div className="section-card-head">
        <h2 className="section-card-title">성과</h2>
        <span className="card-muted">{e ? '기간 안 결제 주문 중 기획전 상품이 든 것 · 취소 제외' : a ? '출석 기록 기준' : c ? '이벤트로 받아 간 쿠폰 기준' : ''}</span>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!error && !data && <p className="muted">불러오는 중…</p>}

      {e && (
        <>
          <div className="perf-tiles">
            <PerfTile label="상품 매출" value={formatPrice(e.sales)} sub="단가 × 수량" tone="amber" />
            <PerfTile label="주문" value={`${num(e.orders)}건`} sub={e.cancelledOrders > 0 ? `취소 ${num(e.cancelledOrders)}건 제외` : '취소 없음'} tone="indigo" />
            <PerfTile label="판매 수량" value={`${num(e.units)}개`} sub={e.orders > 0 ? `주문당 ${(e.units / e.orders).toFixed(1)}개` : '아직 없음'} tone="green" />
            <PerfTile label="팔린 상품" value={`${num(e.products.length)}종`} sub="기획전 상품 중" tone="violet" />
          </div>
          {e.products.length > 0 && (
            <table className="data-table perf-table">
              <thead>
                <tr>
                  <th>상품</th>
                  <th className="num-cell">수량</th>
                  <th className="num-cell">매출</th>
                </tr>
              </thead>
              <tbody>
                {e.products.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.name}</td>
                    <td className="num-cell">{num(p.units)}</td>
                    <td className="num-cell">{formatPrice(p.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {a && (
        <>
          <div className="perf-tiles">
            <PerfTile label="참여자" value={`${num(a.participants)}명`} sub="서로 다른 회원" tone="green" />
            <PerfTile label="출석" value={`${num(a.checks)}회`} sub={a.participants > 0 ? `1인당 ${(a.checks / a.participants).toFixed(1)}회` : '아직 없음'} tone="indigo" />
            <PerfTile label="지급 포인트" value={`${num(a.rewardPoints)}P`} sub={a.checks > 0 ? `회당 ${num(Math.round(a.rewardPoints / a.checks))}P` : undefined} tone="violet" />
            <PerfTile label="출석한 날" value={`${num(a.byDay.filter((d) => d.count > 0).length)}일`} sub={`기간 ${num(a.byDay.length)}일 중 한 명이라도 출석한 날`} tone="amber" />
          </div>
          {a.byDay.length > 0 && (
            <DayBars
              dates={a.byDay.map((d) => d.date)}
              series={[{ name: '출석', values: a.byDay.map((d) => d.count), fmt: (n) => `${num(n)}회` }]}
              tone="green"
              label="날짜별 출석"
            />
          )}
        </>
      )}

      {c && (
        <>
          <div className="perf-tiles">
            <PerfTile label="받아 간 쿠폰" value={`${num(couponIssued)}장`} sub={`쿠폰 ${num(c.length)}종`} tone="indigo" />
            <PerfTile label="사용" value={`${num(couponUsed)}장`} sub={couponIssued > 0 ? `사용률 ${Math.round((couponUsed / couponIssued) * 100)}%` : '아직 없음'} tone="violet" />
          </div>
          <table className="data-table perf-table">
            <thead>
              <tr>
                <th>쿠폰</th>
                <th className="num-cell">발급</th>
                <th className="num-cell">사용</th>
                <th className="num-cell">사용률</th>
              </tr>
            </thead>
            <tbody>
              {c.map((row) => (
                <tr key={row.couponId}>
                  <td>{row.name}</td>
                  <td className="num-cell">{num(row.issued)}장</td>
                  <td className="num-cell">{num(row.used)}장</td>
                  <td className="num-cell">{row.issued > 0 ? `${Math.round((row.used / row.issued) * 100)}%` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
