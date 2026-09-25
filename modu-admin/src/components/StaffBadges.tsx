import { STAFF_LABELS, type StaffPermission } from '../util/format'

interface Props {
  permissions?: StaffPermission[]
  /** 직원이 아닐 때 보일 것. 기본은 '-'. null 이면 아무것도 그리지 않는다. */
  empty?: string | null
}

/**
 * 직원 권한 배지(최상위·어드민·시스템·인터널). 회원 테이블의 옛 role(ROLE_ADMIN/ROLE_MEMBER) 대신 이것을 보여 준다.
 * 권한은 모두 인터널에서 최상위 관리자가 정한다.
 */
export default function StaffBadges({ permissions, empty = '-' }: Props) {
  if (!permissions || permissions.length === 0) {
    return empty === null ? null : <span className="card-muted">{empty}</span>
  }
  return (
    <span className="staff-chips" aria-label={`직원 권한: ${permissions.map((p) => STAFF_LABELS[p] ?? p).join(', ')}`}>
      {permissions.map((p) => (
        <span key={p} className={p === 'SUPER' ? 'staff-chip staff-chip--super' : 'staff-chip'}>
          {STAFF_LABELS[p] ?? p}
        </span>
      ))}
    </span>
  )
}
