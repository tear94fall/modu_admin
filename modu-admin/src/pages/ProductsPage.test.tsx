import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as categories from '../api/categories'
import * as products from '../api/products'
import { mockViewport } from '../test/viewport'
import ProductsPage from './ProductsPage'

const base = { listPrice: null, status: 'SELLING' as const, totalStock: 10, categoryId: 1, categoryName: '주방' }
const tumbler = { id: 2, name: '모두 텀블러 500ml', description: '하루 종일 차가운', price: 24000, imageUrl: null, ...base }
const keyboard = { id: 4, name: '모두 기계식 키보드', description: '저소음 적축', price: 129000, imageUrl: 'https://img/k.png', ...base, totalStock: 0 }
const page = (content: products.ProductSummary[], totalPages = 1) => ({
  content,
  totalElements: content.length,
  totalPages,
  number: 0,
  size: 15,
})

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/products']}>
      <Routes>
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<p>수정 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(categories, 'getCategories').mockResolvedValue([])
  })

  it('lists products with formatted prices', async () => {
    vi.spyOn(products, 'searchProducts').mockResolvedValue(page([keyboard, tumbler]))
    renderPage()

    expect(await screen.findByText('모두 기계식 키보드')).toBeInTheDocument()
    expect(screen.getByText('129,000원')).toBeInTheDocument()
    expect(screen.getByText('24,000원')).toBeInTheDocument()
    expect(screen.getByText('품절')).toBeInTheDocument()
    expect(screen.getAllByText('판매중', { selector: 'span' })).toHaveLength(2)
  })

  it('filters by category and status from the first page', async () => {
    const search = vi.spyOn(products, 'searchProducts').mockResolvedValue(page([tumbler]))
    vi.spyOn(categories, 'getCategories').mockResolvedValue([
      { id: 1, name: '생활', sortOrder: 0, productCount: 0, children: [{ id: 5, name: '주방', sortOrder: 0, productCount: 1, children: [] }] },
    ])
    renderPage()
    await screen.findByText('모두 텀블러 500ml')

    await userEvent.selectOptions(await screen.findByLabelText('카테고리'), '5')
    expect(search).toHaveBeenLastCalledWith('', 0, { categoryId: 5, status: null })
    expect(screen.getByRole('option', { name: '생활 > 주방' })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('판매 상태'), 'HIDDEN')
    expect(search).toHaveBeenLastCalledWith('', 0, { categoryId: 5, status: 'HIDDEN' })
  })

  it('goes back to the first page when searching', async () => {
    const search = vi.spyOn(products, 'searchProducts').mockResolvedValue(page([keyboard], 3))
    renderPage()
    await screen.findByText('모두 기계식 키보드')

    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(search).toHaveBeenLastCalledWith('', 1, { categoryId: null, status: null })

    await userEvent.type(await screen.findByLabelText('상품 검색'), '키보드')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(search).toHaveBeenLastCalledWith('키보드', 0, { categoryId: null, status: null })
  })

  it('opens the edit page when a row is clicked', async () => {
    vi.spyOn(products, 'searchProducts').mockResolvedValue(page([tumbler]))
    renderPage()

    await userEvent.click(await screen.findByText('모두 텀블러 500ml'))

    expect(await screen.findByText('수정 화면')).toBeInTheDocument()
  })

  it('says so when nothing matches the search', async () => {
    const search = vi.spyOn(products, 'searchProducts').mockResolvedValue(page([keyboard]))
    renderPage()
    await screen.findByText('모두 기계식 키보드')

    search.mockResolvedValue(page([]))
    await userEvent.type(screen.getByLabelText('상품 검색'), '없는상품')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))

    expect(await screen.findByText('검색 결과가 없습니다')).toBeInTheDocument()
  })

  it('links to the create page', async () => {
    vi.spyOn(products, 'searchProducts').mockResolvedValue(page([]))
    renderPage()

    expect(await screen.findByRole('link', { name: '상품 등록' })).toHaveAttribute('href', '/products/new')
  })

  it('on a narrow screen renders product cards and opens the product on tap', async () => {
    const restore = mockViewport(true)
    try {
      vi.spyOn(products, 'searchProducts').mockResolvedValue({
        content: [{ id: 9, name: '무선 이어폰', price: 89000, description: '노이즈 캔슬링', imageUrl: null, ...base }],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 15,
      })
      const user = userEvent.setup()
      render(
        <MemoryRouter initialEntries={['/products']}>
          <Routes>
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<p>상품 상세 화면</p>} />
          </Routes>
        </MemoryRouter>,
      )

      const card = await screen.findByRole('button', { name: /무선 이어폰/ })
      expect(screen.queryByRole('table')).toBeNull()
      expect(card).toHaveTextContent('89,000원')

      await user.click(card)
      expect(await screen.findByText('상품 상세 화면')).toBeInTheDocument()
    } finally {
      restore()
    }
  })
})
