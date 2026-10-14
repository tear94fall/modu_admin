import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from './client'
import { type Category, categoryBody, createCategory, descendantCount, flattenCategories, productTotal, reorderCategories, updateCategory } from './categories'

describe('category api', () => {
  afterEach(() => vi.restoreAllMocks())

  it('trims icon and colour and sends empty ones as null', () => {
    expect(categoryBody({ name: '문구', parentId: null, sortOrder: 1, icon: ' 📚 ', color: ' #e0f2fe ' })).toEqual({
      name: '문구',
      parentId: null,
      sortOrder: 1,
      icon: '📚',
      color: '#E0F2FE',
    })
    expect(categoryBody({ name: '문구', parentId: 1, sortOrder: 0, icon: '  ', color: '' })).toEqual({
      name: '문구',
      parentId: 1,
      sortOrder: 0,
      icon: null,
      color: null,
    })
  })

  it('sends icon and colour on create and update', async () => {
    const api = vi.spyOn(client, 'api').mockResolvedValue({})
    await createCategory({ name: '모자', parentId: 1, sortOrder: 2 })
    await updateCategory(12, { name: '옷', parentId: 1, sortOrder: 1, icon: '👕', color: '#DBEAFE' })

    expect(JSON.parse(api.mock.calls[0][1]?.body as string)).toEqual({ name: '모자', parentId: 1, sortOrder: 2, icon: null, color: null })
    expect(api.mock.calls[1][0]).toBe('/commerce-service/api-admin/v1/categories/12')
    expect(JSON.parse(api.mock.calls[1][1]?.body as string)).toEqual({ name: '옷', parentId: 1, sortOrder: 1, icon: '👕', color: '#DBEAFE' })
  })

  it('omits sortOrder when it is not given so the server appends the new category', async () => {
    const api = vi.spyOn(client, 'api').mockResolvedValue({})
    await createCategory({ name: '이어폰', parentId: 12 })

    expect(JSON.parse(api.mock.calls[0][1]?.body as string)).toEqual({ name: '이어폰', parentId: 12, icon: null, color: null })
    expect(Object.keys(JSON.parse(api.mock.calls[0][1]?.body as string))).not.toContain('sortOrder')
  })

  it('sends the full sibling list to the order endpoint', async () => {
    const api = vi.spyOn(client, 'api').mockResolvedValue([])
    await reorderCategories(null, [2, 1, 3])
    await reorderCategories(11, [112, 111])

    expect(api.mock.calls[0][0]).toBe('/commerce-service/api-admin/v1/categories/order')
    expect(api.mock.calls[0][1]?.method).toBe('PUT')
    expect(JSON.parse(api.mock.calls[0][1]?.body as string)).toEqual({ parentId: null, ids: [2, 1, 3] })
    expect(JSON.parse(api.mock.calls[1][1]?.body as string)).toEqual({ parentId: 11, ids: [112, 111] })
  })

  it('flattens three levels in tree order with full paths and depths', () => {
    const tree: Category[] = [
      {
        id: 1,
        name: '전자기기',
        sortOrder: 0,
        productCount: 1,
        children: [
          {
            id: 11,
            name: '컴퓨터',
            sortOrder: 0,
            productCount: 0,
            children: [
              { id: 111, name: '노트북', sortOrder: 0, productCount: 3, children: [] },
              { id: 112, name: '데스크톱', sortOrder: 1, productCount: 2, children: [] },
            ],
          },
          { id: 12, name: '음향', sortOrder: 1, productCount: 4, children: [] },
        ],
      },
      { id: 2, name: '생활', sortOrder: 1, productCount: 0, children: [] },
    ]

    expect(flattenCategories(tree)).toEqual([
      { id: 1, label: '전자기기', parentId: null, depth: 1 },
      { id: 11, label: '전자기기 > 컴퓨터', parentId: 1, depth: 2 },
      { id: 111, label: '전자기기 > 컴퓨터 > 노트북', parentId: 11, depth: 3 },
      { id: 112, label: '전자기기 > 컴퓨터 > 데스크톱', parentId: 11, depth: 3 },
      { id: 12, label: '전자기기 > 음향', parentId: 1, depth: 2 },
      { id: 2, label: '생활', parentId: null, depth: 1 },
    ])
    expect(descendantCount(tree[0])).toBe(4)
    expect(productTotal(tree[0])).toBe(10)
  })
})
