import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from './client'
import { categoryBody, createCategory, updateCategory } from './categories'

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
})
