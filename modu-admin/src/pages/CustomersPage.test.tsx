import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as customers from '../api/customers'
import type { AdminCustomer } from '../api/customers'
import * as tiers from '../api/tiers'
import CustomerDetailPage from './CustomerDetailPage'
import CustomersPage from './CustomersPage'

const gold = { code: 'GOLD', name: '골드', color: '#D97706', earnRate: 3, minAmount: 300000 }
const customer = (over: Partial<AdminCustomer> = {}): AdminCustomer => ({
  userId: 'u1',
  name: '민수',
  email: 'a@b.c',
  status: 'ACTIVE',
  tier: gold,
  basisAmount: 320000,
  rollingAmount: 1184000,
  joinedAt: '2026-09-01T00:00:00',
  termsAgreedAt: '2026-09-01T00:00:00',
  privacyAgreedAt: '2026-09-01T00:00:00',
  migrated: false,
  ...over,
})

describe('CustomersPage', () => {
  beforeEach(() => {
    vi.spyOn(tiers, 'getTiers').mockResolvedValue([{ ...gold, sortOrder: 2, coupons: [], customerCount: 1 }])
  })

  it('lists customers with tier badge, KRW amounts and agreement, and filters by tier and agreement', async () => {
    const search = vi.spyOn(customers, 'searchCustomers').mockResolvedValue({
      content: [customer(), customer({ userId: 'u2', name: null, email: null, termsAgreedAt: null, privacyAgreedAt: null, migrated: true })],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 15,
    })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('민수')).toBeInTheDocument()
    expect(screen.getAllByText('320,000원')).toHaveLength(2)
    expect(screen.getAllByText('1,184,000원')).toHaveLength(2)
    expect(screen.getAllByText('골드')[0]).toBeInTheDocument()
    expect(screen.getByText('동의', { selector: '.status-badge' })).toHaveClass('status-badge--done')
    expect(screen.getByText('동의 전', { selector: '.status-badge' })).toBeInTheDocument()
    expect(search).toHaveBeenLastCalledWith('', 0, { tier: null, agreed: null })

    await user.click(await screen.findByRole('button', { name: '골드' }))
    await waitFor(() => expect(search).toHaveBeenLastCalledWith('', 0, { tier: 'GOLD', agreed: null }))
    const agreedGroup = screen.getByRole('group', { name: '약관 동의' })
    await user.click(agreedGroup.querySelectorAll('button')[2])
    await waitFor(() => expect(search).toHaveBeenLastCalledWith('', 0, { tier: 'GOLD', agreed: false }))

    await user.type(screen.getByLabelText('사용자 ID 검색'), 'demo')
    await user.click(screen.getByRole('button', { name: '검색' }))
    await waitFor(() => expect(search).toHaveBeenLastCalledWith('demo', 0, { tier: 'GOLD', agreed: false }))
  })

  it('opens the customer detail with tier history', async () => {
    vi.spyOn(customers, 'searchCustomers').mockResolvedValue({ content: [customer()], totalElements: 1, totalPages: 1, number: 0, size: 15 })
    vi.spyOn(customers, 'getCustomer').mockResolvedValue({
      ...customer(),
      tierHistory: [{ fromCode: null, toCode: 'GOLD', basisAmount: 0, periodLabel: null, changedAt: '2026-09-01T00:00:00', reason: 'JOIN' }],
    })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/customers']}>
        <Routes>
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:userId" element={<CustomerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByText('민수'))
    expect(await screen.findByRole('heading', { name: '등급 이력' })).toBeInTheDocument()
    expect(customers.getCustomer).toHaveBeenCalledWith('u1')
    expect(screen.getByText('가입')).toBeInTheDocument()
    expect(screen.getByText('← 고객 목록')).toBeInTheDocument()
  })
})
