import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { browserTimeZone, getDisplayTimeZone, setDisplayTimeZone, timeZoneLabel } from '../util/timeZone'
import TimeZoneSetting from './TimeZoneSetting'

describe('TimeZoneSetting', () => {
  afterEach(() => setDisplayTimeZone(null))

  it('follows the browser by default and saves an explicit choice', async () => {
    setDisplayTimeZone(null)
    render(<TimeZoneSetting />)

    const select = screen.getByRole('combobox', { name: '표시 시간대' })
    expect(select).toHaveValue('')
    expect(screen.getByText(new RegExp(`지금 ${timeZoneLabel(browserTimeZone()).replace(/[()+]/g, '\\$&')} 기준`))).toBeInTheDocument()

    await userEvent.selectOptions(select, 'America/New_York')
    expect(getDisplayTimeZone()).toBe('America/New_York')
    expect(select).toHaveValue('America/New_York')
    expect(screen.getByText(/지금 America\/New_York/)).toBeInTheDocument()

    await userEvent.selectOptions(select, '')
    expect(getDisplayTimeZone()).toBe(browserTimeZone())
  })
})
