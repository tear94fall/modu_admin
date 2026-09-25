import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { addDays, endOfMonth, parseDate, PERIOD_PRESETS } from '../util/dateInput'
import DateField from './DateField'

function Harness({ initial = '', min, presetBase }: { initial?: string; min?: string; presetBase?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <label htmlFor="d">날짜</label>
      <DateField id="d" value={value} onChange={setValue} min={min} presets={PERIOD_PRESETS} presetBase={presetBase} />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('parseDate', () => {
  it('accepts dashes, dots, slashes and plain digits', () => {
    expect(parseDate('2026-10-01')).toBe('2026-10-01')
    expect(parseDate('2026.10.1')).toBe('2026-10-01')
    expect(parseDate('2026/1/5')).toBe('2026-01-05')
    expect(parseDate('20261105')).toBe('2026-11-05')
    expect(parseDate(' 2026. 10. 31. ')).toBe('2026-10-31')
  })

  it('rejects impossible dates', () => {
    expect(parseDate('2026-02-30')).toBeNull()
    expect(parseDate('2026-13-01')).toBeNull()
    expect(parseDate('abc')).toBeNull()
  })

  it('date math stays on the calendar', () => {
    expect(addDays('2026-09-25', 13)).toBe('2026-10-08')
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29')
  })
})

describe('DateField', () => {
  it('shows the value with dots and the weekday', () => {
    render(<Harness initial="2026-10-31" />)
    expect(screen.getByLabelText('날짜')).toHaveValue('2026.10.31')
    expect(screen.getByText('토')).toBeInTheDocument()
  })

  it('typing a valid date updates the value, an invalid one warns', () => {
    render(<Harness />)
    const input = screen.getByLabelText('날짜')
    fireEvent.change(input, { target: { value: '2026-10-01' } })
    expect(screen.getByTestId('value')).toHaveTextContent('2026-10-01')
    fireEvent.change(input, { target: { value: '2026-10-4x' } })
    expect(screen.getByText('날짜는 2026.10.01 처럼 입력하세요.')).toBeInTheDocument()
    expect(screen.getByTestId('value')).toHaveTextContent('2026-10-01')
  })

  it('picks a day from the calendar and respects min', () => {
    render(<Harness initial="2026-10-10" min="2026-10-05" />)
    fireEvent.click(screen.getByRole('button', { name: '달력 열기' }))
    expect(screen.getByRole('dialog', { name: '날짜 선택' })).toBeInTheDocument()
    expect(screen.getByText('2026년 10월')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2026년 10월 4일' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '2026년 10월 20일' }))
    expect(screen.getByTestId('value')).toHaveTextContent('2026-10-20')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('moves between months and uses presets from the base date', () => {
    render(<Harness initial="2026-10-10" presetBase="2026-10-01" />)
    fireEvent.click(screen.getByRole('button', { name: '달력 열기' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
    expect(screen.getByText('2026년 11월')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2주' }))
    expect(screen.getByTestId('value')).toHaveTextContent('2026-10-14')
  })
})
