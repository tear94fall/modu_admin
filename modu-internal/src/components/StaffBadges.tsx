import { permissionLabel, sortPermissions, type StaffPermission } from '../api/members'

/** 직원 권한 배지. 권한이 없으면(직원 아님) 아무것도 그리지 않거나 [empty] 를 보인다. */
export default function StaffBadges({ permissions, empty = null }: { permissions: StaffPermission[]; empty?: string | null }) {
  if (permissions.length === 0) return empty ? <span className="card-muted">{empty}</span> : null
  return (
    <span className="perm-badges">
      <span className="staff-badge">직원</span>
      {sortPermissions(permissions).map((p) => (
        <span key={p} className={p === 'SUPER' ? 'perm-badge perm-badge--super' : 'perm-badge'}>
          {permissionLabel(p)}
        </span>
      ))}
    </span>
  )
}
