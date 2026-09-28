import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as members from '../api/members'
import { CustomerDetailRedirect, CustomersRedirect } from './CustomerRedirect'

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/customers" element={<CustomersRedirect />} />
        <Route path="/customers/:userId" element={<CustomerDetailRedirect />} />
        <Route path="/members" element={<LocationProbe />} />
        <Route path="/members/:id" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )

describe('old 고객 routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('/customers goes to the member list filtered to 커머스', async () => {
    renderAt('/customers')
    expect((await screen.findByTestId('location')).textContent).toBe('/members?service=COMMERCE')
  })

  it('/customers/:userId opens that member on the 커머스 tab', async () => {
    const find = vi.spyOn(members, 'findMemberByUserId').mockResolvedValue({ id: 42, userId: 'a b', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' })
    renderAt('/customers/a%20b')
    expect((await screen.findByTestId('location')).textContent).toBe('/members/42?tab=commerce')
    expect(find).toHaveBeenCalledWith('a b')
  })

  it('falls back to the member list searched by userId when no member matches or the lookup fails', async () => {
    vi.spyOn(members, 'findMemberByUserId').mockResolvedValue(null)
    const { unmount } = renderAt('/customers/u-gone')
    expect((await screen.findByTestId('location')).textContent).toBe('/members?keyword=u-gone')
    unmount()

    vi.spyOn(members, 'findMemberByUserId').mockRejectedValue(new Error('down'))
    renderAt('/customers/u-x')
    expect((await screen.findByTestId('location')).textContent).toBe('/members?keyword=u-x')
  })
})
