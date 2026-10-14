import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { type CustomerLookup, lookupCustomers } from '../api/customers'
import { getMember, type MemberDetail, type MemberService, type ServiceUsage } from '../api/members'
import { formatPoints, getAccount } from '../api/points'
import CopyButton from '../components/CopyButton'
import MemberChatTab from '../components/MemberChatTab'
import MemberCommerceTab from '../components/MemberCommerceTab'
import RemoteImage from '../components/RemoteImage'
import ServiceBadges, { ServiceBadge } from '../components/ServiceBadges'
import StaffBadges from '../components/StaffBadges'
import { formatUtcDateTime } from '../util/timeZone'

type Tab = 'chat' | 'commerce'
const TAB_LABELS: Record<Tab, string> = { chat: '채팅', commerce: '커머스' }

/** 커머스 고객 조회: 머리 배지와 커머스 탭을 보일지 정하는 데 쓴다. 실패하면 없는 것으로 본다. */
type LookupState = { kind: 'loading' } | { kind: 'done'; customer: CustomerLookup | null }
/** 포인트 잔액. 계정이 없으면(404) 0, 못 읽으면 '-'. */
type PointState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; balance: number }

const kst = (v: string | null | undefined) => formatUtcDateTime(v, 'Asia/Seoul')
/** 한국 시간 날짜만 `2026.09.28`. 전체 시각은 title 로 남긴다. */
const kstDate = (v: string | null | undefined) => kst(v).slice(0, 10).replaceAll('-', '.') || '-'

/**
 * 회원 상세. 왼쪽은 서비스와 상관없는 공통 정보(프로필·이용 서비스·포인트), 오른쪽은 쓰는 서비스마다 탭.
 * 넓은 화면(1200px~)에서는 2단, 그보다 좁으면 한 줄로 쌓인다.
 * 탭은 ?tab=chat|commerce 로 URL 에 남고, 커머스 탭은 열 때 처음 읽는다. 한 서비스가 실패해도 그 탭 안에만 안내가 뜬다.
 */
