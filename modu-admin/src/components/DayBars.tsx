import { useEffect, useRef, useState } from 'react'
import { shortMonthDay as shortDate } from '../util/format'

/** 날짜별 막대(홈 지표·쿠폰/기획전 성과가 같이 쓴다). 색은 tone 하나, 마지막 날(오늘)은 진하게. */
export type Tone = 'indigo' | 'green' | 'amber' | 'violet'

export interface Series {
  name: string
  values: number[]
  fmt: (n: number) => string
}

/** 값 라벨을 막대 위에 쓸 수 있는 최대 날 수 — 더 길면 최고·오늘만 쓴다. */
const LABEL_EVERY_BAR_UPTO = 14
/** 막대가 이보다 많으면 촘촘한 모드 — 막대 간격 1px, 값 라벨은 최고·오늘만. 아니면 90개 × 간격이 카드보다 넓어진다. */
const DENSE_FROM = 31
/** 날짜 라벨("10.23") 하나가 차지하는 폭(px). 막대 하나의 폭이 이보다 좁으면 라벨을 건너뛴다. */
const DATE_LABEL_WIDTH = 38

/** 요소의 폭을 돌려준다(ResizeObserver). 처음엔 0 — 라벨은 첫날·마지막 날만. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? 0))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * 머리줄에 합계·오늘·최고를 적고, 막대 위에 값을 쓴다(날이 많으면 최고·오늘만). 가로 눈금은 최고의 절반·최고.
 * 여러 계열이면 날짜마다 나란히(두 번째 계열은 옅게) + 범례에 계열별 합계.
 */
export default function DayBars({ dates, series, tone, label = '7일 추이' }: { dates: string[]; series: Series[]; tone: Tone; label?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const [plotRef, plotWidth] = useWidth<HTMLDivElement>()
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const main = series[0]
  const total = main?.values.reduce((a, b) => a + b, 0) ?? 0
  const last = main?.values[main.values.length - 1] ?? 0
  const peakIndex = main ? main.values.indexOf(Math.max(...main.values)) : -1
  const labelAll = dates.length <= LABEL_EVERY_BAR_UPTO
  const showValue = (i: number, v: number) => v > 0 && (labelAll || i === peakIndex || i === dates.length - 1)
  // 폭이 허락하는 만큼 날짜 라벨을 더 쓴다(하루 단위라는 게 보이게). 마지막 날은 늘 쓰고, 그와 겹치는 직전 라벨은 뺀다.
  const perDay = plotWidth > 0 ? plotWidth / dates.length : 0
  const step = perDay > 0 ? Math.max(1, Math.ceil(DATE_LABEL_WIDTH / perDay)) : Math.max(1, dates.length - 1)
  const xLabel = (i: number) => {
    const last = dates.length - 1
    if (i === last) return shortDate(dates[i])
    if (i % step !== 0) return ''
    return last - i < step ? '' : shortDate(dates[i])
  }
  return (
    <div className={`home-chart home-chart--${tone}${dates.length > DENSE_FROM ? ' home-chart--dense' : ''}`} aria-label={label}>
      <div className="home-chart-head">
        <span className="home-chart-title">{label}</span>
        {main && (
          <span className="home-chart-sum">
            합계 <b>{main.fmt(total)}</b> · 오늘 <b>{main.fmt(last)}</b>
            {peakIndex >= 0 && main.values[peakIndex] > 0 && (
              <>
                {' '}
                · 최고 <b>{main.fmt(main.values[peakIndex])}</b> ({shortDate(dates[peakIndex])})
              </>
            )}
          </span>
        )}
      </div>
      <div className="home-chart-plot" ref={plotRef} onMouseLeave={() => setHover(null)}>
        <span className="home-chart-grid home-chart-grid--top" aria-hidden="true" />
        <span className="home-chart-grid home-chart-grid--mid" aria-hidden="true" />
        {hover != null && (
          <div
            className={`home-chart-tip${hover > dates.length / 2 ? ' home-chart-tip--left' : ''}`}
            role="tooltip"
            style={{ left: `${((hover + 0.5) / dates.length) * 100}%` }}
          >
            <div className="home-chart-tip-date">
              {dates[hover]}
              {hover === dates.length - 1 && ' · 오늘'}
            </div>
            {series.map((s) => {
              const v = s.values[hover] ?? 0
              const prev = hover > 0 ? (s.values[hover - 1] ?? 0) : null
              const diff = prev == null ? null : v - prev
              return (
                <div key={s.name} className="home-chart-tip-row">
                  <span>{s.name}</span>
                  <b>{s.fmt(v)}</b>
                  {diff != null && (
                    <span className={`home-chart-tip-diff${diff > 0 ? ' is-up' : diff < 0 ? ' is-down' : ''}`}>
                      {diff === 0 ? '전날과 같음' : `전날 대비 ${diff > 0 ? '+' : '−'}${s.fmt(Math.abs(diff))}`}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div className="home-chart-bars">
          {dates.map((date, i) => (
            <div key={date} className={`home-chart-day${hover === i ? ' is-hover' : ''}`} onMouseEnter={() => setHover(i)}>
              <div className="home-chart-group">
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0
                  return (
                    <span key={s.name} className={`home-chart-col${i === dates.length - 1 ? ' home-chart-col--today' : ''}`}>
                      {si === 0 && showValue(i, v) && <span className="home-chart-value">{s.fmt(v)}</span>}
                      <span className={`home-chart-bar${si > 0 ? ' home-chart-bar--second' : ''}`} style={{ height: `${Math.max(3, (v / max) * 100)}%` }} title={`${shortDate(date)} ${s.name} ${s.fmt(v)}`} />
                    </span>
                  )
                })}
              </div>
              <span className="home-chart-label">{xLabel(i)}</span>
            </div>
          ))}
        </div>
      </div>
      {series.length > 1 && (
        <div className="home-chart-legend">
          {series.map((s, i) => (
            <span key={s.name} className={`home-chart-key home-chart-key--${i}`}>
              {s.name} {s.fmt(s.values.reduce((a, b) => a + b, 0))}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
