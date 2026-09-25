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
      { id: 11, name: '가방', sortOrder: 0, productCount: 2, icon: '👜', color: '#FCE7F3', children: [] },
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

  it('renames and keeps the parent and icon', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    const update = vi.spyOn(categories, 'updateCategory').mockResolvedValue({ id: 12, name: '옷', parentId: 1, sortOrder: 1 })
    render(<CategoriesPage />)
    const row = (await screen.findByText('의류')).closest('.tree-row') as HTMLElement

    await userEvent.click(within(row).getByRole('button', { name: '편집' }))
    const input = screen.getByLabelText('의류 새 이름')
    await userEvent.clear(input)
    await userEvent.type(input, '옷')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(update).toHaveBeenCalledWith(12, { name: '옷', parentId: 1, sortOrder: 1, icon: '', color: '' })
  })

  it('renders an icon tile before each name (emoji or first letter)', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    render(<CategoriesPage />)

    const bag = (await screen.findByText('가방')).closest('.tree-row') as HTMLElement
    const bagTile = within(bag).getByTestId('category-tile')
    expect(bagTile).toHaveTextContent('👜')
    expect(bagTile.style.background).toBe('rgb(252, 231, 243)')
    expect(bagTile.style.width).toBe('28px')

    const stationery = screen.getByText('문구').closest('.tree-row') as HTMLElement
    const letterTile = within(stationery).getByTestId('category-tile')
    expect(letterTile).toHaveTextContent('문')
    expect(letterTile.style.background).toBe('rgb(243, 244, 246)')
    expect(screen.getAllByTestId('category-tile')).toHaveLength(4)
  })

  it('picks an emoji and a pastel colour, previews them and sends them on save', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    const update = vi.spyOn(categories, 'updateCategory').mockResolvedValue({ id: 2, name: '문구', parentId: null, sortOrder: 1 })
    render(<CategoriesPage />)
    const row = (await screen.findByText('문구')).closest('.tree-row') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: '편집' }))
    const form = screen.getByRole('form', { name: '문구 편집' })
    const preview = within(form).getAllByTestId('category-tile')[0]
    expect(preview).toHaveTextContent('문')
    expect(preview.style.width).toBe('56px')

    await userEvent.click(within(form).getByRole('button', { name: '아이콘 📚' }))
    expect(within(form).getByLabelText('이모지')).toHaveValue('📚')
    expect(within(form).getByRole('button', { name: '아이콘 📚' })).toHaveClass('emoji-option--on')
    expect(preview).toHaveTextContent('📚')

    await userEvent.click(within(form).getByRole('button', { name: '아이콘 색 #E0F2FE' }))
    expect(within(form).getByLabelText('아이콘 색')).toHaveValue('#E0F2FE')
    expect(within(form).getByRole('button', { name: '아이콘 색 #E0F2FE' })).toHaveClass('palette-swatch--on')
    expect(preview.style.background).toBe('rgb(224, 242, 254)')

    await userEvent.click(within(form).getByRole('button', { name: '저장' }))
    expect(update).toHaveBeenCalledWith(2, { name: '문구', parentId: null, sortOrder: 1, icon: '📚', color: '#E0F2FE' })
    expect(screen.queryByRole('form', { name: '문구 편집' })).not.toBeInTheDocument()
  })

  it('clears the icon and falls back to the default colour', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    const update = vi.spyOn(categories, 'updateCategory').mockResolvedValue({ id: 11, name: '가방', parentId: 1, sortOrder: 0 })
    render(<CategoriesPage />)
    const row = (await screen.findByText('가방')).closest('.tree-row') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: '편집' }))
    const form = screen.getByRole('form', { name: '가방 편집' })
    expect(within(form).getByLabelText('이모지')).toHaveValue('👜')
    expect(within(form).getByText('이모지 한 개')).toBeInTheDocument()

    await userEvent.click(within(form).getByRole('button', { name: '지우기' }))
    await userEvent.click(within(form).getByRole('button', { name: '기본색' }))
    expect(within(form).getByLabelText('이모지')).toHaveValue('')
    expect(within(form).getByLabelText('아이콘 색')).toHaveValue('')
    expect(within(form).getAllByTestId('category-tile')[0]).toHaveTextContent('가')

    await userEvent.click(within(form).getByRole('button', { name: '저장' }))
    expect(update).toHaveBeenCalledWith(11, { name: '가방', parentId: 1, sortOrder: 0, icon: '', color: '' })
  })

  it('keeps the editor open and shows the server message for an invalid colour', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    vi.spyOn(categories, 'updateCategory').mockRejectedValue(new ApiError(400, '{"message":"아이콘 색은 #RRGGBB 형식으로 입력하세요."}'))
    render(<CategoriesPage />)
    const row = (await screen.findByText('문구')).closest('.tree-row') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: '편집' }))
    const form = screen.getByRole('form', { name: '문구 편집' })

    await userEvent.type(within(form).getByLabelText('아이콘 색'), '#12')
    await userEvent.click(within(form).getByRole('button', { name: '저장' }))

    expect(await screen.findByText('아이콘 색은 #RRGGBB 형식으로 입력하세요.')).toBeInTheDocument()
    expect(screen.getByRole('form', { name: '문구 편집' })).toBeInTheDocument()
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
