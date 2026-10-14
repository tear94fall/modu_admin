import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as categories from '../api/categories'
import { ApiError } from '../api/client'
import { chooseOption } from '../test/select'
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

/** 3단계: 전자기기 > 컴퓨터 > (노트북·데스크톱), 전자기기 > 음향, 생활 */
const deep: categories.Category[] = [
  {
    id: 1,
    name: '전자기기',
    sortOrder: 0,
    productCount: 1,
    depth: 1,
    children: [
      {
        id: 11,
        name: '컴퓨터',
        sortOrder: 0,
        productCount: 0,
        depth: 2,
        children: [
          { id: 111, name: '노트북', sortOrder: 0, productCount: 3, depth: 3, children: [] },
          { id: 112, name: '데스크톱', sortOrder: 1, productCount: 2, depth: 3, children: [] },
        ],
      },
      { id: 12, name: '음향', sortOrder: 1, productCount: 4, depth: 2, children: [] },
    ],
  },
  { id: 2, name: '생활', sortOrder: 1, productCount: 0, depth: 1, children: [] },
  { id: 3, name: '문구', sortOrder: 2, productCount: 0, depth: 1, children: [] },
]

/** 왼쪽 상위 목록에서 [name] 을 골라 오른쪽에 연다(↑↓ 버튼이 아닌, 이름·개수가 있는 고르기 버튼). */
async function openRoot(name: string) {
  const nav = await screen.findByRole('navigation', { name: '상위 카테고리' })
  await userEvent.click(within(nav).getByRole('button', { name: new RegExp(`^.?${name}.*상품`) }))
}

/** 화면에 보이는 [selector] 항목 이름 순서 */
const names = (container: HTMLElement, selector: string) =>
  Array.from(container.querySelectorAll(selector)).map((el) => el.textContent)

