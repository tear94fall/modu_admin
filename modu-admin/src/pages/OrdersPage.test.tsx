import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as orders from '../api/orders'
import OrdersPage from './OrdersPage'
import { chooseOption } from '../test/select'

const order = (over: Partial<orders.OrderSummary> = {}): orders.OrderSummary => ({
  id: 1,
  orderNo: '20260919-ABC123',
  userId: '11',
  status: 'PAID',
  totalAmount: 38000,
  pointAmount: 0,
  paymentAmount: 38000,
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

    await chooseOption(userEvent, '주문 상태', orders.ORDER_STATUS_LABELS.SHIPPING)
    expect(search).toHaveBeenLastCalledWith('', 0, { status: 'SHIPPING' })

    await userEvent.type(screen.getByLabelText('주문 검색'), 'ABC')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(search).toHaveBeenLastCalledWith('ABC', 0, { status: 'SHIPPING' })
  })

  it('selects paid orders and ships them in one go, then reloads the list', async () => {
    const user = userEvent.setup()
    const search = vi.spyOn(orders, 'searchOrders').mockResolvedValue(page([order(), order({ id: 2, orderNo: '20260919-ZZZ999', status: 'SHIPPING' }), order({ id: 3, orderNo: '20260919-QQQ333' })]))
    const ship = vi.spyOn(orders, 'shipOrders').mockResolvedValue({
      results: [
        { orderId: 1, ok: true, message: null, status: 'SHIPPING' },
        { orderId: 3, ok: false, message: '송장번호를 적어 주세요.', status: null },
      ],
    })
    renderPage()
    await screen.findByText('20260919-ZZZ999')

    // 아무 주문이나 체크할 수 있고, 배송 처리는 결제완료 주문만 센다
    expect(screen.getByRole('button', { name: '배송 처리' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: '이 페이지 주문 전체 선택' }))
    expect(screen.getByText('3건 선택')).toBeInTheDocument()
    expect(screen.getByText('· 결제완료가 아닌 1건은 배송 처리에서 제외')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: '20260919-ZZZ999 선택' }))
    expect(screen.getByText('2건 선택')).toBeInTheDocument()
    expect(screen.queryByText(/제외/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '배송 처리 (2건)' }))

    const dialog = screen.getByRole('dialog', { name: '배송 처리 (2건)' })
    expect(within(dialog).getByRole('button', { name: '2건 배송 시작' })).toBeDisabled()
    await user.type(within(dialog).getByLabelText('20260919-ABC123 송장번호'), '111')
    await user.type(within(dialog).getByLabelText('20260919-QQQ333 송장번호'), '333')
    await user.click(within(dialog).getByRole('button', { name: '2건 배송 시작' }))

    expect(ship).toHaveBeenCalledWith([
      { orderId: 1, carrier: 'CJ대한통운', trackingNo: '111' },
      { orderId: 3, carrier: 'CJ대한통운', trackingNo: '333' },
    ])
    expect(await within(dialog).findByText('1건 처리됨 · 1건 실패')).toBeInTheDocument()
    expect(within(dialog).getByText('송장번호를 적어 주세요.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '닫기' }))
    expect(search).toHaveBeenCalledTimes(2)
  })
})
