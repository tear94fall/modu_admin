import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatUtcDateTime, hasRole, timeZoneLabel, useDisplayTimeZone, useIsMobile } from '@modu/console-core'
import { displayName, listStaff, type StaffEntry } from '../api/members'
import StaffBadges from '../components/StaffBadges'

/** 직원 목록(최상위만). 권한과 마지막 변경을 보이고, 줄을 누르면 회원 상세(권한 변경)로 간다. */
export default function StaffPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const timeZone = useDisplayTimeZone()
  const isSuper = hasRole('ROLE_SUPER')
  const [staff, setStaff] = useState<StaffEntry[]>([])
  const [loading, setLoading] = useState(isSuper)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSuper) return
    let cancelled = false
    listStaff()
      .then((r) => {
        if (!cancelled) setStaff(r)
      })
      .catch(() => {
        if (!cancelled) setError('직원 목록을 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isSuper])

  if (!isSuper)
    return (
      <div>
        <h1>직원</h1>
        <p className="error-text">직원 목록은 최상위 관리자만 볼 수 있습니다</p>
      </div>
    )

  const open = (s: StaffEntry) => navigate(`/members/${s.memberId}`)
  const changedBy = (s: StaffEntry) => s.modifiedByName || s.modifiedBy

  return (
    <div>
      <h1>직원</h1>
      <p className="form-hint">
        직원을 새로 지정하려면 회원 조회에서 회원을 열어 권한을 고르세요. 시각은 {timeZoneLabel(timeZone)} 기준입니다.
      </p>
      {loading && <p>불러오는 중...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && staff.length === 0 && <p>직원이 없습니다</p>}

      {!loading && !error && staff.length > 0 && isMobile && (
        <ul className="card-list">
          {staff.map((s) => (
            <li key={s.memberId}>
              <button type="button" className="card" onClick={() => open(s)}>
                <span className="card-body">
                  <span className="card-title">{displayName(s)}</span>
                  <span className="card-line">{s.email}</span>
                  <span className="card-line">
                    <StaffBadges permissions={s.permissions} />
                  </span>
                  <span className="card-line card-muted">
                    변경 {formatUtcDateTime(s.modifiedDate, timeZone) || '-'}
                    {changedBy(s) && ` · ${changedBy(s)}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && staff.length > 0 && !isMobile && (
        <table className="list-table">
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '26%' }} />
            <col style={{ width: '26%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>권한</th>
              <th>마지막 변경</th>
              <th>변경한 사람</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.memberId} className="clickable-row" onClick={() => open(s)}>
                <td title={displayName(s)}>{displayName(s)}</td>
                <td title={s.email}>{s.email}</td>
                <td>
                  <StaffBadges permissions={s.permissions} />
                </td>
                <td>{formatUtcDateTime(s.modifiedDate, timeZone) || '-'}</td>
                <td>{changedBy(s) || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
