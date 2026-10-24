import { type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { errorMessage } from '../api/pushCampaigns'
import {
  type ChatStats,
  deltaText,
  getChatStats,
  getMemberStats,
  getOrderStats,
  getPointStats,
  type MemberStats,
  type OrderStats,
  periodText,
  type PointStats,
  type Trend,
  trend,
} from '../api/stats'
import { getStockAlerts, type StockAlerts } from '../api/stock'
import DayBars, { type Tone } from '../components/DayBars'
import { formatPrice } from '../util/format'
import { useDisplayTimeZone } from '../util/timeZone'

/** 고를 수 있는 기간(오늘 포함, 일). 서버 상한은 92. 고른 값은 이 브라우저에만 남는다. */
const PERIOD_OPTIONS = [7, 14, 30, 90] as const
const DEFAULT_DAYS = 7
const DAYS_KEY = 'modu-admin-metrics-days'

function storedDays(): number {
  try {
    const n = Number(localStorage.getItem(DAYS_KEY))
    return PERIOD_OPTIONS.includes(n as (typeof PERIOD_OPTIONS)[number]) ? n : DEFAULT_DAYS
  } catch {
    return DEFAULT_DAYS
  }
}

type Loaded<T> = { data: T; error: null } | { data: null; error: string }

/** 404(아직 배포 전 서비스)·5xx 는 서버 원문 대신 우리 문구로 — 홈에서 스프링의 "No static resource" 같은 말이 보이지 않게. */
async function load<T>(fetcher: () => Promise<T>, fallback: string): Promise<Loaded<T>> {
  try {
    return { data: await fetcher(), error: null }
  } catch (err) {
    const serverSide = err instanceof ApiError && (err.status === 404 || err.status >= 500)
    return { data: null, error: serverSide ? fallback : errorMessage(err, fallback) }
  }
}

const num = (n: number) => n.toLocaleString('ko-KR')
const count = (unit: string) => (n: number) => `${num(n)}${unit}`
/** 어제 대비를 알약으로. 오르면 초록, 내리면 빨강, 같으면 회색. */
function DeltaPill({ t }: { t: Trend }) {
  const diff = t.today - t.yesterday
  const kind = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  return <span className={`delta-pill delta-pill--${kind}`}>{deltaText(t)}</span>
}

/** 맨 위 큰 숫자 네 개 — 오늘 가장 먼저 볼 것. */
function HeroTile({ label, t, fmt, tone, days }: { label: string; t: Trend; fmt: (n: number) => string; tone: Tone; days: number }) {
  return (
    <div className={`hero-tile hero-tile--${tone}`}>
      <span className="hero-tile-label">{label}</span>
      <span className="hero-tile-value">{fmt(t.today)}</span>
      <span className="hero-tile-foot">
        <DeltaPill t={t} />
        <span className="hero-tile-total">
          {days}일 {fmt(t.total)}
        </span>
      </span>
    </div>
  )
}

function HeroSkeleton({ label, tone }: { label: string; tone: Tone }) {
  return (
    <div className={`hero-tile hero-tile--${tone} hero-tile--empty`}>
      <span className="hero-tile-label">{label}</span>
      <span className="hero-tile-value">–</span>
    </div>
  )
}

/** 패널 왼쪽의 지표 한 줄: 이름 · 값 · 어제 대비(또는 보조 설명). */
function MetricRow({ label, value, t, sub }: { label: string; value: string; t?: Trend; sub?: string }) {
  return (
    <div className="home-metric">
      <span className="home-metric-label">{label}</span>
      <span className="home-metric-value">{value}</span>
      <span className="home-metric-side">{t ? <DeltaPill t={t} /> : sub}</span>
    </div>
  )
}

/** 커머스 패널 아래 재고 경고 한 줄. 품절·부족·과다가 하나라도 있으면 주황, 없으면 회색. 누르면 재고 화면으로. */
function StockAlertLink({ alerts }: { alerts: StockAlerts }) {
  const soldOut = alerts.soldOut.length
  const low = new Set(alerts.lowStock.map((s) => s.productId)).size
  const over = new Set(alerts.overstock.map((s) => s.productId)).size
  const warn = soldOut + low + over > 0
  return (
    <Link to="/stock" className={`home-alert${warn ? ' home-alert--warn' : ''}`} aria-label="재고 경고">
      <span className="home-alert-text">{warn ? `품절 ${num(soldOut)}종 · 부족 ${num(low)}종 · 과다 ${num(over)}종` : '재고 경고 없음'}</span>
      <span className="home-alert-more">재고 보기 ›</span>
    </Link>
  )
}

function Panel({ title, caption, tone, error, loading, children }: { title: string; caption: string; tone: Tone; error: string | null; loading: boolean; children?: ReactNode }) {
  return (
    <section className={`home-panel home-panel--${tone}`} aria-label={title}>
      <header className="home-panel-head">
        <span className="home-dot" aria-hidden="true" />
        <h2 className="home-panel-title">{title}</h2>
        <span className="home-panel-caption">{caption}</span>
      </header>
      {error ? <p className="error-text home-panel-error">{error}</p> : loading ? <p className="muted home-panel-loading">불러오는 중…</p> : <div className="home-panel-body">{children}</div>}
    </section>
  )
}

/** 시간대나 기간이 바뀌면 key 로 다시 마운트돼 상태가 비워진다(effect 안에서 setState 로 비우지 않으려고). */
export default function HomePage() {
  const zone = useDisplayTimeZone()
  const [days, setDays] = useState(storedDays)
  const choose = (n: number) => {
    setDays(n)
    try {
      localStorage.setItem(DAYS_KEY, String(n))
    } catch {
      // 저장 못 해도 이번 화면에는 적용된다.
    }
  }
  return <HomeStats key={`${zone}:${days}`} zone={zone} days={days} onDays={choose} />
}

function HomeStats({ zone, days, onDays }: { zone: string; days: number; onDays: (n: number) => void }) {
  const [member, setMember] = useState<Loaded<MemberStats> | null>(null)
  const [chat, setChat] = useState<Loaded<ChatStats> | null>(null)
  const [order, setOrder] = useState<Loaded<OrderStats> | null>(null)
  const [point, setPoint] = useState<Loaded<PointStats> | null>(null)
  const [stock, setStock] = useState<Loaded<StockAlerts> | null>(null)

  useEffect(() => {
    let cancelled = false
    // 네 서비스를 따로 받는다 — 하나가 죽어도 나머지는 보이게.
    load(() => getMemberStats(days, zone), '회원 지표를 불러오지 못했습니다').then((r) => !cancelled && setMember(r))
    load(() => getChatStats(days, zone), '채팅 지표를 불러오지 못했습니다').then((r) => !cancelled && setChat(r))
    load(() => getOrderStats(days, zone), '주문 지표를 불러오지 못했습니다').then((r) => !cancelled && setOrder(r))
    load(() => getPointStats(days, zone), '포인트 지표를 불러오지 못했습니다').then((r) => !cancelled && setPoint(r))
    load(() => getStockAlerts(), '재고 정보를 불러오지 못했습니다').then((r) => !cancelled && setStock(r))
    return () => {
      cancelled = true
    }
  }, [zone, days])

  const anyDays = member?.data?.days ?? chat?.data?.days ?? order?.data?.days ?? point?.data?.days ?? []
  const dates = anyDays.map((d) => d.date)
  const activeOf = (service: string) => member?.data?.active.find((a) => a.service === service)

  const signups = member?.data && trend(member.data.days, (d) => d.signups)
  const messages = chat?.data && trend(chat.data.days, (d) => d.messages)
  const rooms = chat?.data && trend(chat.data.days, (d) => d.roomsCreated)
  const orders = order?.data && trend(order.data.days, (d) => d.orders)
  const amount = order?.data && trend(order.data.days, (d) => d.amount)
  const coupons = order?.data && trend(order.data.days, (d) => d.couponUsed)
  const cancelled = order?.data && trend(order.data.days, (d) => d.cancelled)
  const earned = point?.data && trend(point.data.days, (d) => d.earned)
  const spent = point?.data && trend(point.data.days, (d) => d.spent)
  const refunded = point?.data && trend(point.data.days, (d) => d.refunded)
  const adjusted = point?.data && trend(point.data.days, (d) => d.adjusted)

  const people = count('명')
  const cases = count('건')
  const points = count('P')

  return (
    <div className="page home-page">
      <div className="page-head">
        <div className="page-head-main">
          <div className="page-head-title">
            <h1>지표</h1>
          </div>
          <p className="page-head-sub home-period" title="날짜는 설정의 표시 시간대 기준. 어제 대비는 오늘 값 − 어제 값">
            오늘 포함 {days}일 · {dates.length > 0 ? periodText(anyDays, zone) : zone}
          </p>
        </div>
        <div className="sort-chips home-days" role="group" aria-label="기간">
          {PERIOD_OPTIONS.map((n) => (
            <button key={n} type="button" className={`sort-chip${n === days ? ' active' : ''}`} aria-pressed={n === days} onClick={() => onDays(n)}>
              {n}일
            </button>
          ))}
        </div>
      </div>

      <section className="home-hero" aria-label="오늘 요약">
        {signups ? <HeroTile label="신규 가입" t={signups} fmt={people} tone="indigo" days={days} /> : <HeroSkeleton label="신규 가입" tone="indigo" />}
        {messages ? <HeroTile label="보낸 메시지" t={messages} fmt={cases} tone="green" days={days} /> : <HeroSkeleton label="보낸 메시지" tone="green" />}
        {orders ? <HeroTile label="결제 주문" t={orders} fmt={cases} tone="amber" days={days} /> : <HeroSkeleton label="결제 주문" tone="amber" />}
        {amount ? <HeroTile label="실결제액" t={amount} fmt={formatPrice} tone="amber" days={days} /> : <HeroSkeleton label="실결제액" tone="amber" />}
      </section>

      <div className="home-panels">
        <Panel title="회원" caption="가입과 활동" tone="indigo" error={member?.error ?? null} loading={!member}>
          {member?.data && signups && (
            <>
              <div className="home-metrics">
                <MetricRow label="신규 가입" value={people(signups.today)} t={signups} />
                <MetricRow label="전체 회원" value={people(member.data.totalMembers)} sub="탈퇴 제외" />
                <MetricRow label="활동 · 채팅" value={people(activeOf('CHAT')?.today ?? 0)} sub={`7일 ${people(activeOf('CHAT')?.week ?? 0)}`} />
                <MetricRow label="활동 · 커머스" value={people(activeOf('COMMERCE')?.today ?? 0)} sub={`7일 ${people(activeOf('COMMERCE')?.week ?? 0)}`} />
              </div>
              <DayBars dates={member.data.days.map((d) => d.date)} series={[{ name: '신규 가입', values: signups.series, fmt: people }]} tone="indigo" label={`${days}일 추이`} />
            </>
          )}
        </Panel>

        <Panel title="메신저" caption="대화와 방" tone="green" error={chat?.error ?? null} loading={!chat}>
          {chat?.data && messages && rooms && (
            <>
              <div className="home-metrics">
                <MetricRow label="보낸 메시지" value={cases(messages.today)} t={messages} />
                <MetricRow label="새 채팅방" value={count('개')(rooms.today)} t={rooms} />
                <MetricRow label={`${days}일 메시지`} value={cases(messages.total)} sub="시스템 안내 제외" />
              </div>
              <DayBars dates={chat.data.days.map((d) => d.date)} series={[{ name: '메시지', values: messages.series, fmt: cases }]} tone="green" label={`${days}일 추이`} />
            </>
          )}
        </Panel>

        <Panel title="커머스" caption="주문과 결제" tone="amber" error={order?.error ?? null} loading={!order}>
          {order?.data && orders && amount && coupons && cancelled && (
            <>
              <div className="home-metrics">
                <MetricRow label="결제 주문" value={cases(orders.today)} t={orders} />
                <MetricRow label="실결제액" value={formatPrice(amount.today)} t={amount} />
                <MetricRow label="쿠폰 사용 주문" value={cases(coupons.today)} t={coupons} />
                <MetricRow label="취소" value={cases(cancelled.today)} t={cancelled} />
                {stock?.data && <StockAlertLink alerts={stock.data} />}
              </div>
              <DayBars
                dates={order.data.days.map((d) => d.date)}
                series={[
                  { name: '주문', values: orders.series, fmt: cases },
                  { name: '취소', values: cancelled.series, fmt: cases },
                ]}
                tone="amber"
                label={`${days}일 추이`}
              />
            </>
          )}
        </Panel>

        <Panel title="포인트" caption="적립과 사용" tone="violet" error={point?.error ?? null} loading={!point}>
          {point?.data && earned && spent && refunded && adjusted && (
            <>
              <div className="home-metrics">
                <MetricRow label="적립" value={points(earned.today)} t={earned} />
                <MetricRow label="사용" value={points(spent.today)} t={spent} />
                <MetricRow label="환불" value={points(refunded.today)} t={refunded} />
                <MetricRow label="조정" value={points(adjusted.today)} t={adjusted} />
              </div>
              <DayBars
                dates={point.data.days.map((d) => d.date)}
                series={[
                  { name: '적립', values: earned.series, fmt: points },
                  { name: '사용', values: spent.series, fmt: points },
                ]}
                tone="violet"
                label={`${days}일 추이`}
              />
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}
