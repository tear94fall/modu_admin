import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as categories from '../api/categories'
import { ApiError } from '../api/client'
import * as products from '../api/products'
import ProductFormPage from './ProductFormPage'

const tumbler: products.ProductDetail = {
  id: 7,
  name: '모두 텀블러 500ml',
  description: '하루 종일 차가운',
  detail: '이중 진공',
  price: 24000,
  listPrice: 30000,
  discountRate: 20,
  imageUrl: 'https://img/t.png',
  images: ['https://img/t.png', 'https://img/t2.png'],
  status: 'SELLING',
  soldOut: false,
  wishCount: 0,
  categoryId: 5,
  categoryPath: ['생활', '주방'],
  optionGroups: [{ id: 1, name: '용량', values: [{ id: 10, name: '500ml' }, { id: 11, name: '750ml' }] }],
  skus: [
    { id: 100, optionValueIds: [10], optionLabel: '500ml', extraPrice: 0, stock: 35 },
    { id: 101, optionValueIds: [11], optionLabel: '750ml', extraPrice: 4000, stock: 20 },
  ],
}

const tree: categories.Category[] = [
  { id: 1, name: '생활', sortOrder: 0, productCount: 0, children: [{ id: 5, name: '주방', sortOrder: 0, productCount: 1, children: [] }] },
]

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/products" element={<p>상품 목록 화면</p>} />
        <Route path="/products/new" element={<ProductFormPage />} />
        <Route path="/products/:id" element={<ProductFormPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('ProductFormPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
  })

  it('creates a simple product: one option-less SKU with the typed stock, then returns to the list', async () => {
    const create = vi.spyOn(products, 'createProduct').mockResolvedValue({ ...tumbler, id: 9 })
    renderAt('/products/new')

    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('이름'), '모두 우산')
    await userEvent.selectOptions(await screen.findByLabelText('카테고리'), '5')
    await userEvent.type(screen.getByLabelText('판매가'), '15000')
    await userEvent.type(screen.getByLabelText('소개'), '자동 우산')
    const stock = screen.getByLabelText('재고')
    await userEvent.clear(stock)
    await userEvent.type(stock, '12')
    await userEvent.click(screen.getByRole('button', { name: '등록' }))

    expect(create).toHaveBeenCalledWith({
      name: '모두 우산',
      description: '자동 우산',
      detail: null,
      price: 15000,
      listPrice: null,
      categoryId: 5,
      status: 'SELLING',
      images: [],
      optionGroups: [],
      skus: [{ options: {}, extraPrice: 0, stock: 12 }],
    })
    expect(await screen.findByText('상품 목록 화면')).toBeInTheDocument()
  })

  it('builds the SKU table from option groups and keeps typed stock when a value is added', async () => {
    vi.spyOn(products, 'createProduct').mockResolvedValue({ ...tumbler, id: 9 })
    renderAt('/products/new')

    await userEvent.click(screen.getByRole('button', { name: '옵션 그룹 추가' }))
    await userEvent.type(screen.getByLabelText('옵션 1 이름'), '색상')
    await userEvent.type(screen.getByLabelText('옵션 1 값'), '블랙, 화이트')
    await userEvent.click(screen.getByRole('button', { name: '옵션 그룹 추가' }))
    await userEvent.type(screen.getByLabelText('옵션 2 이름'), '사이즈')
    await userEvent.type(screen.getByLabelText('옵션 2 값'), 'M')

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(3) // 머리글 + 2 조합
    const blackStock = screen.getByLabelText('블랙 / M 재고')
    await userEvent.clear(blackStock)
    await userEvent.type(blackStock, '4')

    await userEvent.type(screen.getByLabelText('옵션 2 값'), ', L')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(5)
    expect(screen.getByLabelText('블랙 / M 재고')).toHaveValue(4)
    expect(screen.getByLabelText('블랙 / L 재고')).toHaveValue(0)
    expect(screen.queryByLabelText('재고')).not.toBeInTheDocument()
  })

  it('loads a product with images and options into the form and saves the new shape', async () => {
    vi.spyOn(products, 'getProduct').mockResolvedValue(tumbler)
    const update = vi.spyOn(products, 'updateProduct').mockResolvedValue({ ...tumbler, name: '모두 텀블러' })
    renderAt('/products/7')

    const name = await screen.findByLabelText('이름')
    expect(name).toHaveValue('모두 텀블러 500ml')
    expect(screen.getByLabelText('판매가')).toHaveValue(24000)
    expect(screen.getByLabelText('정가')).toHaveValue(30000)
    expect(screen.getByText('할인율 20%')).toBeInTheDocument()
    expect(screen.getByLabelText('카테고리')).toHaveValue('5')
    expect(screen.getByLabelText('상세 설명')).toHaveValue('이중 진공')
    expect(screen.getByAltText('사진 1')).toHaveAttribute('src', 'https://img/t.png')
    expect(screen.getByLabelText('옵션 1 값')).toHaveValue('500ml, 750ml')
    expect(screen.getByLabelText('750ml 추가금')).toHaveValue(4000)
    expect(screen.getByLabelText('750ml 재고')).toHaveValue(20)

    await userEvent.clear(name)
    await userEvent.type(name, '모두 텀블러')
    await userEvent.click(screen.getByLabelText('사진 2 위로'))
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(update).toHaveBeenCalledWith('7', {
      name: '모두 텀블러',
      description: '하루 종일 차가운',
      detail: '이중 진공',
      price: 24000,
      listPrice: 30000,
      categoryId: 5,
      status: 'SELLING',
      images: ['https://img/t2.png', 'https://img/t.png'],
      optionGroups: [{ name: '용량', values: ['500ml', '750ml'] }],
      skus: [
        { options: { 용량: '500ml' }, extraPrice: 0, stock: 35 },
        { options: { 용량: '750ml' }, extraPrice: 4000, stock: 20 },
      ],
    })
    expect(await screen.findByText('저장했습니다')).toBeInTheDocument()
  })

  it('adds an image url and shows the server reason when the save is rejected with 400', async () => {
    vi.spyOn(products, 'getProduct').mockResolvedValue(tumbler)
    vi.spyOn(products, 'updateProduct').mockRejectedValue(new ApiError(400, '{"message":"정가는 판매가 이상이어야 합니다."}'))
    renderAt('/products/7')

    await userEvent.type(await screen.findByLabelText('사진 URL'), 'https://img/t3.png')
    await userEvent.click(screen.getByRole('button', { name: '사진 추가' }))
    expect(screen.getByAltText('사진 3')).toHaveAttribute('src', 'https://img/t3.png')

    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('정가는 판매가 이상이어야 합니다.')).toBeInTheDocument()
  })

  it('deletes after confirming and returns to the list', async () => {
    vi.spyOn(products, 'getProduct').mockResolvedValue(tumbler)
    const remove = vi.spyOn(products, 'deleteProduct').mockResolvedValue(undefined)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/products/7')

    await userEvent.click(await screen.findByRole('button', { name: '삭제' }))

    expect(confirm).toHaveBeenCalledWith("'모두 텀블러 500ml' 상품을 삭제할까요?")
    expect(remove).toHaveBeenCalledWith('7')
    expect(await screen.findByText('상품 목록 화면')).toBeInTheDocument()
  })
})
