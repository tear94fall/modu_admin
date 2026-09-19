import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as orders from '../api/orders'
import OrdersPage from './OrdersPage'

const order = (over: Partial<orders.OrderSummary> = {}): orders.OrderSummary => ({
  id: 1,
  orderNo: '20260919-ABC123',
  userId: '11',
  status: 'PAID',
  totalAmount: 38000,
  itemCount: 3,
  firstItemName: '모두 베이직 티셔츠',
  firstImageUrl: null,
  createdAt: '2026-09-19T05:00:00',
  ...over,
})
const page = (content: orders.OrderSummary[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 15 })

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/orders']}>
      <Routes>
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<p>주문 상세 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('OrdersPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('lists orders with status, amount and "외 n건" title, and opens the detail', async () => {
    vi.spyOn(orders, 'searchOrders').mockResolvedValue(page([order(), order({ id: 2, orderNo: '20260919-ZZZ999', status: 'CANCELLED', itemCount: 1, firstItemName: '모두 머그컵 세트', totalAmount: 18000 })]))
    renderPage()

    expect(await screen.findByText('모두 베이직 티셔츠 외 2건')).toBeInTheDocument()
    expect(screen.getByText('모두 머그컵 세트')).toBeInTheDocument()
    expect(screen.getByText('38,000원')).toBeInTheDocument()
    expect(screen.getByText('18,000원')).toBeInTheDocument()
    expect(screen.getAllByText('결제완료', { selector: 'span' })).toHaveLength(1)
    expect(screen.getAllByText('취소', { selector: 'span' })).toHaveLength(1)

    await userEvent.click(screen.getByText('20260919-ABC123'))
    expect(await screen.findByText('주문 상세 화면')).toBeInTheDocument()
  })

  it('filters by status and searches by order number from the first page', async () => {
    const search = vi.spyOn(orders, 'searchOrders').mockResolvedValue(page([order()]))
    renderPage()
    await screen.findByText('모두 베이직 티셔츠 외 2건')

    await userEvent.selectOptions(screen.getByLabelText('주문 상태'), 'SHIPPING')
    expect(search).toHaveBeenLastCalledWith('', 0, { status: 'SHIPPING' })

    await userEvent.type(screen.getByLabelText('주문 검색'), 'ABC')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(search).toHaveBeenLastCalledWith('ABC', 0, { status: 'SHIPPING' })
  })
})
