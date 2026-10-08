import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

function Harness({ onConfirm, danger = false }: { onConfirm: () => void; danger?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      {open && (
        <ConfirmDialog
          title="롤백 확인"
          confirmLabel="develop-1234567 로 롤백"
          danger={danger}
          initialFocus={danger ? 'cancel' : 'confirm'}
          onConfirm={() => {
            onConfirm()
            setOpen(false)
          }}
          onCancel={() => setOpen(false)}
        >
          <p>되돌립니다</p>
        </ConfirmDialog>
      )}
    </>
  )
}

describe('ConfirmDialog', () => {
  it('is a labelled modal dialog; 취소 and Esc close it without confirming', async () => {
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} danger />)
    await userEvent.click(screen.getByRole('button', { name: '열기' }))

    const dialog = screen.getByRole('dialog', { name: '롤백 확인' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('되돌립니다')
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'develop-1234567 로 롤백' })).toHaveClass('btn--danger-solid')

    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '열기' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: '열기' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('keeps Tab inside the dialog and confirms exactly once', async () => {
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: '열기' }))

    const confirm = screen.getByRole('button', { name: 'develop-1234567 로 롤백' })
    expect(confirm).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(confirm).toHaveFocus()

    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
