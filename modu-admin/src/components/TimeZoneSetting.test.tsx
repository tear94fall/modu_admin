import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { browserTimeZone, getDisplayTimeZone, setDisplayTimeZone, timeZoneLabel } from '../util/timeZone'
import TimeZoneSetting from './TimeZoneSetting'
import { chooseOption } from '../test/select'

describe('TimeZoneSetting', () => {
  afterEach(() => setDisplayTimeZone(null))

  it('follows the browser by default and saves an explicit choice', async () => {
    setDisplayTimeZone(null)
    render(<TimeZoneSetting />)

    const select = screen.getByRole('combobox', { name: '표시 시간대' })
    expect(select).toHaveTextContent(`브라우저 설정 따르기 · ${timeZoneLabel(browserTimeZone())}`)
    expect(screen.getByText(new RegExp(`지금 ${timeZoneLabel(browserTimeZone()).replace(/[()+]/g, '\\$&')} 기준`))).toBeInTheDocument()

    await chooseOption(userEvent, select, timeZoneLabel('America/New_York'))
    expect(getDisplayTimeZone()).toBe('America/New_York')
    expect(select).toHaveTextContent(timeZoneLabel('America/New_York'))
    expect(screen.getByText(/지금 America\/New_York/)).toBeInTheDocument()

    await chooseOption(userEvent, select, /^브라우저 설정 따르기/)
    expect(getDisplayTimeZone()).toBe(browserTimeZone())
  })
})
