import type { AdminPushCampaign } from '../api/pushCampaigns'

type Counts = Pick<AdminPushCampaign, 'status' | 'targetDevices' | 'successCount' | 'failureCount' | 'openedCount'>

const num = (n: number) => n.toLocaleString('ko-KR')
/** 0~100 사이 비율(소수 한 자리). 분모가 0이면 null. */
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)
const width = (part: number, whole: number) => `${whole > 0 ? Math.min(100, (part / whole) * 100) : 0}%`

/**
 * 보냄 → 성공 → 열어 봄 을 숫자와 막대 하나로 보여 준다(목록 칸·모바일 카드).
 * 막대: 회색 바탕 = 보낸 기기, 초록 = 성공, 파랑 = 열어 봄. 오른쪽 알약은 열람률(열어 봄 ÷ 성공).
 */
export function PushFunnelCompact({ c }: { c: Counts }) {
  if (c.status === 'SCHEDULED') return <span className="funnel-wait">발송 전</span>
  if (c.status === 'CANCELED') return <span className="funnel-wait">보내지 않음</span>
  const rate = pct(c.openedCount, c.successCount)
  return (
    <div className={c.status === 'SENDING' ? 'funnel funnel--sending' : 'funnel'}>
      <div className="funnel-nums">
        <span className="funnel-num">
          <span className="funnel-label">보냄</span>
          <b>{num(c.targetDevices)}</b>
        </span>
        <span className="funnel-num funnel-num--ok">
          <span className="funnel-label">성공</span>
          <b>{num(c.successCount)}</b>
        </span>
        <span className="funnel-num funnel-num--open">
          <span className="funnel-label">열어 봄</span>
          <b>{num(c.openedCount)}</b>
        </span>
        <span className="funnel-rate" title="열람률 = 열어 봄 ÷ 성공">
          {rate == null ? '-' : `${rate}%`}
        </span>
      </div>
      <div className="funnel-bar" aria-hidden="true">
        <span className="funnel-fill funnel-fill--ok" style={{ width: width(c.successCount, c.targetDevices) }} />
        <span className="funnel-fill funnel-fill--open" style={{ width: width(c.openedCount, c.targetDevices) }} />
      </div>
      {c.failureCount > 0 && <span className="funnel-fail">실패 {num(c.failureCount)}</span>}
    </div>
  )
}

/** 상세 화면용 단계별 막대. 폭은 모두 보낸 기기 기준, 비율은 앞 단계 기준. */
export function PushFunnelSteps({ c }: { c: Counts }) {
  const steps = [
    { key: 'sent', label: '보냄', value: c.targetDevices, rate: c.targetDevices > 0 ? 100 : null, note: '' },
    { key: 'ok', label: '성공', value: c.successCount, rate: pct(c.successCount, c.targetDevices), note: '보낸 기기 대비' },
    { key: 'open', label: '열어 봄', value: c.openedCount, rate: pct(c.openedCount, c.successCount), note: '성공 대비' },
  ]
  return (
    <section className="funnel-steps" aria-label="발송 단계">
      {steps.map((s) => (
        <div key={s.key} className={`funnel-step funnel-step--${s.key}`}>
          <span className="funnel-step-label">{s.label}</span>
          <div className="funnel-step-track">
            <span className="funnel-step-fill" style={{ width: width(s.value, c.targetDevices) }} />
          </div>
          <b className="funnel-step-value">{num(s.value)}</b>
          <span className="funnel-step-rate">
            {s.rate == null ? '-' : `${s.rate}%`}
            {s.note && <small>{s.note}</small>}
          </span>
        </div>
      ))}
    </section>
  )
}
