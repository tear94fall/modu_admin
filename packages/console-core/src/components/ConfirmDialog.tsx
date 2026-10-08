import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  /** 대화상자 제목(aria-labelledby). */
  title: string
  children?: ReactNode
  /** 실제로 할 일을 그대로 적는다(예: "develop-1234567 배포"). */
  confirmLabel: string
  cancelLabel?: string
  /** 되돌리기·삭제처럼 위험한 일은 빨간 버튼. */
  danger?: boolean
  /** 처음 포커스. 위험한 일은 취소에 둔다(Enter 한 번에 실행되지 않게). */
  initialFocus?: 'confirm' | 'cancel'
  /** 요청 중이면 두 버튼을 잠근다(확인이 두 번 가지 않게). */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 한 번 더 묻는 대화상자(window.confirm 대신). 화면 위에 띄우고(body 포털), 포커스를 안에 가두며 Esc·취소·바깥 누르기로 닫는다.
 * 닫히면 열기 전에 포커스가 있던 곳으로 돌려준다. 열고 닫기는 부모가 이 컴포넌트를 그리느냐로 정한다.
 */
export default function ConfirmDialog({ title, children, confirmLabel, cancelLabel = '취소', danger = false, initialFocus = 'confirm', busy = false, onConfirm, onCancel }: Props) {
  const titleId = useId()
  const bodyId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ;(initialFocus === 'cancel' ? cancelRef : confirmRef).current?.focus()
    return () => {
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus()
    }
    // 열릴 때 한 번만.
  }, [])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (!busy) onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className="confirm-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div ref={dialogRef} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={children ? bodyId : undefined} onKeyDown={onKeyDown}>
        <h2 id={titleId} className="confirm-dialog-title">
          {title}
        </h2>
        {children && (
          <div id={bodyId} className="confirm-dialog-body">
            {children}
          </div>
        )}
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="btn btn--secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} type="button" className={danger ? 'btn btn--danger-solid' : 'btn btn--primary'} disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
