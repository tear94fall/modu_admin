import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatUtcDateTime, hasRole, STAFF_PERMISSIONS, timeZoneLabel, useDisplayTimeZone, useIsMobile } from '@modu/console-core'
import { displayName, listStaff, permissionLabel, type StaffEntry, type StaffPermission } from '../api/members'
import MemberAvatar from '../components/MemberAvatar'
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
        <header className="page-head">
          <div className="page-head-main">
            <h1>직원</h1>
          </div>
        </header>
        <p className="error-text">직원 목록은 최상위 관리자만 볼 수 있습니다</p>
      </div>
    )

  const open = (s: StaffEntry) => navigate(`/members/${s.memberId}`)
  const changedBy = (s: StaffEntry) => s.modifiedByName || s.modifiedBy

  const countOf = (p: StaffPermission) => staff.filter((s) => s.permissions.includes(p)).length
  const statTone: Record<StaffPermission, string> = { SUPER: 'stat-card--warn', ADMIN: 'stat-card--info', SYSTEM: '', INTERNAL: '' }

  return (
    <div>
      <header className="page-head">
        <div className="page-head-main">
          <h1>직원</h1>
          <p className="page-head-sub">
            콘솔 권한이 있는 직원입니다. 직원을 새로 지정하려면 회원 조회에서 회원을 열어 권한을 고르세요. 시각은 {timeZoneLabel(timeZone)} 기준입니다.
          </p>
        </div>
      </header>

      {!loading && !error && (
        <section className="stat-grid" aria-label="직원 요약">
          <div className="stat-card">
            <div className="stat-card-label">직원</div>
            <div className="stat-card-value">
              {staff.length}
              <span className="stat-card-unit">명</span>
            </div>
          </div>
          {STAFF_PERMISSIONS.map((p) => (
            <div key={p} className={`stat-card ${statTone[p]}`.trim()}>
              <div className="stat-card-label">{permissionLabel(p)}</div>
              <div className="stat-card-value">
                {countOf(p)}
                <span className="stat-card-unit">명</span>
              </div>
              <div className="stat-card-sub">{p}</div>
            </div>
          ))}
        </section>
      )}

      <section className="section-card" aria-labelledby="staff-list-heading">
        <div className="section-card-head">
          <div>
            <h2 id="staff-list-heading" className="section-card-title">
              직원 목록
            </h2>
            <p className="section-card-hint">{isMobile ? '누르면 회원 상세(권한 변경)로 이동합니다' : '행을 누르면 회원 상세(권한 변경)로 이동합니다'}</p>
          </div>
          {!loading && !error && <span className="section-card-count">{staff.length}명</span>}
        </div>
        {loading && <p className="card-muted int-card-note">불러오는 중...</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && staff.length === 0 && <p className="card-muted int-card-note">직원이 없습니다</p>}

        {!loading && !error && staff.length > 0 && isMobile && (
          <ul className="card-rows">
            {staff.map((s) => (
              <li key={s.memberId} className="int-row-item">
                <button type="button" className="int-row" onClick={() => open(s)}>
                  <MemberAvatar id={s.memberId} name={displayName(s)} />
                  <span className="int-row-body">
                    <span className="int-row-title">
                      <span className="int-name">{displayName(s)}</span>
                    </span>
                    <span className="int-row-line">{s.email}</span>
                    <span className="int-row-line">
                      <StaffBadges permissions={s.permissions} />
                    </span>
                    <span className="int-row-line card-muted">
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
          <div className="card-table-wrap">
            <table className="list-table card-table">
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
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
                    <td title={displayName(s)}>
                      <span className="int-person">
                        <MemberAvatar id={s.memberId} name={displayName(s)} />
                        <span className="int-name">{displayName(s)}</span>
                      </span>
                    </td>
                    <td title={s.email}>{s.email}</td>
                    <td className="int-wrap-cell">
                      <StaffBadges permissions={s.permissions} />
                    </td>
                    <td>{formatUtcDateTime(s.modifiedDate, timeZone) || '-'}</td>
                    <td>{changedBy(s) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
