import { useState } from 'react'
import { apiErrorMessage, formatUtcDateTime, STAFF_PERMISSIONS, timeZoneLabel, useDisplayTimeZone } from '@modu/console-core'
import { permissionLabel, removeStaff, sortPermissions, updateStaff, type StaffInfo, type StaffPermission } from '../api/members'
import StaffBadges from './StaffBadges'

interface StaffPermissionCardProps {
  memberId: number
  staff: StaffInfo | null
  withdrawn: boolean
  /** 최상위(ROLE_SUPER)만 true. 아니면 읽기 전용이다. */
  editable: boolean
  onChange: (staff: StaffInfo | null) => void
}

const PERMISSION_HINTS: Record<StaffPermission, string> = {
  SUPER: '모든 콘솔(어드민·시스템·인터널)을 포함하고, 직원 지정·권한 변경을 할 수 있습니다.',
  ADMIN: '모두의 어드민(회원·채팅·커머스 운영)',
  SYSTEM: '모두 시스템(게이트웨이·설정 서버)',
  INTERNAL: '모두 인터널(회원·직원 조회)',
}

/** 회원 상세의 "직원 권한". 최상위는 네 권한을 골라 저장하거나 직원에서 해제한다. */
export default function StaffPermissionCard({ memberId, staff, withdrawn, editable, onChange }: StaffPermissionCardProps) {
  const timeZone = useDisplayTimeZone()
  const [selected, setSelected] = useState<StaffPermission[]>(staff?.permissions ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const current = sortPermissions(staff?.permissions ?? [])
  const next = sortPermissions(selected)
  const dirty = current.join(',') !== next.join(',')

  const toggle = (p: StaffPermission, on: boolean) => {
    setResult(null)
    setSelected((s) => (on ? [...s.filter((x) => x !== p), p] : s.filter((x) => x !== p)))
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const entry = await updateStaff(memberId, next)
      const info: StaffInfo = {
        permissions: entry.permissions,
        createdDate: entry.createdDate,
        modifiedDate: entry.modifiedDate,
        modifiedBy: entry.modifiedBy,
        modifiedByName: entry.modifiedByName,
      }
      setSelected(entry.permissions)
      onChange(info)
      setResult(staff ? '직원 권한을 저장했습니다' : '직원으로 지정했습니다')
    } catch (e) {
      setError(apiErrorMessage(e, '직원 권한을 저장하지 못했습니다'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      await removeStaff(memberId)
      setSelected([])
      setConfirmingRemove(false)
      onChange(null)
      setResult('직원에서 해제했습니다')
    } catch (e) {
      setConfirmingRemove(false)
      setError(apiErrorMessage(e, '직원에서 해제하지 못했습니다'))
    } finally {
      setBusy(false)
    }
  }

  const lastChange = staff && (
    <dl className="detail-grid">
      <dt>권한</dt>
      <dd>
        <StaffBadges permissions={staff.permissions} empty="-" />
      </dd>
      <dt>직원 지정</dt>
      <dd>{formatUtcDateTime(staff.createdDate, timeZone) || '-'}</dd>
      <dt>마지막 변경</dt>
      <dd>
        {formatUtcDateTime(staff.modifiedDate, timeZone) || '-'}
        {(staff.modifiedByName || staff.modifiedBy) && ` · ${staff.modifiedByName || staff.modifiedBy}`}{' '}
        <span className="card-muted">({timeZoneLabel(timeZone)})</span>
      </dd>
    </dl>
  )

  return (
    <section className="info-card staff-card" aria-labelledby="staff-heading">
      <h2 id="staff-heading">직원 권한</h2>
      {staff ? lastChange : <p className="card-muted">직원이 아닙니다.</p>}

      {editable && (
        <>
          <fieldset className="perm-options" disabled={busy}>
            <legend className="sr-only">직원 권한 선택</legend>
            {STAFF_PERMISSIONS.map((p) => (
              <div key={p}>
                <label className="form-check">
                  <input type="checkbox" checked={selected.includes(p)} onChange={(e) => toggle(p, e.target.checked)} />
                  {permissionLabel(p)} <span className="mono card-muted">{p}</span>
                </label>
                {(p !== 'SUPER' || selected.includes('SUPER')) && <p className="perm-option-hint">{PERMISSION_HINTS[p]}</p>}
              </div>
            ))}
          </fieldset>
          {selected.includes('SUPER') && <p className="form-hint">최상위는 모든 콘솔을 포함합니다. 다른 권한을 따로 고르지 않아도 됩니다.</p>}
          {selected.length === 0 && staff && <p className="form-hint">권한을 하나 이상 고르세요. 모두 빼려면 직원 해제를 누르세요.</p>}
          {withdrawn && <p className="form-hint">탈퇴한 회원은 직원으로 지정할 수 없습니다.</p>}
          <div className="form-actions">
            {staff && (
              <button type="button" className="btn btn--danger" disabled={busy || confirmingRemove} onClick={() => setConfirmingRemove(true)}>
                직원 해제
              </button>
            )}
            <button type="button" className="btn btn--primary" disabled={busy || !dirty || next.length === 0} onClick={() => void save()}>
              저장
            </button>
          </div>
          {confirmingRemove && (
            <div className="confirm-box" role="group" aria-label="직원 해제 확인">
              <p>이 회원을 직원에서 해제할까요? 모든 콘솔 권한이 사라지고, 다음 토큰 갱신부터 콘솔을 쓸 수 없습니다.</p>
              <div className="confirm-actions">
                <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => setConfirmingRemove(false)}>
                  취소
                </button>
                <button type="button" className="btn btn--danger" disabled={busy} onClick={() => void remove()}>
                  해제
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {!editable && <p className="form-hint">직원 지정·권한 변경은 최상위 관리자만 할 수 있습니다.</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {result && <p className="result-text">{result}</p>}
    </section>
  )
}
