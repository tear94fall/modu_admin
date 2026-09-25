import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, formatUtcDateTime, hasRole, timeZoneLabel, useDisplayTimeZone } from '@modu/console-core'
import { displayName, getMember, type StaffInfo, type StaffMemberDetail } from '../api/members'
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

  return (
    <div>
      {back}
      <h1>
        {displayName(detail)} {detail.status === 'WITHDRAWN' && <span className="withdrawn-badge">탈퇴</span>}
      </h1>
      <div className="info-card">
        <dl className="detail-grid">
          <dt>이메일</dt>
          <dd>{detail.email}</dd>
          <dt>사용자 ID</dt>
          <dd className="mono">{detail.userId}</dd>
          <dt>회원 번호</dt>
          <dd>{detail.id}</dd>
          <dt>상태</dt>
          <dd>{detail.status === 'WITHDRAWN' ? '탈퇴' : '활성'}</dd>
          <dt>상태 메시지</dt>
          <dd>{detail.statusMessage || '-'}</dd>
          <dt>친구 수</dt>
          <dd>{detail.friendCount}</dd>
          <dt>가입일</dt>
          <dd>
            {formatUtcDateTime(detail.createdDate, timeZone) || '-'} <span className="card-muted">({timeZoneLabel(timeZone)})</span>
          </dd>
        </dl>
      </div>
      <StaffPermissionCard
        memberId={detail.id}
        staff={detail.staff}
        withdrawn={detail.status === 'WITHDRAWN'}
        editable={hasRole('ROLE_SUPER')}
        onChange={onStaffChange}
      />
    </div>
  )
}