/** 끝나지 않은 요청 하나. resolve/reject 를 밖에서 부른다. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('CategoriesPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders the two-level tree with product counts', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    render(<CategoriesPage />)

    const nav = await screen.findByRole('navigation', { name: '상위 카테고리' })
    expect(within(nav).getByText('패션')).toBeInTheDocument()
    expect(within(nav).getByText('하위 2 · 상품 4')).toBeInTheDocument()
    expect(within(nav).getByText('문구')).toBeInTheDocument()
    // 첫 상위(패션)가 기본으로 열리고, 그 하위가 오른쪽에 보인다
    expect(screen.getByRole('region', { name: '패션 상세' })).toBeInTheDocument()
    const clothes = screen.getByText('의류').closest('.tree-row') as HTMLElement
    expect(within(clothes).getByText('상품 2')).toBeInTheDocument()
    expect(screen.getByLabelText('패션 하위 추가')).toBeInTheDocument()
  })

  it('adds a child under its parent (the server puts it last) and reloads', async () => {
    const get = vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    const create = vi.spyOn(categories, 'createCategory').mockResolvedValue({ id: 13, name: '모자', parentId: 1, sortOrder: 2 })
    render(<CategoriesPage />)
    await screen.findByRole('region', { name: '패션 상세' })

    await userEvent.type(screen.getByLabelText('패션 하위 추가'), '모자')
    await userEvent.click(within(screen.getByLabelText('패션 하위 추가').closest('form') as HTMLElement).getByRole('button', { name: '추가' }))

    expect(create).toHaveBeenCalledWith({ name: '모자', parentId: 1 })
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
    expect(bagTile.style.width).toBe('36px')

    await openRoot('문구')
    const stationery = within(screen.getByRole('region', { name: '문구 상세' })).getByText('문구').closest('.tree-row') as HTMLElement
    const letterTile = within(stationery).getByTestId('category-tile')
    expect(letterTile).toHaveTextContent('문')
    expect(letterTile.style.background).toBe('rgb(243, 244, 246)')
    // 왼쪽 목록 2개 + 오른쪽 머리 1개(문구는 하위 없음)
    expect(screen.getAllByTestId('category-tile')).toHaveLength(3)
  })

  it('picks an emoji and a pastel colour, previews them and sends them on save', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(tree)
    const update = vi.spyOn(categories, 'updateCategory').mockResolvedValue({ id: 2, name: '문구', parentId: null, sortOrder: 1 })
    render(<CategoriesPage />)
    await openRoot('문구')
    const row = within(screen.getByRole('region', { name: '문구 상세' })).getByText('문구').closest('.tree-row') as HTMLElement
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
    await openRoot('문구')
    const row = within(screen.getByRole('region', { name: '문구 상세' })).getByText('문구').closest('.tree-row') as HTMLElement
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

  it('renders three levels: middle categories as cards with their own children inside', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(deep)
    render(<CategoriesPage />)

    const nav = await screen.findByRole('navigation', { name: '상위 카테고리' })
    // 하위는 모든 단계를 센다(컴퓨터·음향·노트북·데스크톱), 상품도 1+0+3+2+4
    expect(within(nav).getByText('하위 4 · 상품 10')).toBeInTheDocument()
    const panel = screen.getByRole('region', { name: '전자기기 상세' })
    const leaves = within(panel).getByRole('list', { name: '컴퓨터 하위' })
    expect(names(leaves, '.tree-name')).toEqual(['노트북', '데스크톱'])
    const laptop = within(leaves).getByText('노트북').closest('.tree-row') as HTMLElement
    expect(within(laptop).getByText('상품 3')).toBeInTheDocument()
    expect(within(laptop).getByRole('button', { name: '편집' })).toBeInTheDocument()
    expect(within(laptop).getByRole('button', { name: '삭제' })).toBeInTheDocument()
    // 컴퓨터 카드는 소분류까지 합친 상품 수
    const computer = within(panel).getByText('컴퓨터').closest('.tree-row') as HTMLElement
    expect(within(computer).getByText('상품 5')).toBeInTheDocument()
    expect(screen.getByText('중분류 2 · 소분류 2')).toBeInTheDocument()
  })

  it('adds a grandchild under a middle category', async () => {
    const get = vi.spyOn(categories, 'getCategories').mockResolvedValue(deep)
    const create = vi.spyOn(categories, 'createCategory').mockResolvedValue({ id: 121, name: '이어폰', parentId: 12, sortOrder: 0 })
    render(<CategoriesPage />)
    const input = await screen.findByLabelText('음향 하위 추가')

    await userEvent.type(input, '이어폰')
    await userEvent.click(within(input.closest('form') as HTMLElement).getByRole('button', { name: '추가' }))

    expect(create).toHaveBeenCalledWith({ name: '이어폰', parentId: 12 })
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('has no add control under a third-level category', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(deep)
    render(<CategoriesPage />)
    await screen.findByRole('region', { name: '전자기기 상세' })

    expect(screen.getByLabelText('전자기기 하위 추가')).toBeInTheDocument()
    expect(screen.getByLabelText('컴퓨터 하위 추가')).toBeInTheDocument()
    expect(screen.queryByLabelText('노트북 하위 추가')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('데스크톱 하위 추가')).not.toBeInTheDocument()
    expect(categories.MAX_CATEGORY_DEPTH).toBe(3)
  })

  it('moves a third-level category down with the full sibling list and keeps the new order', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(deep)
    const pending = deferred<categories.Category[]>()
    const reorder = vi.spyOn(categories, 'reorderCategories').mockReturnValue(pending.promise)
    render(<CategoriesPage />)
    const leaves = await screen.findByRole('list', { name: '컴퓨터 하위' })
    // 끝에 있는 쪽은 꺼져 있다
    expect(screen.getByRole('button', { name: '노트북 위로' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '데스크톱 아래로' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: '노트북 아래로' }))

    expect(reorder).toHaveBeenCalledTimes(1)
    expect(reorder).toHaveBeenCalledWith(11, [112, 111])
    // 바로 바뀌고, 요청 중에는 순서·편집 버튼이 꺼진다
    expect(names(leaves, '.tree-name')).toEqual(['데스크톱', '노트북'])
    expect(screen.getByRole('button', { name: '노트북 위로' })).toBeDisabled()
    expect(within(leaves).getAllByRole('button', { name: '편집' })[0]).toBeDisabled()

    const computer = deep[0].children[0]
    pending.resolve([{ ...deep[0], children: [{ ...computer, children: [computer.children[1], computer.children[0]] }, deep[0].children[1]] }, deep[1], deep[2]])
    expect(await screen.findByRole('button', { name: '노트북 위로' })).toBeEnabled()
    expect(names(leaves, '.tree-name')).toEqual(['데스크톱', '노트북'])
    expect(screen.getByRole('button', { name: '노트북 아래로' })).toBeDisabled()
  })

  it('moves middle cards and roots with the order endpoint', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(deep)
    const reorder = vi.spyOn(categories, 'reorderCategories').mockImplementation(async () => deep)
    render(<CategoriesPage />)
    await screen.findByRole('region', { name: '전자기기 상세' })

    await userEvent.click(screen.getByRole('button', { name: '음향 위로' }))
    expect(reorder).toHaveBeenLastCalledWith(1, [12, 11])

    const nav = screen.getByRole('navigation', { name: '상위 카테고리' })
    expect(within(nav).getByRole('button', { name: '전자기기 위로' })).toBeDisabled()
    expect(within(nav).getByRole('button', { name: '문구 아래로' })).toBeDisabled()
    await userEvent.click(within(nav).getByRole('button', { name: '문구 위로' }))
    expect(reorder).toHaveBeenLastCalledWith(null, [1, 3, 2])
    expect(reorder).toHaveBeenCalledTimes(2)
  })

  it('reverts the order and shows the server message when a reorder is refused', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(deep)
    vi.spyOn(categories, 'reorderCategories').mockRejectedValue(new ApiError(400, '{"message":"형제 카테고리 목록이 맞지 않습니다."}'))
    render(<CategoriesPage />)
    const nav = await screen.findByRole('navigation', { name: '상위 카테고리' })

    await userEvent.click(within(nav).getByRole('button', { name: '전자기기 아래로' }))

    expect(await screen.findByText('형제 카테고리 목록이 맞지 않습니다.')).toBeInTheDocument()
    expect(names(nav, '.category-nav-name')).toEqual(['전자기기', '생활', '문구'])
    expect(within(nav).getByRole('button', { name: '전자기기 아래로' })).toBeEnabled()
  })

  it('moves a category under another parent, offering only parents that keep it within three levels', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(deep)
    const update = vi.spyOn(categories, 'updateCategory').mockResolvedValue({ id: 11, name: '컴퓨터', parentId: 2, sortOrder: 0 })
    render(<CategoriesPage />)
    const computer = (await screen.findByText('컴퓨터')).closest('.tree-row') as HTMLElement
    await userEvent.click(within(computer).getByRole('button', { name: '편집' }))

    const parent = screen.getByRole('combobox', { name: '컴퓨터 상위 카테고리' })
    expect(parent).toHaveTextContent('전자기기')
    await userEvent.click(parent)
    // 컴퓨터는 아래에 소분류가 있으니 대분류 밑으로만 갈 수 있다(자기 자신·자기 하위·중분류는 빠진다)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['없음 (최상위)', '전자기기', '생활', '문구'])
    await userEvent.click(screen.getByRole('option', { name: '생활' }))
    expect(screen.getByText('저장하면 하위 카테고리와 함께 옮겨지고, 옮긴 곳의 맨 뒤에 놓입니다.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(update).toHaveBeenCalledWith(11, { name: '컴퓨터', parentId: 2, sortOrder: 0, icon: '', color: '' })
  })

  it('lets a leaf move under a middle category of another root', async () => {
    vi.spyOn(categories, 'getCategories').mockResolvedValue(deep)
    const update = vi.spyOn(categories, 'updateCategory').mockResolvedValue({ id: 112, name: '데스크톱', parentId: 12, sortOrder: 0 })
    render(<CategoriesPage />)
    const desktop = (await screen.findByText('데스크톱')).closest('.tree-row') as HTMLElement
    await userEvent.click(within(desktop).getByRole('button', { name: '편집' }))

    await chooseOption(userEvent, '데스크톱 상위 카테고리', '전자기기 > 음향')

    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(update).toHaveBeenCalledWith(112, { name: '데스크톱', parentId: 12, sortOrder: 0, icon: '', color: '' })
  })
})
