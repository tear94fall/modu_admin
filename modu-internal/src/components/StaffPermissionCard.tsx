import { useRef, useState } from 'react'
import { apiErrorMessage, ConfirmDialog, formatUtcDateTime, STAFF_PERMISSIONS, timeZoneLabel, useDisplayTimeZone } from '@modu/console-core'
import { permissionLabel, removeStaff, sortPermissions, updateStaff, type StaffInfo, type StaffPermission } from '../api/members'
import StaffBadges from './StaffBadges'

interface StaffPermissionCardProps {
  memberId: number
  /** 확인 대화상자에 보일 회원 이름·이메일. */
  memberName: string
  memberEmail: string
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

/** 회원 상세의 "직원 권한". 최상위는 네 권한을 골라 저장하거나 직원에서 해제한다. 저장·해제는 확인 대화상자(바뀌는 권한)를 한 번 더 거친다. */
export default function StaffPermissionCard({ memberId, memberName, memberEmail, staff, withdrawn, editable, onChange }: StaffPermissionCardProps) {
  const timeZone = useDisplayTimeZone()
  const [selected, setSelected] = useState<StaffPermission[]>(staff?.permissions ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  /** 한 번 더 묻는 대화상자. 취소·Esc 는 API 를 부르지 않는다. */
  const [confirming, setConfirming] = useState<'save' | 'remove' | null>(null)
  /** 확인을 빠르게 두 번 눌러도 요청은 한 번만(busy 가 그려지기 전). */
  const inFlight = useRef(false)

  const current = sortPermissions(staff?.permissions ?? [])
  const next = sortPermissions(selected)
  const dirty = current.join(',') !== next.join(',')

  const toggle = (p: StaffPermission, on: boolean) => {
    setResult(null)
    setSelected((s) => (on ? [...s.filter((x) => x !== p), p] : s.filter((x) => x !== p)))
  }

  const reset = () => {
    setResult(null)
    setSelected(current)
  }

  const save = async () => {
    if (inFlight.current) return
    inFlight.current = true
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
      setConfirming(null)
      onChange(info)
      setResult(staff ? '직원 권한을 저장했습니다' : '직원으로 지정했습니다')
    } catch (e) {
      setConfirming(null)
      setError(apiErrorMessage(e, '직원 권한을 저장하지 못했습니다'))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const remove = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      await removeStaff(memberId)
      setSelected([])
      setConfirming(null)
      onChange(null)
      setResult('직원에서 해제했습니다')
    } catch (e) {
      setConfirming(null)
      setError(apiErrorMessage(e, '직원에서 해제하지 못했습니다'))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const added = next.filter((p) => !current.includes(p))
  const removed = current.filter((p) => !next.includes(p))
  const canSave = !busy && dirty && next.length > 0

  const pills = (list: StaffPermission[], tone: 'add' | 'remove' | 'plain') =>
    list.length === 0 ? (
      <span className="card-muted">없음</span>
    ) : (
      <span className="perm-badges">
        {list.map((p) => (
          <span key={p} className={`int-perm-pill int-perm-pill--${tone}`}>
            {tone === 'add' ? '+ ' : tone === 'remove' ? '− ' : ''}
            {permissionLabel(p)}
          </span>
        ))}
      </span>
    )

  const choiceState = (p: StaffPermission) => {
    const on = selected.includes(p)
    const had = current.includes(p)
    if (on && !had) return { cls: 'perm-choice--add', tag: '추가' }
    if (!on && had) return { cls: 'perm-choice--remove', tag: '제거' }
    if (on) return { cls: 'perm-choice--on', tag: '현재 권한' }
    return { cls: '', tag: null }
  }

  const who = (
    <dl className="kv-grid int-confirm-facts">
      <dt>회원</dt>
      <dd>
        {memberName}
        {memberName !== memberEmail && <span className="card-muted"> · {memberEmail}</span>}
      </dd>
    </dl>
  )

  return (
    <section className="section-card staff-card" aria-labelledby="staff-heading">
      <div className="section-card-head">
        <div>
          <h2 id="staff-heading" className="section-card-title">
            직원 권한
          </h2>
          <p className="section-card-hint">콘솔(어드민·시스템·인터널)을 쓸 수 있는 권한입니다. 바꾼 권한은 다음 토큰 갱신부터 적용됩니다.</p>
        </div>
      </div>

      {staff ? (
        <dl className="kv-grid">
          <dt>현재 권한</dt>
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
      ) : (
        <p className="card-muted int-card-note">직원이 아닙니다.</p>
      )}

      {editable && (
        <>
          <fieldset className="perm-choices" disabled={busy}>
            <legend className="int-choices-title">권한 고르기</legend>
            <div className="perm-choice-grid">
              {STAFF_PERMISSIONS.map((p) => {
                const { cls, tag } = choiceState(p)
                return (
                  <label key={p} className={`perm-choice ${cls}`.trim()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(p)}
                      onChange={(e) => toggle(p, e.target.checked)}
                      aria-labelledby={`perm-${memberId}-${p}`}
                      aria-describedby={`perm-${memberId}-${p}-hint`}
                    />
                    <span className="perm-choice-body">
                      <span className="perm-choice-head">
                        <span id={`perm-${memberId}-${p}`} className="perm-choice-name">
                          {permissionLabel(p)}
                        </span>
                        <span className="perm-choice-code">{p}</span>
                        {tag && <span className="perm-choice-tag">{tag}</span>}
                      </span>
                      <span id={`perm-${memberId}-${p}-hint`} className="perm-choice-hint">
                        {PERMISSION_HINTS[p]}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          {selected.includes('SUPER') && <p className="form-hint">최상위는 모든 콘솔을 포함합니다. 다른 권한을 따로 고르지 않아도 됩니다.</p>}
          {selected.length === 0 && staff && <p className="form-hint">권한을 하나 이상 고르세요. 모두 빼려면 직원 해제를 누르세요.</p>}
          {withdrawn && <p className="form-hint">탈퇴한 회원은 직원으로 지정할 수 없습니다.</p>}
          <div className="int-action-bar">
            <span className="int-action-note" aria-live="polite">
              {dirty && <span className="int-dirty">변경 사항 있음</span>}
            </span>
            <div className="int-action-buttons">
              {dirty && (
                <button type="button" className="btn btn--secondary int-btn" disabled={busy} onClick={reset}>
                  되돌리기
                </button>
              )}
              {staff && (
                <button type="button" className="btn btn--danger int-btn" disabled={busy} onClick={() => setConfirming('remove')}>
                  직원 해제
                </button>
              )}
              <button type="button" className="btn btn--primary int-btn" disabled={!canSave} onClick={() => setConfirming('save')}>
                저장
              </button>
            </div>
          </div>
        </>
      )}
      {!editable && <p className="form-hint">직원 지정·권한 변경은 최상위 관리자만 할 수 있습니다.</p>}
      {error && (
        <p className="error-text int-banner int-banner--error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <p className="result-text int-banner int-banner--ok" role="status">
          {result}
        </p>
      )}

      {confirming === 'save' && (
        <ConfirmDialog
          title={staff ? '직원 권한 저장' : '직원 지정'}
          confirmLabel={staff ? '권한 저장' : '직원으로 지정'}
          busy={busy}
          onConfirm={() => void save()}
          onCancel={() => setConfirming(null)}
        >
          {who}
          <dl className="kv-grid int-confirm-facts">
            <dt>지금</dt>
            <dd>{pills(current, 'plain')}</dd>
            <dt>저장 후</dt>
            <dd>{pills(next, 'plain')}</dd>
            <dt>추가될 권한</dt>
            <dd>{pills(added, 'add')}</dd>
            <dt>빠질 권한</dt>
            <dd>{pills(removed, 'remove')}</dd>
          </dl>
          {added.includes('SUPER') && (
            <p className="int-confirm-warn">최상위 권한을 줍니다. 모든 콘솔을 쓰고 다른 직원의 권한을 바꾸거나 해제할 수 있게 됩니다.</p>
          )}
          <p className="card-muted">바뀐 권한은 이 회원의 다음 토큰 갱신부터 적용됩니다.</p>
        </ConfirmDialog>
      )}
      {confirming === 'remove' && (
        <ConfirmDialog
          title="직원 해제"
          confirmLabel="직원 해제"
          danger
          initialFocus="cancel"
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setConfirming(null)}
        >
          {who}
          <dl className="kv-grid int-confirm-facts">
            <dt>빠질 권한</dt>
            <dd>{pills(current, 'remove')}</dd>
          </dl>
          <p>이 회원을 직원에서 해제할까요? 모든 콘솔 권한이 사라지고, 다음 토큰 갱신부터 콘솔을 쓸 수 없습니다.</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
