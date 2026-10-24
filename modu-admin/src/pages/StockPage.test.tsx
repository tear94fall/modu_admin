import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as stock from '../api/stock'
import StockPage from './StockPage'

const alerts = (low = 5, high = 100): stock.StockAlerts => ({
  low,
  high,
  salesDays: 30,
  sellingProducts: 24,
  soldOut: [{ productId: 7, name: '모두 버킷햇', imageUrl: null, wishCount: 3, skuCount: 1, sold: 4 }],
  lowStock: [
    { skuId: 121, productId: 87, productName: '모두 베이직 티셔츠', imageUrl: null, optionLabel: '네이비 / L', stock: 0, wishCount: 1, sold: 0 },
    { skuId: 124, productId: 88, productName: '모두 후드 집업', imageUrl: 'https://img/hoodie.jpg', optionLabel: 'XL', stock: 5, wishCount: 0, sold: 10 },
    { skuId: 122, productId: 88, productName: '모두 후드 집업', imageUrl: 'https://img/hoodie.jpg', optionLabel: 'M', stock: 2, wishCount: 0, sold: 5 },
  ],
  overstock: [{ skuId: 200, productId: 90, productName: '모두 스티커 팩', imageUrl: null, optionLabel: '', stock: 120, wishCount: 2, sold: 3 }],
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <StockPage />
    </MemoryRouter>,
  )

describe('StockPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('shows one table with sold-out, low and over rows grouped per product, with 30-day sales and coverage', async () => {
    const get = vi.spyOn(stock, 'getStockAlerts').mockResolvedValue(alerts())
    renderPage()

    expect(await screen.findByText('판매 중 24종 · 최근 30일 판매량 기준')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith({}) // 저장된 기준이 없으면 서버 기본값

    // 타일 = 탭. 전체 4건(품절 1 + 부족 2종 + 과다 1)
    const tabs = screen.getByRole('tablist', { name: '재고 구분' })
    expect(within(tabs).getByRole('tab', { name: /전체 경고/ })).toHaveTextContent('4건')
    expect(within(tabs).getByRole('tab', { name: /재고 부족/ })).toHaveTextContent('2종')
    expect(within(tabs).getByRole('tab', { name: /재고 과다/ })).toHaveTextContent('1종')
    expect(within(tabs).getByRole('tab', { name: /전체 경고/ })).toHaveAttribute('aria-selected', 'true')

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(4)
    // 품절 줄: 판매 4개, 재고가 없으니 며칠분 표시 없음
    expect(within(rows[0]).getByRole('link', { name: '모두 버킷햇' })).toHaveAttribute('href', '/products/7')
    expect(within(rows[0]).getByText('품절', { selector: '.status-badge' })).toBeInTheDocument()
    expect(within(rows[0]).getByText('4개')).toBeInTheDocument()
    // 후드 집업: 옵션 2건이 한 줄, 재고 7 · 판매 15 → 약 14일분
    const hoodie = rows.find((r) => within(r).queryByRole('link', { name: '모두 후드 집업' }))!
    expect(within(hoodie).getByText('옵션 2건 해당')).toBeInTheDocument()
    expect(within(hoodie).getByText('XL').nextElementSibling).toHaveTextContent('5개')
    expect(within(hoodie).getByText('M').nextElementSibling).toHaveTextContent('2개')
    expect(within(hoodie).getByText('약 14일분')).toBeInTheDocument()
    // 티셔츠 네이비/L 은 옵션만 품절, 최근 판매 없음
    const tee = rows.find((r) => within(r).queryByRole('link', { name: '모두 베이직 티셔츠' }))!
    expect(within(tee).getByText('네이비 / L').nextElementSibling).toHaveTextContent('품절')
    expect(within(tee).getByText('최근 판매 없음')).toBeInTheDocument()
    // 과다: 120 재고 · 30일 3개 → 약 40개월치, 버튼은 상품 열기
    const sticker = rows.find((r) => within(r).queryByRole('link', { name: '모두 스티커 팩' }))!
    expect(within(sticker).getByText('재고 과다')).toBeInTheDocument()
    expect(within(sticker).getByText('약 40개월치')).toBeInTheDocument()
    expect(within(sticker).getByRole('link', { name: '상품 열기' })).toHaveAttribute('href', '/products/90')
  })

  it('filters by tile tab', async () => {
    const user = userEvent.setup()
    vi.spyOn(stock, 'getStockAlerts').mockResolvedValue(alerts())
    renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('tab', { name: /재고 과다/ }))
    expect(screen.getByRole('tab', { name: /재고 과다/ })).toHaveAttribute('aria-selected', 'true')
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByRole('link', { name: '모두 스티커 팩' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^품절/ }))
    expect(within(screen.getByRole('table')).getAllByRole('row').slice(1)).toHaveLength(1)
  })

  it('applies new low/high criteria, reloads and remembers them', async () => {
    const user = userEvent.setup()
    const get = vi.spyOn(stock, 'getStockAlerts').mockImplementation(async (c = {}) => alerts(c.low ?? 5, c.high ?? 100))
    renderPage()
    await screen.findByRole('table')

    const apply = screen.getByRole('button', { name: '적용' })
    expect(apply).toBeDisabled() // 지금 값과 같으면 비활성
    const lowInput = screen.getByLabelText('부족 기준')
    const highInput = screen.getByLabelText('과다 기준')
    await user.clear(lowInput)
    await user.type(lowInput, '10')
    await user.clear(highInput)
    await user.type(highInput, '8') // 과다 < 부족 → 못 누름
    expect(screen.getByRole('button', { name: '적용' })).toBeDisabled()
    await user.clear(highInput)
    await user.type(highInput, '200')
    await user.click(screen.getByRole('button', { name: '적용' }))

    expect(await screen.findByText('옵션 3건 · 10개 이하')).toBeInTheDocument()
    expect(get).toHaveBeenLastCalledWith({ low: 10, high: 200 })
    expect(JSON.parse(localStorage.getItem('modu-admin-stock-criteria')!)).toEqual({ low: 10, high: 200 })
  })

  it('shows an all-clear message when nothing needs attention', async () => {
    vi.spyOn(stock, 'getStockAlerts').mockResolvedValue({ ...alerts(), soldOut: [], lowStock: [], overstock: [] })
    renderPage()
    expect(await screen.findByText('경고가 없습니다. 모든 상품 재고가 기준 안에 있어요.')).toBeInTheDocument()
  })
})
