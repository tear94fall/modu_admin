import { afterEach, describe, expect, it, vi } from 'vitest'
import { findMemberByUserId, getMemberFriends, searchMembers } from './members'

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 15 })

describe('member api', () => {
  afterEach(() => vi.restoreAllMocks())

  it('adds service only when a service filter is given', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(page([])))
    await searchMembers('a', 1)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/member-service\/api-admin\/member\?keyword=a&page=1&size=15&sort=name%2Casc$/)
    await searchMembers('', 0, 'createdDate,desc', 'BOTH')
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/&sort=createdDate%2Cdesc&service=BOTH$/)
  })

  it('finds a member by exact userId among the search results', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      json(page([{ id: 1, userId: 'u10' }, { id: 2, userId: 'u1' }])),
    )
    expect((await findMemberByUserId('u1'))?.id).toBe(2)
    expect(await findMemberByUserId('u2')).toBeNull()
  })

  it('reads a page of friends with the filter and a page size of 10', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ ...page([]), counts: {} }))
    await getMemberFriends(7)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/member-service\/api-admin\/member\/7\/friends\?filter=ALL&page=0&size=10$/)
    await getMemberFriends(7, 'BLOCKED', 2)
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/member\/7\/friends\?filter=BLOCKED&page=2&size=10$/)
  })
})
