import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Select, { type SelectOption } from './Select'

const OPTIONS: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'blueberry', label: 'Blueberry', disabled: true },
  { value: 'cherry', label: 'Cherry' },
]

function Harness({ initial = 'banana', onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <div>
      <label htmlFor="fruit">과일</label>
      <Select
        id="fruit"
        value={value}
        options={OPTIONS}
        onChange={(v) => {
          setValue(v)
          onChange?.(v)
        }}
      />
      <button type="button">바깥</button>
    </div>
  )
}

const trigger = () => screen.getByRole('combobox', { name: '과일' })

describe('Select', () => {
  it('shows the selected label on a closed combobox', () => {
    render(<Harness />)
    expect(trigger()).toHaveTextContent('Banana')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens on click and chooses an option with a click', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(trigger())
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByRole('option', { name: 'Cherry' }))
    expect(onChange).toHaveBeenCalledWith('cherry')
    expect(trigger()).toHaveTextContent('Cherry')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })

  it('opens on ArrowDown with the selected option active, moves past disabled options and chooses with Enter', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    trigger().focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    const activeId = () => trigger().getAttribute('aria-activedescendant')
    expect(activeId()).toBe(screen.getByRole('option', { name: 'Banana' }).id)

    await userEvent.keyboard('{ArrowDown}') // Blueberry 는 꺼져 있어 건너뛴다
    expect(activeId()).toBe(screen.getByRole('option', { name: 'Cherry' }).id)
    await userEvent.keyboard('{Home}')
    expect(activeId()).toBe(screen.getByRole('option', { name: 'Apple' }).id)
    await userEvent.keyboard('{End}')
    expect(activeId()).toBe(screen.getByRole('option', { name: 'Cherry' }).id)

    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('cherry')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('jumps to an option by typing its first letters', async () => {
    render(<Harness />)
    trigger().focus()
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('c')
    expect(trigger().getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Cherry' }).id)
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(trigger())
    await userEvent.keyboard('{ArrowUp}{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes on an outside click', async () => {
    render(<Harness />)
    await userEvent.click(trigger())
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '바깥' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('focuses and opens the trigger from its label', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByText('과일'))
    expect(trigger()).toHaveFocus()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('does not choose a disabled option', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(trigger())
    const blueberry = screen.getByRole('option', { name: 'Blueberry' })
    expect(blueberry).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(blueberry)
    expect(onChange).not.toHaveBeenCalled()
    expect(trigger()).toHaveTextContent('Banana')
  })

  it('opens the list with its left edge on the trigger left edge, just below it', async () => {
    render(<Harness />)
    vi.spyOn(trigger(), 'getBoundingClientRect').mockReturnValue({
      left: 137,
      right: 297,
      top: 100,
      bottom: 136,
      width: 160,
      height: 36,
      x: 137,
      y: 100,
      toJSON: () => ({}),
    })
    await userEvent.click(trigger())
    const list = screen.getByRole('listbox')
    expect(list.style.left).toBe('137px')
    expect(list.style.top).toBe('140px')
    expect(list.style.minWidth).toBe('160px')
  })
})
