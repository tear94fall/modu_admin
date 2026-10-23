import { actorLabel, eventLabel, type OrderEvent } from '../api/orders'
import { formatDateTime } from '../util/format'

/** 주문 처리 이력(결제 → 배송 시작 → 배송 완료 / 취소). 최근 것이 위. */
export default function OrderTimeline({ events }: { events: OrderEvent[] }) {
  if (events.length === 0) return <p className="card-muted">이력이 없습니다 (이력 기록 전의 주문)</p>
  return (
    <ol className="timeline">
      {[...events].reverse().map((e) => (
        <li key={e.id} className={`timeline-item timeline-item--${e.toStatus.toLowerCase()}`}>
          <span className="timeline-dot" aria-hidden="true" />
          <div className="timeline-body">
            <div className="timeline-head">
              <strong>{eventLabel(e)}</strong>
              <span className="card-muted">{formatDateTime(e.at ?? undefined)}</span>
            </div>
            <div className="timeline-meta">
              {actorLabel(e)}
              {e.carrier && ` · ${e.carrier} ${e.trackingNo ?? ''}`}
              {e.reason && ` · 사유: ${e.reason}`}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
