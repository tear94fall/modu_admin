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
  deliveredAt: null,
  shippedAt: null,
  carrier: null,
  trackingNo: null,
  cancelReason: null,
  cancelledBy: null,
  pointRefundStatus: 'NONE',
  events: [{ id: 1, fromStatus: null, toStatus: 'PAID', actorType: 'CUSTOMER', actorId: '11', reason: null, carrier: null, trackingNo: null, at: '2026-09-19T05:00:00' }],
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

  it('shows the order, the shipping form and the cancel form for a paid order, with the timeline', async () => {
    vi.spyOn(orders, 'getOrder').mockResolvedValue(detail)
    renderAt()
    expect(await screen.findByRole('heading', { name: '주문 20260919-ABC123' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: '배송 시작' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: '주문 취소' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '배송완료로' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '처리 이력' })).toHaveTextContent('주문 · 결제')
    expect(screen.getByRole('region', { name: '처리 이력' })).toHaveTextContent('고객 11')
  })

  it('ships with carrier and tracking number and re-renders with the response', async () => {
    const user = userEvent.setup()
    vi.spyOn(orders, 'getOrder').mockResolvedValue(detail)
    const change = vi.spyOn(orders, 'changeOrderStatus').mockResolvedValue({
      ...detail,
      status: 'SHIPPING',
      carrier: 'CJ대한통운',
      trackingNo: '1234',
      shippedAt: '2026-09-20T01:00:00',
      events: [...detail.events!, { id: 2, fromStatus: 'PAID', toStatus: 'SHIPPING', actorType: 'STAFF', actorId: 'staff-1', reason: null, carrier: 'CJ대한통운', trackingNo: '1234', at: '2026-09-20T01:00:00' }],
    })
    renderAt()
    await screen.findByRole('form', { name: '배송 시작' })

    const shipButton = screen.getByRole('button', { name: '배송 시작' })
    expect(shipButton).toBeDisabled()
    await user.type(screen.getByLabelText('송장번호'), '1234')
    expect(shipButton).toBeEnabled()
    await user.click(shipButton)

    expect(change).toHaveBeenCalledWith('1', { status: 'SHIPPING', carrier: 'CJ대한통운', trackingNo: '1234' })
    expect(await screen.findByText('배송중으로 바꿨습니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '배송완료로' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '배송 정보' })).toHaveTextContent('CJ대한통운 1234')
    expect(screen.getByRole('region', { name: '처리 이력' })).toHaveTextContent('배송 시작')
    expect(screen.getByRole('region', { name: '처리 이력' })).toHaveTextContent('직원 staff-1 · CJ대한통운 1234')
  })

  it('cancels with a reason after confirmation and shows the refund card, or the server reason on 400', async () => {
    const user = userEvent.setup()
    vi.spyOn(orders, 'getOrder').mockResolvedValue({ ...detail, pointAmount: 500, paymentAmount: 37500 })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const change = vi.spyOn(orders, 'changeOrderStatus').mockResolvedValueOnce({
      ...detail,
      status: 'CANCELLED',
      cancelledAt: '2026-09-20T02:00:00',
      cancelReason: '재고 부족',
      cancelledBy: 'STAFF',
      pointAmount: 500,
      paymentAmount: 37500,
      pointRefundStatus: 'PENDING',
    })
    renderAt()
    await screen.findByRole('form', { name: '주문 취소' })
    await user.click(screen.getByRole('button', { name: '주문 취소' }))

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('사유: 재고 부족'))
    expect(change).toHaveBeenCalledWith('1', { status: 'CANCELLED', reason: '재고 부족' })
    const refund = await screen.findByRole('region', { name: '취소·환불' })
    expect(refund).toHaveTextContent('직원 취소')
    expect(refund).toHaveTextContent('재고 부족')
    expect(refund).toHaveTextContent('포인트 환불 보내는 중')
    expect(screen.queryByRole('form', { name: '주문 취소' })).not.toBeInTheDocument()
  })

  it('shows the server reason when the change is rejected', async () => {
    const user = userEvent.setup()
    vi.spyOn(orders, 'getOrder').mockResolvedValue({ ...detail, status: 'SHIPPING', carrier: '한진택배', trackingNo: 'A1' })
    vi.spyOn(orders, 'changeOrderStatus').mockRejectedValue(new ApiError(400, '{"message":"배송중 상태에서 결제완료 로 바꿀 수 없습니다."}'))
    renderAt()
    await user.click(await screen.findByRole('button', { name: '배송완료로' }))
    expect(await screen.findByText('배송중 상태에서 결제완료 로 바꿀 수 없습니다.')).toBeInTheDocument()
  })

  it('shows not found for a missing order', async () => {
    vi.spyOn(orders, 'getOrder').mockRejectedValue(new ApiError(404, ''))
    renderAt()
    expect(await screen.findByText('주문을 찾을 수 없습니다')).toBeInTheDocument()
  })
})
