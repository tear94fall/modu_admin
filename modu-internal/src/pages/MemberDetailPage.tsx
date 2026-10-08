import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, formatUtcDateTime, hasRole, timeZoneLabel, useDisplayTimeZone } from '@modu/console-core'
import { displayName, getMember, type StaffInfo, type StaffMemberDetail } from '../api/members'
import CopyButton from '../components/CopyButton'
import MemberAvatar from '../components/MemberAvatar'
import StaffBadges from '../components/StaffBadges'
import StaffPermissionCard from '../components/StaffPermissionCard'

/** 회원 상세. 회원 정보는 읽기 전용이고, 직원 권한은 최상위(ROLE_SUPER)만 바꾼다. */
export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const timeZone = useDisplayTimeZone()
  const [detail, setDetail] = useState<StaffMemberDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getMember(id)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError && e.status === 404 ? '회원을 찾을 수 없습니다' : '회원 정보를 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const back = (
    <Link to="/members" className="back-link">
      ← 회원 목록
    </Link>
  )
  if (error)
    return (
      <div>
        {back}
        <p className="error-text">{error}</p>
      </div>
    )
  if (!detail) return <p>불러오는 중...</p>

  const onStaffChange = (staff: StaffInfo | null) => setDetail((d) => (d ? { ...d, staff } : d))

  const name = displayName(detail)
  const withdrawn = detail.status === 'WITHDRAWN'
  const permissions = detail.staff?.permissions ?? []

  return (
    <div>
      {back}
      <div className="detail-layout int-detail">
        <aside className="detail-aside detail-aside--sticky">
          <section className="int-profile" aria-label="회원 정보">
            <div className="int-profile-cover" />
            <div className="int-profile-head">
              <MemberAvatar id={detail.id} name={name} size="lg" />
              <div className="int-profile-name">
                <h1>{name}</h1>
                {withdrawn && <span className="withdrawn-badge">탈퇴</span>}
              </div>
              <p className="int-profile-email">{detail.email}</p>
              {permissions.length > 0 && (
                <div className="int-profile-badges">
                  <StaffBadges permissions={permissions} />
                </div>
              )}
            </div>
            <dl className="int-profile-facts">
              <dt>사용자 ID</dt>
              <dd className="int-profile-id">
                <span>{detail.userId}</span>
                <CopyButton text={detail.userId} label="사용자 ID 복사" />
              </dd>
              <dt>회원 번호</dt>
              <dd>{detail.id}</dd>
              <dt>상태</dt>
              <dd>
                <span className={withdrawn ? 'int-pill int-pill--muted' : 'int-pill int-pill--good'}>{withdrawn ? '탈퇴' : '활성'}</span>
              </dd>
              <dt>상태 메시지</dt>
              <dd>{detail.statusMessage || '-'}</dd>
              <dt>친구 수</dt>
              <dd>{detail.friendCount}</dd>
              <dt>가입일</dt>
              <dd>
                {formatUtcDateTime(detail.createdDate, timeZone) || '-'}
                <span className="int-zone card-muted">{timeZoneLabel(timeZone)}</span>
              </dd>
            </dl>
          </section>
        </aside>
        <div className="detail-main">
          <StaffPermissionCard
            memberId={detail.id}
            memberName={name}
            memberEmail={detail.email}
            staff={detail.staff}
            withdrawn={withdrawn}
            editable={hasRole('ROLE_SUPER')}
            onChange={onStaffChange}
          />
        </div>
      </div>
    </div>
  )
}
