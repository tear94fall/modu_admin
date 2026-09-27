import { TIER_CHANGE_REASON_LABELS, type TierHistoryEntry } from '../api/customers'
import type { TierSummary } from '../api/tiers'
import { formatPrice } from '../util/format'
import { formatUtcDateTime } from '../util/timeZone'
import TierBadge from './TierBadge'

interface Props {
  history: TierHistoryEntry[]
  /** 코드 → 이름·색. 등급 목록을 못 읽었으면 비어 있고 코드를 그대로 보여 준다. */
  tiers: TierSummary[]
}

/** 등급 변경 이력(최신순). 시각은 한국 시간. */
export default function TierHistoryTable({ history, tiers }: Props) {
  if (history.length === 0) return <p className="card-muted">등급 변경 이력이 없습니다</p>
  const byCode = new Map(tiers.map((t) => [t.code, t]))
  const badge = (code: string | null) => (code ? <TierBadge tier={byCode.get(code)} fallback={code} /> : <span className="card-muted">-</span>)
  return (
    <div className="table-scroll">
      <table className="tier-history-table">
        <thead>
          <tr>
            <th>바뀐 시각</th>
            <th>기준 기간</th>
            <th>등급</th>
            <th className="amount-cell">기준 금액</th>
            <th>사유</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h, i) => (
            <tr key={`${h.changedAt}-${i}`}>
              <td>{formatUtcDateTime(h.changedAt, 'Asia/Seoul') || '-'}</td>
              <td>{h.periodLabel || '-'}</td>
              <td>
                <span className="tier-change">
                  {badge(h.fromCode)} <span aria-hidden="true">→</span> {badge(h.toCode)}
                </span>
              </td>
              <td className="amount-cell">{formatPrice(h.basisAmount)}</td>
              <td>{TIER_CHANGE_REASON_LABELS[h.reason] ?? h.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
