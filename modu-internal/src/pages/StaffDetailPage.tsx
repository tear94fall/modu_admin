import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, formatUtcDateTime, hasRole, timeZoneLabel, useDisplayTimeZone } from '@modu/console-core'
import { displayName, getStaff, type StaffEntry, type StaffInfo } from '../api/members'
import CopyButton from '../components/CopyButton'
import MemberAvatar from '../components/MemberAvatar'
import StaffBadges from '../components/StaffBadges'
import StaffPermissionCard from '../components/StaffPermissionCard'

/** 직원 상세. 권한과 지정·변경 이력을 보이고, 최상위(ROLE_SUPER)는 권한을 바꾸거나 해제한다. 해제하면 이 화면에 "직원이 아닙니다" 로 남는다. */
export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>()
  const timeZone = useDisplayTimeZone()
  const [entry, setEntry] = useState<StaffEntry | null>(null)
  /** 해제한 뒤에는 null — 이름·이메일은 entry 에 남겨 카드가 계속 그려지게 한다. */
  const [staff, setStaff] = useState<StaffInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getStaff(id)
      .then((e) => {
        if (cancelled) return
        setEntry(e)
        setStaff({ permissions: e.permissions, createdDate: e.createdDate, modifiedDate: e.modifiedDate, modifiedBy: e.modifiedBy, modifiedByName: e.modifiedByName })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError && e.status === 404 ? '직원이 아닙니다' : '직원 정보를 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const back = (
    <Link to="/staff" className="back-link">
      ← 직원 목록
    </Link>
  )
  if (error)
    return (
      <div>
        {back}
        <p className="error-text">{error}</p>
      </div>
    )
  if (!entry) return <p>불러오는 중...</p>

  const name = displayName(entry)
  const permissions = staff?.permissions ?? []
  const changedBy = staff?.modifiedByName || staff?.modifiedBy

  return (
    <div>
      {back}
      <div className="detail-layout int-detail">
        <aside className="detail-aside detail-aside--sticky">
          <section className="int-profile" aria-label="직원 정보">
            <div className="int-profile-cover" />
            <div className="int-profile-head">
              <MemberAvatar id={entry.memberId} name={name} size="lg" />
              <div className="int-profile-name">
                <h1>{name}</h1>
              </div>
              <p className="int-profile-email">{entry.email}</p>
              {permissions.length > 0 && (
                <div className="int-profile-badges">
                  <StaffBadges permissions={permissions} />
                </div>
              )}
            </div>
            <dl className="int-profile-facts">
              <dt>사용자 ID</dt>
              <dd className="int-profile-id">
                <span>{entry.userId}</span>
                <CopyButton text={entry.userId} label="사용자 ID 복사" />
              </dd>
              <dt>회원 번호</dt>
              <dd>{entry.memberId}</dd>
              <dt>직원 지정일</dt>
              <dd>
                {formatUtcDateTime(staff?.createdDate ?? null, timeZone) || '-'}
                <span className="int-zone card-muted">{timeZoneLabel(timeZone)}</span>
              </dd>
              <dt>마지막 변경</dt>
              <dd>
                {formatUtcDateTime(staff?.modifiedDate ?? null, timeZone) || '-'}
                {changedBy && <span className="card-muted"> · {changedBy}</span>}
              </dd>
            </dl>
          </section>
        </aside>
        <div className="detail-main">
          <StaffPermissionCard
            memberId={entry.memberId}
            memberName={name}
            memberEmail={entry.email}
            staff={staff}
            withdrawn={false}
            editable={hasRole('ROLE_SUPER')}
            onChange={setStaff}
          />
        </div>
      </div>
    </div>
  )
}
