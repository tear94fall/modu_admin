import type { Tone } from './DayBars'

/** 성과 카드 맨 윗줄의 큰 숫자 타일 — 홈 요약 타일과 같은 생김새(색 하나·큰 값·보조 설명). */
export default function PerfTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: Tone }) {
  return (
    <div className={`hero-tile hero-tile--${tone} perf-tile`}>
      <span className="hero-tile-label">{label}</span>
      <span className="hero-tile-value">{value}</span>
      {sub && <span className="hero-tile-foot">{sub}</span>}
    </div>
  )
}

/** 성과 카드 아랫줄 왼쪽의 지표 한 줄(홈 패널과 같은 줄). */
export function PerfRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="home-metric">
      <span className="home-metric-label">{label}</span>
      <span className="home-metric-value">{value}</span>
      <span className="home-metric-side">{sub}</span>
    </div>
  )
}
