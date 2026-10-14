import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PAGE_SIZE } from '../api/client'
import * as customers from '../api/customers'
import { clearImageCache } from '../api/imageCache'
import * as members from '../api/members'
import * as storage from '../api/storage'
import * as tiers from '../api/tiers'
import { mockViewport } from '../test/viewport'
import MembersPage from './MembersPage'

const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 15 }

/** 지금 주소(경로+쿼리)를 보여 준다. URL 필터를 확인하는 데 쓴다. */
function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

const renderAt = (url = '/members') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/members"
          element={
            <>
              <MembersPage />
              <LocationProbe />
            </>
          }
        />
        <Route path="/members/:id" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
const location = () => screen.getByTestId('location').textContent

describe('MembersPage', () => {
  beforeEach(() => {
    clearImageCache()
    vi.spyOn(customers, 'lookupCustomers').mockResolvedValue(new Map())
  })

  it('renders columns in order (번호, 이름, 이메일, 사용자 ID, 직원, 이용 서비스, 가입일) with formatted createdDate', async () => {
    vi.spyOn(members, 'searchMembers').mockResolvedValue({
      content: [
        {
          id: 1,
          userId: 'u1',
          email: 'a@b.c',
          username: 'Alice',
          role: 'ROLE_MEMBER',
          createdDate: '2026-09-04T12:34:56',
          staffPermissions: ['SUPER'],
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    })

    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    )

    const headers = await screen.findAllByRole('columnheader')
    // 정렬 가능한 머리글에는 방향 화살표가 붙는다. 여기서 보려는 건 열 차례뿐이라 화살표는 걷어낸다.
    expect(headers.map((h) => h.textContent?.replace(/[\u25b2\u25bc\u2195]/g, ''))).toEqual([
      '번호',
      '',
      '이름',
      '이메일',
      '사용자 ID',
      '직원',
      '이용 서비스',
      '가입일',
    ])

    // 옛 role(ROLE_MEMBER) 대신 직원 권한을 보여 준다.
    expect(await screen.findByText('최상위')).toBeInTheDocument()
    expect(screen.queryByText('일반 회원')).toBeNull()
    expect(await screen.findByText('2026-09-04 21:34')).toBeInTheDocument()
  })

  it('shows the profile image via a blob object URL when profileImage is set', async () => {
    vi.spyOn(members, 'searchMembers').mockResolvedValue({
      content: [
        {
          id: 1,
          userId: 'u1',
          email: 'a@b.c',
          username: 'Alice',
          role: 'ROLE_MEMBER',
          profileImage: 'a.jpg',
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    })
    const fetchImageObjectUrl = vi.spyOn(storage, 'fetchImageObjectUrl').mockResolvedValue('blob:fake')

    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    )

    const img = (await screen.findAllByAltText('Alice')).find((el) => el.tagName === 'IMG') as HTMLImageElement
    expect(img).toBeDefined()
    expect(img.src).toBe('blob:fake')
    expect(fetchImageObjectUrl).toHaveBeenCalledWith('a.jpg')
  })

  it('shows the first letter as a placeholder when profileImage is missing', async () => {
    vi.spyOn(members, 'searchMembers').mockResolvedValue({
      content: [
        {
          id: 2,
          userId: 'u2',
          email: 'b@c.d',
          username: 'Bob',
          role: 'ROLE_MEMBER',
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    })

    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('asks for the default 이름순 ordering and has no 정렬 select', async () => {
    const searchMembers = vi.spyOn(members, 'searchMembers').mockResolvedValue(emptyPage)

    const { container } = render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(searchMembers).toHaveBeenCalledWith('', 0, 'name,asc'))

    // 정렬은 머리글을 눌러서만 바꾼다. 같은 일을 하는 입력이 둘이면 어느 쪽이 진짜인지 헷갈린다.
    expect(screen.queryByLabelText('정렬')).toBeNull()
    expect(container.querySelector('select')).toBeNull()
  })

  it('sorts by clicking every column header, first click using that column default direction', async () => {
    const searchMembers = vi.spyOn(members, 'searchMembers').mockResolvedValue(emptyPage)

    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(searchMembers).toHaveBeenCalledWith('', 0, 'name,asc'))

    // [머리글, 처음 누를 때 방향, 다시 누를 때 방향]
    const columns: [string, string, string][] = [
      ['이메일', 'email,asc', 'email,desc'],
      ['사용자 ID', 'userId,asc', 'userId,desc'],
      ['가입일', 'createdDate,desc', 'createdDate,asc'],
      ['이름', 'name,asc', 'name,desc'],
    ]

    for (const [label, first, second] of columns) {
      await userEvent.click(screen.getByRole('button', { name: label }))
      await waitFor(() => expect(searchMembers).toHaveBeenLastCalledWith('', 0, first))
      expect(screen.getByRole('columnheader', { name: label })).toHaveAttribute(
        'aria-sort',
        first.endsWith('asc') ? 'ascending' : 'descending',
      )

      await userEvent.click(screen.getByRole('button', { name: label }))
      await waitFor(() => expect(searchMembers).toHaveBeenLastCalledWith('', 0, second))
      expect(screen.getByRole('columnheader', { name: label })).toHaveAttribute(
        'aria-sort',
        second.endsWith('asc') ? 'ascending' : 'descending',
      )
    }
  })

  it('marks ascending with ▼ and descending with ▲, and leaves the other headers unmarked', async () => {
    const searchMembers = vi.spyOn(members, 'searchMembers').mockResolvedValue(emptyPage)

    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(searchMembers).toHaveBeenCalledWith('', 0, 'name,asc'))

    const header = (label: string) => screen.getByRole('columnheader', { name: label })
    const others = ['이메일', '사용자 ID', '가입일']

    // 엑셀과 같은 방향이다: 오름차순(ㄱ→ㅎ)이 아래 화살표.
    expect(header('이름').textContent).toContain('▼')
    for (const label of others) {
      expect(header(label).textContent).toBe(label)
      expect(header(label)).toHaveAttribute('aria-sort', 'none')
    }

    await userEvent.click(screen.getByRole('button', { name: '이름' }))

    await waitFor(() => expect(searchMembers).toHaveBeenLastCalledWith('', 0, 'name,desc'))
    expect(header('이름').textContent).toContain('▲')
    expect(header('이름').textContent).not.toContain('▼')
  })

  it('numbers rows from 1 and keeps counting across pages', async () => {
    const row = (id: number, username: string) => ({
      id,
      userId: `u${id}`,
      email: `${username}@b.c`,
      username,
      role: 'ROLE_MEMBER',
    })
    // 서버는 요청한 페이지 번호를 number 로 돌려준다. 순번은 그 번호를 기준으로 매겨진다.
    vi.spyOn(members, 'searchMembers').mockImplementation(async (_keyword, page) => ({
      content: page === 0 ? [row(1, 'Alice'), row(2, 'Bob')] : [row(3, 'Carol')],
      totalElements: PAGE_SIZE + 1,
      totalPages: 2,
      number: page,
      size: PAGE_SIZE,
    }))

    const { container } = render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    )

    const firstColumn = () =>
      Array.from(container.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td')?.textContent)

    await screen.findByText('Alice')
    expect(firstColumn()).toEqual(['1', '2'])

    await userEvent.click(screen.getByRole('button', { name: '다음' }))

    await screen.findByText('Carol')
    expect(firstColumn()).toEqual([String(PAGE_SIZE + 1)])
  })

  it('puts the full value in a title on cells that can be cut off', async () => {
    // 열이 고정폭이라 이런 값들은 화면에서 잘린다. 잘린 값은 title 로 읽을 수 있어야 한다.
    const username = '아주아주 긴 이름을 가진 회원 이름 값'
    const email = 'very.long.email.address.for.truncation@example.com'
    const userId = 'very-long-user-identifier-0123456789'
    vi.spyOn(members, 'searchMembers').mockResolvedValue({
      content: [{ id: 1, userId, email, username, role: 'ROLE_MEMBER', createdDate: '2026-09-04T12:34:56' }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: PAGE_SIZE,
    })

    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    )

    for (const value of [username, email, userId, '2026-09-04 21:34']) {
      expect(await screen.findByText(value)).toHaveAttribute('title', value)
    }
  })

  it('on a narrow screen renders cards instead of the table and opens the member on tap', async () => {
    const restore = mockViewport(true)
    try {
      vi.spyOn(members, 'searchMembers').mockResolvedValue({
        content: [
          {
            id: 7,
            userId: 'u7',
            email: 'seven@b.c',
            username: '일곱',
            role: 'ROLE_MEMBER',
            createdDate: '2026-09-04T12:34:56',
            staffPermissions: ['ADMIN', 'INTERNAL'],
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 15,
      })
      const user = userEvent.setup()
      const { container } = render(
        <MemoryRouter initialEntries={['/members']}>
          <Routes>
            <Route path="/members" element={<MembersPage />} />
            <Route path="/members/:id" element={<p>회원 상세 화면</p>} />
          </Routes>
        </MemoryRouter>,
      )

      const card = await screen.findByRole('button', { name: /일곱/ })
      expect(screen.queryByRole('table')).toBeNull()
      expect(card).toHaveTextContent('seven@b.c')
      expect(card).toHaveTextContent('어드민')
      expect(card).toHaveTextContent('인터널')
      // 정렬은 표 머리글 대신 카드 위의 버튼 줄로 한다.
      expect(screen.getByRole('button', { name: /이름/ })).toBeInTheDocument()
      expect(container.querySelectorAll('.card')).toHaveLength(1)

      await user.click(card)
      expect(await screen.findByText('회원 상세 화면')).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  describe('커머스 badge', () => {
    const member = (id: number, userId: string, username: string) => ({ id, userId, email: `${userId}@b.c`, username, role: 'ROLE_MEMBER' })
    const gold = { code: 'GOLD', name: '골드', color: '#D97706', earnRate: 3, minAmount: 300000 }
    const page = {
      content: [member(1, 'u-gold', '골드회원'), member(2, 'u-new', '동의전회원'), member(3, 'u-chat', '채팅회원')],
      totalElements: 3,
      totalPages: 1,
      number: 0,
      size: PAGE_SIZE,
    }
    const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLTableRowElement

    it('looks up the page in one batch and shows the tier in its color, 동의 전 muted, nothing for non-customers', async () => {
      vi.spyOn(members, 'searchMembers').mockResolvedValue(page)
      const lookup = vi.spyOn(customers, 'lookupCustomers').mockResolvedValue(
        new Map([
          ['u-gold', { userId: 'u-gold', status: 'ACTIVE' as const, tier: gold, agreed: true }],
          ['u-new', { userId: 'u-new', status: 'ACTIVE' as const, tier: { ...gold, code: 'WELCOME', name: '웰컴' }, agreed: false }],
        ]),
      )

      render(
        <MemoryRouter>
          <MembersPage />
        </MemoryRouter>,
      )

      const badge = await screen.findByText('커머스 · 골드')
      expect(lookup).toHaveBeenCalledTimes(1)
      expect(lookup).toHaveBeenCalledWith(['u-gold', 'u-new', 'u-chat'])
      expect(badge).toHaveStyle({ color: '#D97706' })
      expect(rowOf('골드회원')).toContainElement(badge)

      const muted = screen.getByText('커머스 · 동의 전')
      expect(muted).toHaveClass('tier-badge--muted')
      expect(rowOf('동의전회원')).toContainElement(muted)
      // 동의 전이면 등급 이름을 보이지 않는다.
      expect(screen.queryByText(/웰컴/)).toBeNull()

      expect(rowOf('채팅회원').textContent).not.toContain('커머스')
    })

    it('still lists members when the lookup fails', async () => {
      vi.spyOn(members, 'searchMembers').mockResolvedValue(page)
      vi.spyOn(customers, 'lookupCustomers').mockRejectedValue(new Error('commerce down'))

      render(
        <MemoryRouter>
          <MembersPage />
        </MemoryRouter>,
      )

      expect(await screen.findByText('골드회원')).toBeInTheDocument()
      expect(screen.getByText('채팅회원')).toBeInTheDocument()
      await waitFor(() => expect(customers.lookupCustomers).toHaveBeenCalled())
      expect(screen.queryByText(/커머스 ·/)).toBeNull()
      expect(screen.queryByText('회원 목록을 불러오지 못했습니다')).toBeNull()
    })

    it('shows the badge on phone cards too', async () => {
      const restore = mockViewport(true)
      try {
        vi.spyOn(members, 'searchMembers').mockResolvedValue(page)
        vi.spyOn(customers, 'lookupCustomers').mockResolvedValue(
          new Map([['u-gold', { userId: 'u-gold', status: 'ACTIVE' as const, tier: gold, agreed: true }]]),
        )
        render(
          <MemoryRouter>
            <MembersPage />
          </MemoryRouter>,
        )
        expect(await screen.findByRole('button', { name: /골드회원/ })).toHaveTextContent('커머스 · 골드')
      } finally {
        restore()
      }
    })
  })
  describe('이용 서비스', () => {
    const gold = { code: 'GOLD', name: '골드', color: '#D97706', earnRate: 3, minAmount: 300000 }
    const m = (id: number, userId: string, username: string, services: ('CHAT' | 'COMMERCE')[]) => ({
      id,
      userId,
      email: `${userId}@b.c`,
      username,
      role: 'ROLE_MEMBER',
      services,
    })
    const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLTableRowElement

    it('shows a neutral 채팅 badge, the tier badge for customers, a plain 커머스 badge without lookup and - for none', async () => {
      vi.spyOn(members, 'searchMembers').mockResolvedValue({
        content: [
          m(1, 'u-both', '둘다회원', ['CHAT', 'COMMERCE']),
          m(2, 'u-chat', '채팅회원', ['CHAT']),
          m(3, 'u-com', '커머스회원', ['COMMERCE']),
          m(4, 'u-none', '미이용회원', []),
        ],
        totalElements: 4,
        totalPages: 1,
        number: 0,
        size: PAGE_SIZE,
      })
      vi.spyOn(customers, 'lookupCustomers').mockResolvedValue(
        new Map([['u-both', { userId: 'u-both', status: 'ACTIVE' as const, tier: gold, agreed: true }]]),
      )
      renderAt()

      expect(await screen.findByText('커머스 · 골드')).toBeInTheDocument()
      const both = rowOf('둘다회원')
      expect(both).toHaveTextContent('채팅')
      expect(both).toHaveTextContent('커머스 · 골드')
      expect(rowOf('채팅회원').querySelector('.service-badge')).toHaveTextContent('채팅')
      expect(rowOf('채팅회원').textContent).not.toContain('커머스')
      // 이용 기록은 있는데 커머스 조회에 안 나오면 회색 "커머스".
      expect(rowOf('커머스회원').querySelector('.service-badge')).toHaveTextContent('커머스')
      expect(rowOf('미이용회원').querySelectorAll('.tier-badge')).toHaveLength(0)
    })

    it('service chips put service in the URL and ask the member list with it', async () => {
      const search = vi.spyOn(members, 'searchMembers').mockResolvedValue(emptyPage)
      const user = userEvent.setup()
      renderAt()
      await waitFor(() => expect(search).toHaveBeenLastCalledWith('', 0, 'name,asc'))
      const group = screen.getByRole('group', { name: '이용 서비스' })

      for (const [label, value] of [
        ['채팅', 'CHAT'],
        ['커머스', 'COMMERCE'],
        ['둘 다', 'BOTH'],
      ] as const) {
        await user.click(within(group).getByRole('button', { name: label }))
        await waitFor(() => expect(search).toHaveBeenLastCalledWith('', 0, 'name,asc', value))
        expect(location()).toBe(`/members?service=${value}`)
        expect(within(group).getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
      }

      await user.click(within(group).getByRole('button', { name: '전체' }))
      await waitFor(() => expect(search).toHaveBeenLastCalledWith('', 0, 'name,asc'))
      expect(location()).toBe('/members')
    })

    it('reads service and keyword from the URL', async () => {
      const search = vi.spyOn(members, 'searchMembers').mockResolvedValue(emptyPage)
      renderAt('/members?service=BOTH&keyword=demo')
      await waitFor(() => expect(search).toHaveBeenLastCalledWith('demo', 0, 'name,asc', 'BOTH'))
      expect(screen.getByLabelText('회원 검색')).toHaveValue('demo')
    })

    it('shows tier/agreement chips only under 커머스', async () => {
      vi.spyOn(members, 'searchMembers').mockResolvedValue(emptyPage)
      const getTiers = vi.spyOn(tiers, 'getTiers').mockResolvedValue([{ ...gold, sortOrder: 2, coupons: [], customerCount: 1 }])
      getTiers.mockClear()
      renderAt('/members?service=CHAT')
      await screen.findByRole('group', { name: '이용 서비스' })
      expect(screen.queryByRole('group', { name: '등급' })).toBeNull()
      expect(screen.queryByRole('group', { name: '약관 동의' })).toBeNull()
      expect(getTiers).not.toHaveBeenCalled()
    })

    it('a commerce sub-filter switches the list to commerce customers, and a row opens the member commerce tab', async () => {
      const search = vi.spyOn(members, 'searchMembers').mockResolvedValue(emptyPage)
      const find = vi.spyOn(members, 'findMemberByUserId').mockResolvedValue({ id: 42, userId: 'u-gold', email: 'g@b.c', username: '골드회원', role: 'ROLE_MEMBER' })
      vi.spyOn(tiers, 'getTiers').mockResolvedValue([{ ...gold, sortOrder: 2, coupons: [], customerCount: 1 }])
      const searchCustomers = vi.spyOn(customers, 'searchCustomers').mockResolvedValue({
        content: [
          {
            userId: 'u-gold',
            name: '골드회원',
            email: 'g@b.c',
            status: 'ACTIVE',
            tier: gold,
            basisAmount: 320000,
            rollingAmount: 1184000,
            joinedAt: '2026-09-01T00:00:00',
            termsAgreedAt: '2026-09-01T00:00:00',
            privacyAgreedAt: '2026-09-01T00:00:00',
            migrated: false,
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: PAGE_SIZE,
      })
      searchCustomers.mockClear()
      const user = userEvent.setup()
      renderAt('/members?service=COMMERCE')

      // 필터가 없으면 아직 회원 목록(service=COMMERCE)이다.
      await waitFor(() => expect(search).toHaveBeenLastCalledWith('', 0, 'name,asc', 'COMMERCE'))
      expect(searchCustomers).not.toHaveBeenCalled()

      await user.click(await screen.findByRole('button', { name: '골드' }))
      await waitFor(() => expect(searchCustomers).toHaveBeenLastCalledWith('', 0, { tier: 'GOLD', agreed: null }))
      expect(location()).toBe('/members?service=COMMERCE&tier=GOLD')
      expect(await screen.findByText('320,000원')).toBeInTheDocument()
      expect(screen.getByText('1,184,000원')).toBeInTheDocument()
      expect(rowOf('골드회원')).toHaveTextContent('커머스 · 골드')

      await user.click(within(screen.getByRole('group', { name: '약관 동의' })).getByRole('button', { name: '동의 전' }))
      await waitFor(() => expect(searchCustomers).toHaveBeenLastCalledWith('', 0, { tier: 'GOLD', agreed: false }))
      expect(location()).toBe('/members?service=COMMERCE&tier=GOLD&agreed=false')

      await user.click(rowOf('골드회원'))
      await waitFor(() => expect(location()).toBe('/members/42?tab=commerce'))
      expect(find).toHaveBeenCalledWith('u-gold')
    })

    it('leaving 커머스 drops the commerce sub-filters', async () => {
      vi.spyOn(members, 'searchMembers').mockResolvedValue(emptyPage)
      vi.spyOn(tiers, 'getTiers').mockResolvedValue([])
      vi.spyOn(customers, 'searchCustomers').mockResolvedValue(emptyPage)
      const user = userEvent.setup()
      renderAt('/members?service=COMMERCE&agreed=true')
      await waitFor(() => expect(customers.searchCustomers).toHaveBeenLastCalledWith('', 0, { tier: null, agreed: true }))
      await user.click(within(screen.getByRole('group', { name: '이용 서비스' })).getByRole('button', { name: '채팅' }))
      expect(location()).toBe('/members?service=CHAT')
      await waitFor(() => expect(members.searchMembers).toHaveBeenLastCalledWith('', 0, 'name,asc', 'CHAT'))
    })
  })
})
