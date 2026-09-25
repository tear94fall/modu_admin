import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as points from '../api/points'
import PointAccountPage from './PointAccountPage'

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/points/google-sub-1']}>
      <Routes>
        <Route path="/points/:userId" element={<PointAccountPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('PointAccountPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(points, 'getAccount').mockResolvedValue({
      userId: 'google-sub-1',
      username: '임준섭',
      email: 'joon@example.com',
      balance: 580,
      createdDate: '2026-09-23T09:00:00',
    })
    vi.spyOn(points, 'getAccountMember').mockResolvedValue({ userId: 'google-sub-1', username: '임준섭', email: 'joon@example.com' })
    vi.spyOn(points, 'getHistory').mockResolvedValue({
      content: [
        { id: 4, type: 'ADJUST', amount: 500, balanceAfter: 580, memo: '런칭 이벤트 보상', createdDate: '2026-09-23T09:40:00' },
        { id: 3, type: 'SPEND', amount: -30, balanceAfter: 80, refId: 'order:1', memo: '테스트 차감', createdDate: '2026-09-23T09:30:00' },
        { id: 1, type: 'EARN', amount: 100, balanceAfter: 100, ruleCode: 'SIGNUP', memo: '가입 축하', createdDate: '2026-09-23T09:00:00' },
      ],
      totalElements: 3,
      totalPages: 1,
      number: 0,
      size: 15,
    })
  })

  it('shows name, email, balance and the ledger with signed amounts', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: '임준섭' })).toBeInTheDocument()
    expect(screen.getByText('joon@example.com')).toBeInTheDocument()
    expect(screen.getByText('580 P')).toBeInTheDocument()
    expect(screen.queryByText('google-sub-1')).not.toBeInTheDocument()
    expect(screen.getByText('+500')).toBeInTheDocument()
    expect(screen.getByText('-30')).toBeInTheDocument()
    expect(screen.getByText('SIGNUP')).toBeInTheDocument()
    expect(screen.getByText('order:1')).toBeInTheDocument()
    expect(screen.getByText('런칭 이벤트 보상')).toBeInTheDocument()
    expect(screen.getAllByText('조정').length).toBeGreaterThan(0)
  })

  it('adjusts points with a memo and refreshes', async () => {
    const adjust = vi.spyOn(points, 'adjustPoints').mockResolvedValue({ userId: 'google-sub-1', balance: 380 })
    renderPage()
    await screen.findByText('580 P')

    await userEvent.type(screen.getByLabelText('포인트'), '-200')
    await userEvent.type(screen.getByLabelText('메모'), '오지급 회수')
    await userEvent.click(screen.getByRole('button', { name: '반영' }))

    await waitFor(() => expect(adjust).toHaveBeenCalledWith('google-sub-1', { amount: -200, memo: '오지급 회수' }))
    expect(await screen.findByText('회수 완료 · 잔액 380 P')).toBeInTheDocument()
    expect(points.getAccount).toHaveBeenCalledTimes(2)
  })

  it('explains a 409 when taking back more than the balance', async () => {
    vi.spyOn(points, 'adjustPoints').mockRejectedValue(new ApiError(409, 'insufficient'))
    renderPage()
    await screen.findByText('580 P')

    await userEvent.type(screen.getByLabelText('포인트'), '-9999')
    await userEvent.type(screen.getByLabelText('메모'), '실수')
    await userEvent.click(screen.getByRole('button', { name: '반영' }))

    expect(await screen.findByText('잔액보다 많이 회수할 수 없습니다')).toBeInTheDocument()
  })

  it('treats a missing account as zero balance and still names the member', async () => {
    vi.spyOn(points, 'getAccount').mockRejectedValue(new ApiError(404, 'not found'))
    vi.spyOn(points, 'getHistory').mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 15 })
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: '임준섭' })).toBeInTheDocument()
    expect(screen.getByText('0 P')).toBeInTheDocument()
    expect(screen.getByText('아직 없음 (지급하면 만들어집니다)')).toBeInTheDocument()
    expect(screen.getByText('아직 이력이 없습니다')).toBeInTheDocument()
  })
})
