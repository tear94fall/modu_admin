import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import DayBars from './DayBars'

describe('DayBars', () => {
  const dates = ['2026-10-21', '2026-10-22', '2026-10-23']
  const fmt = (n: number) => `${n}건`

  it('writes total, today and peak in the head and a value above each bar', () => {
    render(<DayBars dates={dates} series={[{ name: '주문', values: [1, 4, 3], fmt }]} tone="amber" label="3일 추이" />)
    const chart = screen.getByLabelText('3일 추이')
    expect(chart).toHaveTextContent('합계 8건 · 오늘 3건 · 최고 4건 (10.22)')
    expect(chart.querySelectorAll('.home-chart-value')).toHaveLength(3)
  })

  it('shows a tooltip with the date, each series value and the change from the day before on hover', async () => {
    const user = userEvent.setup()
    render(
      <DayBars
        dates={dates}
        series={[
          { name: '주문', values: [1, 4, 3], fmt },
          { name: '취소', values: [0, 0, 1], fmt },
        ]}
        tone="amber"
      />,
    )
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await user.hover(screen.getByLabelText('7일 추이').querySelectorAll('.home-chart-day')[2])

    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('2026-10-23 · 오늘')
    expect(tip).toHaveTextContent('주문3건전날 대비 −1건')
    expect(tip).toHaveTextContent('취소1건전날 대비 +1건')

    await user.hover(screen.getByLabelText('7일 추이').querySelectorAll('.home-chart-day')[0])
    expect(screen.getByRole('tooltip')).toHaveTextContent('2026-10-21')
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('전날 대비')
  })
})