export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lookup, setLookup] = useState<LookupState>({ kind: 'loading' })
  const [points, setPoints] = useState<PointState>({ kind: 'loading' })

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)
    setLookup({ kind: 'loading' })
    setPoints({ kind: 'loading' })
    getMember(id)
      .then((result) => {
        if (cancelled) return
        setDetail(result)
        const userId = result.member.userId
        lookupCustomers([userId])
          .then((found) => {
            if (!cancelled) setLookup({ kind: 'done', customer: found.get(userId) ?? null })
          })
          .catch(() => {
            if (!cancelled) setLookup({ kind: 'done', customer: null })
          })
        getAccount(userId)
          .then((account) => {
            if (!cancelled) setPoints({ kind: 'ok', balance: account.balance })
          })
          .catch((err) => {
            if (cancelled) return
            setPoints(err instanceof ApiError && err.status === 404 ? { kind: 'ok', balance: 0 } : { kind: 'error' })
          })
      })
      .catch(() => {
        if (!cancelled) setError('회원 정보를 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <p>불러오는 중...</p>
  if (error) return <p className="error-text">{error}</p>
  if (!detail) return <p>회원을 찾을 수 없습니다</p>

  const member = detail.member
  const usages = detail.services ?? []
  const usedServices: MemberService[] = usages.map((u) => u.service)
  const customer = lookup.kind === 'done' ? lookup.customer : null
  const tabs: Tab[] = []
  if (usedServices.includes('CHAT')) tabs.push('chat')
  if (usedServices.includes('COMMERCE') || customer) tabs.push('commerce')
  const requested = params.get('tab')
  const active: Tab | null = tabs.find((t) => t === requested) ?? tabs[0] ?? null
  const selectTab = (tab: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', tab)
    setParams(next, { replace: true })
  }

  return (
    <div>
      <Link to="/members" className="back-link">
        ← 회원 목록
      </Link>

      <div className="member-hub">
        <MemberProfilePanel detail={detail} customer={customer} points={points} />

        <section className="member-hub-main" aria-label="서비스별 정보">
          {tabs.length === 0 ? (
            // 커머스 고객 조회가 끝나기 전에는 탭이 생길 수 있어 안내를 미룬다.
            <p className="member-hub-empty">{lookup.kind === 'done' ? '아직 이용한 서비스가 없어요' : '불러오는 중...'}</p>
          ) : (
            <>
              <div className="member-tabs" role="tablist" aria-label="서비스">
                {tabs.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    id={`member-tab-${t}`}
                    aria-selected={active === t}
                    aria-controls={`member-panel-${t}`}
                    className={active === t ? 'member-tab active' : 'member-tab'}
                    onClick={() => selectTab(t)}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
              <div className="member-tab-panel" role="tabpanel" id={`member-panel-${active}`} aria-labelledby={`member-tab-${active}`}>
                {active === 'chat' && <MemberChatTab member={member} friendCount={detail.friendCount} />}
                {active === 'commerce' && <MemberCommerceTab userId={member.userId} />}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

/** 왼쪽 프로필 카드: 배경·아바타·이름, 기본 정보, 서비스별 처음·마지막 이용, 포인트. */
function MemberProfilePanel({ detail, customer, points }: { detail: MemberDetail; customer: CustomerLookup | null; points: PointState }) {
  const member = detail.member
  const staff = detail.staffPermissions ?? []
  const usages = detail.services ?? []
  return (
    <aside className="member-profile member-hub-header" aria-label="회원 정보">
      {member.wallpaperImage ? (
        <RemoteImage
          filename={member.wallpaperImage}
          alt={`${member.username} 배경 이미지`}
          className="member-profile-cover"
          fallback={<div className="member-profile-cover member-profile-cover--empty" />}
        />
      ) : (
        <div className="member-profile-cover member-profile-cover--empty" />
      )}

      <div className="member-profile-head">
        <RemoteImage
          filename={member.profileImage}
          alt={member.username}
          className="avatar member-profile-avatar"
          fallback={<div className="avatar avatar-placeholder member-profile-avatar">{member.username.charAt(0)}</div>}
        />
        <div className="member-profile-name">
          <h1 className="profile-username">{member.username}</h1>
          <StaffBadges permissions={staff} empty={null} />
        </div>
        {member.email && <p className="member-profile-email">{member.email}</p>}
        <ServiceBadges services={usages.map((u) => u.service)} customer={customer} empty={null} />
      </div>

      <dl className="member-profile-facts">
        <dt>사용자 ID</dt>
        <dd className="member-profile-id">
          <code>{member.userId}</code>
          <CopyButton text={member.userId} label="사용자 ID 복사" />
        </dd>
        <dt>가입일</dt>
        <dd>{formatUtcDateTime(detail.createdDate ?? member.createdDate) || '-'}</dd>
        <dt>상태</dt>
        <dd>
          {member.status === 'WITHDRAWN' ? (
            <span className="status-badge">탈퇴</span>
          ) : (
            <span className="status-badge status-badge--done">이용 중</span>
          )}
        </dd>
        <dt>직원 권한</dt>
        <dd>
          <StaffBadges permissions={staff} empty="직원 아님" />
        </dd>
      </dl>

      <div className="member-profile-section">
        <h2 className="member-profile-section-title">서비스 이용</h2>
        <UsageList usages={usages} />
      </div>

      <div className="member-profile-section member-points">
        <h2 className="member-profile-section-title">포인트</h2>
        <div className="member-points-row">
          <span className="member-points-value">
            {points.kind === 'loading' && <span className="card-muted">…</span>}
            {points.kind === 'error' && '-'}
            {points.kind === 'ok' && formatPoints(points.balance)}
          </span>
          <Link to={`/points/${encodeURIComponent(member.userId)}`} className="member-points-link">
            내역 ›
          </Link>
        </div>
      </div>
    </aside>
  )
}

/** 서비스별 처음·마지막 이용(한국 시간 날짜, 전체 시각은 title). */
function UsageList({ usages }: { usages: ServiceUsage[] }) {
  if (usages.length === 0) return <p className="card-muted member-usage-empty">이용 기록 없음</p>
  return (
    <ul className="member-usage-list">
      {usages.map((u) => (
        <li key={u.service}>
          <ServiceBadge service={u.service} />
          <span className="member-usage-dates">
            <span title={kst(u.firstUsedAt) || undefined}>처음 {kstDate(u.firstUsedAt)}</span>
            {' · '}
            <span title={kst(u.lastUsedAt) || undefined}>마지막 {kstDate(u.lastUsedAt)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
