import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as orders from '../api/orders'
import OrderDetailPage from './OrderDetailPage'

const detail: orders.OrderDetail = {
  id: 1,
  orderNo: '20260919-ABC123',
  userId: '11',
  status: 'PAID',
  totalAmount: 38000,
  pointAmount: 0,
  paymentAmount: 38000,
  paymentMethod: 'MOCK',
  recipient: '임준섭',
  phone: '010-1234-5678',
  zipCode: '06236',
  address1: '서울 강남구',
  address2: '101동',
  paidAt: '2026-09-19T05:00:00',
  cancelledAt: null,
  createdAt: '2026-09-19T05:00:00',
  items: [{ id: 5, productId: 20, skuId: 30, productName: '모두 베이직 티셔츠', optionLabel: '블랙 / M', imageUrl: null, unitPrice: 19000, quantity: 2, lineAmount: 38000 }],
}

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={['/orders/1']}>
      <Routes>
        <Route path="/orders" element={<p>주문 목록 화면</p>} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('OrderDetailPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows the order and only the allowed next statuses', async () => {
    vi.spyOn(orders, 'getOrder').mockResolvedValue(detail)
    renderAt()

    expect(await screen.findByText('주문 20260919-ABC123')).toBeInTheDocument()
    expect(screen.getByText('임준섭 · 010-1234-5678')).toBeInTheDocument()
    expect(screen.getByText('블랙 / M')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '배송중 으로' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '주문 취소' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '배송완료 으로' })).not.toBeInTheDocument()
  })

  it('changes the status and re-renders with the response', async () => {
    vi.spyOn(orders, 'getOrder').mockResolvedValue(detail)
    const change = vi.spyOn(orders, 'changeOrderStatus').mockResolvedValue({ ...detail, status: 'SHIPPING' })
    renderAt()

    await userEvent.click(await screen.findByRole('button', { name: '배송중 으로' }))

    expect(change).toHaveBeenCalledWith('1', 'SHIPPING')
    expect(await screen.findByText('배송중 으로 바꿨습니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '배송완료 으로' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '주문 취소' })).not.toBeInTheDocument()
  })

  it('confirms before cancelling and shows the server reason on 400', async () => {
    vi.spyOn(orders, 'getOrder').mockResolvedValue(detail)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(orders, 'changeOrderStatus').mockRejectedValue(new ApiError(400, '{"message":"결제완료 상태에서 배송완료 로 바꿀 수 없습니다."}'))
    renderAt()

    await userEvent.click(await screen.findByRole('button', { name: '주문 취소' }))

    expect(confirm).toHaveBeenCalledWith('주문 20260919-ABC123 을 취소할까요? 재고가 복구됩니다.')
    expect(await screen.findByText('결제완료 상태에서 배송완료 로 바꿀 수 없습니다.')).toBeInTheDocument()
  })
})
