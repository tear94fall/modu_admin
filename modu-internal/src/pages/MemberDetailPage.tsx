import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, formatUtcDateTime, timeZoneLabel, useDisplayTimeZone } from '@modu/console-core'
import { getMember, roleLabel, type MemberDetail } from '../api/members'

/** 회원 상세(읽기 전용). */
export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const timeZone = useDisplayTimeZone()
  const [detail, setDetail] = useState<MemberDetail | null>(null)
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

  const m = detail.member
  return (
    <div>
      {back}
      <h1>{m.username}</h1>
      <div className="info-card">
        <dl className="detail-grid">
          <dt>이메일</dt>
          <dd>{m.email}</dd>
          <dt>사용자 ID</dt>
          <dd className="mono">{m.userId}</dd>
          <dt>회원 번호</dt>
          <dd>{m.id}</dd>
          <dt>구분</dt>
          <dd>{roleLabel(m.role)}</dd>
          <dt>상태 메시지</dt>
          <dd>{m.statusMessage || '-'}</dd>
          <dt>친구 수</dt>
          <dd>{detail.friendCount}</dd>
          <dt>가입일</dt>
          <dd>
            {formatUtcDateTime(detail.createdDate ?? m.createdDate, timeZone) || '-'} <span className="card-muted">({timeZoneLabel(timeZone)})</span>
          </dd>
        </dl>
      </div>
    </div>
  )
}
