import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as categories from '../api/categories'
import { ApiError } from '../api/client'
import CategoriesPage from './CategoriesPage'

const tree: categories.Category[] = [
  {
    id: 1,
    name: '패션',
    sortOrder: 0,
    productCount: 0,
    children: [
      { id: 11, name: '가방', sortOrder: 0, productCount: 2, children: [] },
      { id: 12, name: '의류', sortOrder: 1, productCount: 2, children: [] },
    ],
  },
  { id: 2, name: '문구', sortOrder: 1, productCount: 0, children: [] },
]

describe('CategoriesPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders the two-level tree with product counts', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    render(<CategoriesPage />)

    expect(await screen.findByText('패션')).toBeInTheDocument()
    const clothes = screen.getByText('의류').closest('.tree-row') as HTMLElement
    expect(within(clothes).getByText('상품 2')).toBeInTheDocument()
    expect(screen.getByLabelText('패션 하위 추가')).toBeInTheDocument()
  })

  it('adds a child under its parent with the next sort order and reloads', async () => {
    const get = vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    const create = vi.spyOn(categories, 'createCategory').mockResolvedValue({ id: 13, name: '모자', parentId: 1, sortOrder: 2 })
    render(<CategoriesPage />)
    await screen.findByText('패션')

    await userEvent.type(screen.getByLabelText('패션 하위 추가'), '모자')
    await userEvent.click(within(screen.getByLabelText('패션 하위 추가').closest('form') as HTMLElement).getByRole('button', { name: '추가' }))

    expect(create).toHaveBeenCalledWith({ name: '모자', parentId: 1, sortOrder: 2 })
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('renames inline and keeps the parent', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    const update = vi.spyOn(categories, 'updateCategory').mockResolvedValue({ id: 12, name: '옷', parentId: 1, sortOrder: 1 })
    render(<CategoriesPage />)
    const row = (await screen.findByText('의류')).closest('.tree-row') as HTMLElement

    await userEvent.click(within(row).getByRole('button', { name: '이름 변경' }))
    const input = screen.getByLabelText('의류 새 이름')
    await userEvent.clear(input)
    await userEvent.type(input, '옷')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(update).toHaveBeenCalledWith(12, { name: '옷', parentId: 1, sortOrder: 1 })
  })

  it('shows the server reason when a delete is refused', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(categories, 'deleteCategory').mockRejectedValue(new ApiError(400, '{"message":"상품이 있는 카테고리는 삭제할 수 없습니다."}'))
    render(<CategoriesPage />)
    const row = (await screen.findByText('가방')).closest('.tree-row') as HTMLElement

    await userEvent.click(within(row).getByRole('button', { name: '삭제' }))

    expect(await screen.findByText('상품이 있는 카테고리는 삭제할 수 없습니다.')).toBeInTheDocument()
  })
})
