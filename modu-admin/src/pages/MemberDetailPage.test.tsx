import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as customers from '../api/customers'
import { clearImageCache } from '../api/imageCache'
import * as members from '../api/members'
import * as points from '../api/points'
import * as storage from '../api/storage'
import * as tiers from '../api/tiers'
import { mockViewport } from '../test/viewport'
import MemberDetailPage from './MemberDetailPage'

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

const renderPage = (id = '1', search = '') =>
  render(
    <MemoryRouter initialEntries={[`/members/${id}${search}`]}>
      <Routes>
        <Route
          path="/members/:id"
          element={
            <>
              <MemberDetailPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

const CHAT = [{ service: 'CHAT' as const, firstUsedAt: '2026-09-01T00:00:00', lastUsedAt: '2026-09-27T15:30:00' }]
const COMMERCE = [{ service: 'COMMERCE' as const, firstUsedAt: '2026-09-10T01:00:00', lastUsedAt: '2026-09-28T02:00:00' }]

const emptySummary = (): customers.CustomerSummary => ({
  customer: null,
  orderCounts: { PAID: 0, SHIPPING: 0, DELIVERED: 0, CANCELLED: 0 },
  deliveredAmountTotal: 0,
  lastOrderAt: null,
  recentOrders: [],
  coupons: { available: 0, used: 0, expired: 0 },
  wishlistCount: 0,
  reviewCount: 0,
  points: null,
})


type FriendOverrides = Partial<members.AdminFriend> & { id: number; username: string }
const friend = (f: FriendOverrides): members.AdminFriend => ({
  userId: `user-${f.id}`,
  email: `${f.id}@modu.chat`,
  role: 'ROLE_MEMBER',
  friendName: null,
  favorite: false,
  friendStatus: 'NORMAL',
  ...f,
})
const noCounts = { all: 0, normal: 0, favorite: 0, hidden: 0, blocked: 0 }
const friendsPage = (content: members.AdminFriend[], extra: Partial<members.FriendPage> = {}): members.FriendPage => ({
  content,
  totalElements: content.length,
  totalPages: content.length > 0 ? 1 : 0,
  number: 0,
  size: 10,
  counts: { ...noCounts, all: content.length, normal: content.length },
  ...extra,
})

describe('MemberDetailPage', () => {
  beforeEach(() => {
    // 부른 횟수는 테스트마다 새로 센다("안 불렀다"를 확인하는 테스트가 있다).
    vi.clearAllMocks()
    clearImageCache()
    vi.spyOn(customers, 'getCustomer').mockRejectedValue(new ApiError(404, '{"message":"not found"}'))
    vi.spyOn(customers, 'lookupCustomers').mockResolvedValue(new Map())
    vi.spyOn(customers, 'getCustomerSummary').mockResolvedValue(emptySummary())
    vi.spyOn(points, 'getAccount').mockRejectedValue(new ApiError(404, 'no account'))
    vi.spyOn(tiers, 'getTiers').mockResolvedValue([])
    vi.spyOn(members, 'getMemberFriends').mockResolvedValue(friendsPage([]))
  })

  it('shows the profile image via a blob object URL when profileImage is set', async () => {
    vi.spyOn(members, 'getMember').mockResolvedValue({
      member: {
        id: 1,
        userId: 'u1',
        email: 'a@b.c',
        username: '민수',
        role: 'ROLE_MEMBER',
        profileImage: 'a.jpg',
        createdDate: '2026-09-04T12:34:56',
      },
      friendCount: 3,
      friends: [],
      staffPermissions: [],
      services: CHAT,
    })
    const fetchImageObjectUrl = vi.spyOn(storage, 'fetchImageObjectUrl').mockResolvedValue('blob:fake')

    renderPage()

    expect(await screen.findByText('민수')).toBeInTheDocument()
    // 직원이 아니면 권한 배지 없이 "직원 아님"이다. 옛 role 은 보여 주지 않는다.
    expect(screen.getByText('직원 아님')).toBeInTheDocument()
    expect(screen.queryByText('일반 회원')).toBeNull()

    const img = (await screen.findAllByAltText(/민수/)).find((el) => el.tagName === 'IMG') as HTMLImageElement
    expect(img).toBeDefined()
    expect(img.src).toBe('blob:fake')
    expect(fetchImageObjectUrl).toHaveBeenCalledWith('a.jpg')
  })

  it('shows the first letter as a placeholder when profileImage is missing, without calling fetchImageObjectUrl', async () => {
    vi.spyOn(members, 'getMember').mockResolvedValue({
      member: {
        id: 2,
        userId: 'u2',
        email: 'b@c.d',
        username: '민수',
        role: 'ROLE_MEMBER',
      },
      friendCount: 0,
      friends: [],
      staffPermissions: ['SUPER'],
    })
    const fetchImageObjectUrl = vi.spyOn(storage, 'fetchImageObjectUrl').mockResolvedValue('blob:fake')

    renderPage('2')

    expect(await screen.findByText('민수')).toBeInTheDocument()
    // 이름 옆과 "직원 권한" 칸 두 곳에 최상위 배지가 보인다.
    expect(screen.getAllByText('최상위')).toHaveLength(2)
    expect(screen.getByText('민')).toBeInTheDocument()
    expect(fetchImageObjectUrl).not.toHaveBeenCalled()
  })

  it('lays out a profile panel beside one card that holds the tabs and their content', async () => {
    vi.spyOn(members, 'getMember').mockResolvedValue({
      member: {
        id: 1,
        userId: 'u1',
        email: 'a@b.c',
        username: '민수',
        role: 'ROLE_MEMBER',
        statusMessage: '오늘도 화이팅',
        profileImage: 'p-123.jpg',
        wallpaperImage: 'w-456.jpg',
      },
      friendCount: 1,
      friends: [{ id: 50, userId: 'demo-jiwoo', email: 'jiwoo@modu.chat', username: '김지우', role: 'ROLE_MEMBER' }],
      services: CHAT,
    })
    vi.spyOn(storage, 'fetchImageObjectUrl').mockResolvedValue('blob:fake')
    vi.spyOn(members, 'getMemberFriends').mockResolvedValue(friendsPage([friend({ id: 50, username: '김지우' })]))

    const { container } = renderPage()
    expect(await screen.findByText('김지우')).toBeInTheDocument()

    // 2단 그리드의 두 칸: 왼쪽 프로필, 오른쪽 탭 카드. 탭 줄과 탭 내용이 같은 카드 안에 있다.
    const hub = container.querySelector('.member-hub') as HTMLElement
    expect(hub.children).toHaveLength(2)
    expect(hub.children[0]).toHaveClass('member-profile')
    const main = hub.children[1] as HTMLElement
    expect(main).toHaveClass('member-hub-main')
    expect(within(main).getByRole('tablist')).toBeInTheDocument()
    const panel = within(main).getByRole('tabpanel')

    // 채팅 탭: 숫자 칸, 친구 표, 접힌 파일 정보(파일명은 여기에만).
    expect(panel.querySelector('.kpi-grid')).toHaveTextContent('친구 수1명')
    expect(panel.querySelector('.kpi--wide')).toHaveTextContent('오늘도 화이팅')
    expect(within(panel).getByRole('region', { name: '친구 목록' }).querySelector('table')).toBeInTheDocument()
    const files = panel.querySelector('details.file-info') as HTMLDetailsElement
    expect(files.open).toBe(false)
    expect(within(files).getByText('파일 정보').tagName).toBe('SUMMARY')
    expect(files).toHaveTextContent('p-123.jpg')
    expect(screen.getAllByText('w-456.jpg')).toHaveLength(1)
  })

  it('copies the user id with the 복사 button', async () => {
    vi.spyOn(members, 'getMember').mockResolvedValue({
      member: { id: 1, userId: 'user-abc-123', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' },
      friendCount: 0,
      friends: [],
      services: CHAT,
    })
    // userEvent.setup() 이 navigator.clipboard 를 테스트용으로 바꿔 끼운다.
    const user = userEvent.setup()
    renderPage()

    const button = await screen.findByRole('button', { name: '사용자 ID 복사' })
    expect(button).toHaveAttribute('title', '복사')
    await user.click(button)
    expect(await navigator.clipboard.readText()).toBe('user-abc-123')
    expect(button).toHaveTextContent('복사됨')
  })

  it('says 복사 실패 when the clipboard is not available', async () => {
    vi.spyOn(members, 'getMember').mockResolvedValue({
      member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' },
      friendCount: 0,
      friends: [],
      services: CHAT,
    })
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    renderPage()

    const button = await screen.findByRole('button', { name: '사용자 ID 복사' })
    await user.click(button)
    expect(button).toHaveTextContent('실패')
    expect(button).toHaveAttribute('title', '복사 실패')
  })


  it('on a narrow screen lists friends as cards with their badges and opens a friend on tap', async () => {
    const restore = mockViewport(true)
    try {
      vi.spyOn(members, 'getMember').mockImplementation((id) =>
        Promise.resolve(
          id === '50'
            ? { member: { id: 50, userId: 'demo-jiwoo', email: 'jiwoo@modu.chat', username: '김지우', role: 'ROLE_MEMBER' }, friendCount: 0, friends: [], services: CHAT }
            : { member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' }, friendCount: 1, friends: [], services: CHAT },
        ),
      )
      vi.spyOn(members, 'getMemberFriends').mockImplementation((id) =>
        Promise.resolve(
          id === 1
            ? friendsPage([friend({ id: 50, userId: 'demo-jiwoo', email: 'jiwoo@modu.chat', username: '김지우', friendName: '지우야', favorite: true, friendStatus: 'BLOCKED' })])
            : friendsPage([]),
        ),
      )
      const user = userEvent.setup()
      renderPage()

      const card = await screen.findByRole('button', { name: /김지우/ })
      expect(screen.queryByRole('table')).toBeNull()
      expect(card).toHaveTextContent('지우야')
      expect(card).toHaveTextContent('jiwoo@modu.chat')
      expect(within(card).getByRole('img', { name: '즐겨찾기' })).toHaveTextContent('★')
      expect(within(card).getByText('차단')).toHaveClass('status-badge--cancelled')
      expect(card.closest('li')).toHaveClass('friend-row--muted')

      await user.click(card)
      // 친구 상세로 이동해 그 회원의 친구 목록을 읽는다.
      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/members/50'))
      expect(await screen.findByText('친구가 없어요')).toBeInTheDocument()
      expect(members.getMemberFriends).toHaveBeenLastCalledWith(50, 'ALL', 0)
    } finally {
      restore()
    }
  })

  describe('채팅 tab friends', () => {
    const detail = { member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER', statusMessage: '안녕' }, friendCount: 5, friends: [], services: CHAT }
    const counts = { all: 12, normal: 8, favorite: 3, hidden: 2, blocked: 2 }
    const tenFriends = [
      friend({ id: 50, username: '김지우', friendName: '지우야', favorite: true }),
      friend({ id: 51, username: '박민준', friendStatus: 'HIDDEN' }),
      friend({ id: 52, username: '이서연', friendStatus: 'BLOCKED', staffPermissions: ['SUPER'] }),
      ...Array.from({ length: 7 }, (_, i) => friend({ id: 60 + i, username: `친구${i}` })),
    ]
    const chips = () => within(screen.getByRole('group', { name: '친구 필터' })).getAllByRole('button').map((b) => b.textContent)

    it('shows counts on the chips and the KPI, and sends the filter and page', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue(detail)
      const getFriends = vi.spyOn(members, 'getMemberFriends').mockImplementation((_id, filter, page) =>
        Promise.resolve(
          filter === 'ALL'
            ? friendsPage(page === 0 ? tenFriends : [friend({ id: 70, username: '마지막' }), friend({ id: 71, username: '끝' })], {
                totalElements: 12,
                totalPages: 2,
                number: page,
                counts,
              })
            : friendsPage([friend({ id: 50, username: '김지우', favorite: true })], { counts }),
        ),
      )
      const user = userEvent.setup()
      const { container } = renderPage()

      expect(await screen.findByText('김지우')).toBeInTheDocument()
      expect(getFriends).toHaveBeenCalledWith(1, 'ALL', 0)
      expect(chips()).toEqual(['전체 12', '일반 8', '즐겨찾기 3', '숨김 2', '차단 2'])
      expect(screen.getByRole('button', { name: '전체 12' })).toHaveAttribute('aria-pressed', 'true')
      // 친구 수는 새 목록 API 의 전체 수(상세 응답의 5 가 아니라).
      expect(container.querySelector('.kpi-grid')).toHaveTextContent('친구 수12명')
      expect(screen.getByText('12명 중 1–10')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '다음' }))
      expect(await screen.findByText('마지막')).toBeInTheDocument()
      expect(getFriends).toHaveBeenLastCalledWith(1, 'ALL', 1)
      expect(screen.getByText('12명 중 11–12')).toBeInTheDocument()

      // 칩을 바꾸면 첫 페이지부터.
      await user.click(screen.getByRole('button', { name: '즐겨찾기 3' }))
      expect(getFriends).toHaveBeenLastCalledWith(1, 'FAVORITE', 0)
      expect(await screen.findByText('김지우')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '즐겨찾기 3' })).toHaveAttribute('aria-pressed', 'true')
      // 한 페이지뿐이면 페이저는 없다.
      expect(screen.queryByRole('button', { name: '다음' })).toBeNull()
    })

    it('shows the star, status pills, muted hidden/blocked rows and opens a friend', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue(detail)
      vi.spyOn(members, 'getMemberFriends').mockResolvedValue(friendsPage(tenFriends.slice(0, 3), { counts }))
      const user = userEvent.setup()
      renderPage()

      const table = await screen.findByRole('table')
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['이름', '내가 정한 이름', '이메일', '사용자 ID', '상태', '직원'])
      const rows = within(table).getAllByRole('button')
      const [jiwoo, minjun, seoyeon] = rows

      expect(within(jiwoo).getByRole('img', { name: '즐겨찾기' })).toHaveTextContent('★')
      expect(within(jiwoo).getByText('즐겨찾기')).toHaveClass('status-badge--amber')
      expect(jiwoo).toHaveTextContent('지우야')
      expect(jiwoo).not.toHaveClass('friend-row--muted')

      expect(within(minjun).getByText('숨김')).toHaveClass('status-badge')
      expect(within(minjun).getByText('숨김')).not.toHaveClass('status-badge--cancelled')
      expect(within(minjun).queryByRole('img', { name: '즐겨찾기' })).toBeNull()
      expect(minjun).toHaveClass('friend-row--muted')

      expect(within(seoyeon).getByText('차단')).toHaveClass('status-badge--cancelled')
      expect(within(seoyeon).getByText('최상위')).toBeInTheDocument()
      expect(seoyeon).toHaveClass('friend-row--muted')

      await user.click(minjun)
      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/members/51'))
    })

    it('says which list is empty for each filter, and every chip is clickable even at 0', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue(detail)
      const getFriends = vi.spyOn(members, 'getMemberFriends').mockResolvedValue(friendsPage([]))
      const user = userEvent.setup()
      renderPage()

      expect(await screen.findByText('친구가 없어요')).toBeInTheDocument()
      expect(chips()).toEqual(['전체 0', '일반 0', '즐겨찾기 0', '숨김 0', '차단 0'])
      for (const [chip, filter, text] of [
        ['즐겨찾기 0', 'FAVORITE', '즐겨찾기한 친구가 없어요'],
        ['숨김 0', 'HIDDEN', '숨긴 친구가 없어요'],
        ['차단 0', 'BLOCKED', '차단한 친구가 없어요'],
        ['일반 0', 'NORMAL', '친구가 없어요'],
      ] as const) {
        await user.click(screen.getByRole('button', { name: chip }))
        expect(await screen.findByText(text)).toBeInTheDocument()
        expect(getFriends).toHaveBeenLastCalledWith(1, filter, 0)
      }
      expect(screen.queryByRole('table')).toBeNull()
    })

    it('a failing friends API shows an error only inside the friends card', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue(detail)
      vi.spyOn(members, 'getMemberFriends').mockRejectedValue(new ApiError(503, 'down'))
      const { container } = renderPage()

      const card = await screen.findByRole('region', { name: '친구 목록' })
      expect(await within(card).findByText('친구 목록을 불러오지 못했습니다')).toBeInTheDocument()
      // 머리, 상태 메시지, 파일 정보는 그대로. 친구 수는 상세 응답 값으로.
      expect(screen.getByText('민수')).toBeInTheDocument()
      expect(container.querySelector('.kpi--wide')).toHaveTextContent('안녕')
      expect(container.querySelector('.kpi-grid')).toHaveTextContent('친구 수5명')
      expect(screen.getByText('파일 정보')).toBeInTheDocument()
      expect(screen.getAllByText('친구 목록을 불러오지 못했습니다')).toHaveLength(1)
    })

    it('reads friends only once the 채팅 tab is shown', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue({ ...detail, services: [...CHAT, ...COMMERCE] })
      const getFriends = vi.spyOn(members, 'getMemberFriends').mockResolvedValue(friendsPage([]))
      const user = userEvent.setup()
      renderPage('1', '?tab=commerce')

      expect(await screen.findByRole('tab', { name: '커머스' })).toHaveAttribute('aria-selected', 'true')
      expect(getFriends).not.toHaveBeenCalled()
      await user.click(screen.getByRole('tab', { name: '채팅' }))
      expect(await screen.findByText('친구가 없어요')).toBeInTheDocument()
      expect(getFriends).toHaveBeenCalledWith(1, 'ALL', 0)
    })
  })

  describe('header', () => {
    it('shows common info: service badges, per-service first/last use in KST and the point balance', async () => {
      const gold = { code: 'GOLD', name: '골드', color: '#D97706', earnRate: 3, minAmount: 0 }
      vi.spyOn(members, 'getMember').mockResolvedValue({
        member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' },
        friendCount: 0,
        friends: [],
        createdDate: '2026-08-01T09:00:00',
        services: [...CHAT, ...COMMERCE],
      })
      vi.spyOn(customers, 'lookupCustomers').mockResolvedValue(new Map([['u1', { userId: 'u1', status: 'ACTIVE' as const, tier: gold, agreed: true }]]))
      const getAccount = vi.spyOn(points, 'getAccount').mockResolvedValue({ userId: 'u1', balance: 1234 })

      const { container } = renderPage()

      expect((await screen.findAllByText('커머스 · 골드')).length).toBeGreaterThan(0)
      const header = container.querySelector('.member-hub-header') as HTMLElement
      for (const badge of within(header).getAllByText('채팅')) expect(badge).toHaveClass('service-badge')
      // 이메일은 이름 아래 한 번만.
      expect(within(header).getAllByText('a@b.c')).toHaveLength(1)
      // 서비스마다 배지 + 날짜(한국 시간), 전체 시각은 title.
      const usage = header.querySelectorAll('.member-usage-list li')
      expect(usage).toHaveLength(2)
      expect(usage[0]).toHaveTextContent('채팅처음 2026.09.01 · 마지막 2026.09.28')
      expect(within(usage[0] as HTMLElement).getByText('마지막 2026.09.28')).toHaveAttribute('title', '2026-09-28 00:30')
      expect(usage[1]).toHaveTextContent('커머스처음 2026.09.10 · 마지막 2026.09.28')
      expect(within(usage[1] as HTMLElement).getByText('처음 2026.09.10')).toHaveAttribute('title', '2026-09-10 10:00')
      expect(within(header).getByText('이용 중')).toHaveClass('status-badge--done')
      expect(await within(header).findByText('1,234 P')).toHaveClass('member-points-value')
      expect(within(header).getByRole('link', { name: '내역 ›' })).toHaveAttribute('href', '/points/u1')
      expect(getAccount).toHaveBeenCalledWith('u1')
    })

    it('shows 0 P without a point account and - when the point service fails', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue({
        member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' },
        friendCount: 0,
        friends: [],
        services: CHAT,
      })
      const { unmount } = renderPage()
      expect(await screen.findByText('0 P')).toHaveClass('member-points-value')
      unmount()

      vi.spyOn(points, 'getAccount').mockRejectedValue(new ApiError(503, 'down'))
      const { container } = renderPage()
      await screen.findByText('친구가 없어요')
      await waitFor(() => expect(container.querySelector('.member-hub-header .member-points-value')?.textContent).toBe('-'))
    })
  })

  describe('service tabs', () => {
    const base = { member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' }, friendCount: 0, friends: [] }
    const tabNames = () => screen.queryAllByRole('tab').map((t) => t.textContent)

    it('chat only: only the 채팅 tab, and commerce is never read', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue({ ...base, services: CHAT })
      renderPage()
      expect(await screen.findByText('친구가 없어요')).toBeInTheDocument()
      expect(tabNames()).toEqual(['채팅'])
      expect(screen.getByRole('tab', { name: '채팅' })).toHaveAttribute('aria-selected', 'true')
      expect(customers.getCustomerSummary).not.toHaveBeenCalled()
    })

    it('commerce only (usage record): only the 커머스 tab, opened by default', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue({ ...base, services: COMMERCE })
      renderPage()
      expect(await screen.findByRole('tab', { name: '커머스' })).toHaveAttribute('aria-selected', 'true')
      expect(tabNames()).toEqual(['커머스'])
      expect(screen.queryByText(/친구/)).toBeNull()
      await waitFor(() => expect(customers.getCustomerSummary).toHaveBeenCalledWith('u1'))
    })

    it('commerce tab also appears for a customer without a usage record', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue({ ...base, services: [] })
      vi.spyOn(customers, 'lookupCustomers').mockResolvedValue(
        new Map([['u1', { userId: 'u1', status: 'ACTIVE' as const, tier: { code: 'WELCOME', name: '웰컴', color: '#64748B', earnRate: 1, minAmount: 0 }, agreed: false }]]),
      )
      renderPage()
      expect(await screen.findByRole('tab', { name: '커머스' })).toBeInTheDocument()
      expect(tabNames()).toEqual(['커머스'])
      expect(screen.queryByText('아직 이용한 서비스가 없어요')).toBeNull()
    })

    it('none: no tabs, a muted line instead', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue({ ...base, services: [] })
      renderPage()
      expect(await screen.findByText('아직 이용한 서비스가 없어요')).toBeInTheDocument()
      expect(screen.queryAllByRole('tab')).toHaveLength(0)
      expect(customers.getCustomerSummary).not.toHaveBeenCalled()
    })

    it('both: 채팅 first by default, commerce loads only when its tab opens and the tab lands in the URL', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue({ ...base, services: [...CHAT, ...COMMERCE] })
      const user = userEvent.setup()
      renderPage()
      expect(await screen.findByText('친구가 없어요')).toBeInTheDocument()
      expect(tabNames()).toEqual(['채팅', '커머스'])
      expect(customers.getCustomerSummary).not.toHaveBeenCalled()

      await user.click(screen.getByRole('tab', { name: '커머스' }))
      expect(screen.getByRole('tab', { name: '커머스' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('location').textContent).toBe('/members/1?tab=commerce')
      await waitFor(() => expect(customers.getCustomerSummary).toHaveBeenCalledWith('u1'))
      expect(screen.queryByText('친구가 없어요')).toBeNull()

      await user.click(screen.getByRole('tab', { name: '채팅' }))
      expect(screen.getByTestId('location').textContent).toBe('/members/1?tab=chat')
      expect(await screen.findByText('친구가 없어요')).toBeInTheDocument()
    })

    it('opens the tab named in ?tab=, and falls back to the first tab for a hidden one', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue({ ...base, services: [...CHAT, ...COMMERCE] })
      const { unmount } = renderPage('1', '?tab=commerce')
      expect(await screen.findByRole('tab', { name: '커머스' })).toHaveAttribute('aria-selected', 'true')
      unmount()

      vi.spyOn(members, 'getMember').mockResolvedValue({ ...base, services: CHAT })
      renderPage('1', '?tab=commerce')
      expect(await screen.findByRole('tab', { name: '채팅' })).toHaveAttribute('aria-selected', 'true')
    })

    it('a failing commerce service shows an error only inside its tab', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue({ ...base, services: [...CHAT, ...COMMERCE] })
      vi.spyOn(customers, 'getCustomerSummary').mockRejectedValue(new ApiError(503, 'down'))
      vi.spyOn(customers, 'lookupCustomers').mockRejectedValue(new Error('down'))
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('친구가 없어요')
      expect(screen.queryByText('커머스 정보를 불러오지 못했습니다')).toBeNull()

      await user.click(screen.getByRole('tab', { name: '커머스' }))
      const panel = screen.getByRole('tabpanel')
      expect(await within(panel).findByText('커머스 정보를 불러오지 못했습니다')).toBeInTheDocument()
      // 머리(공통 정보)와 채팅 탭은 그대로다.
      expect(screen.getByText('민수')).toBeInTheDocument()
      await user.click(screen.getByRole('tab', { name: '채팅' }))
      expect(await screen.findByText('친구가 없어요')).toBeInTheDocument()
    })
  })

  describe('커머스 tab', () => {
    const tier = (code: string, name: string, color: string) => ({ code, name, color, earnRate: 3, minAmount: 0 })
    const detail = () => ({
      member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' },
      friendCount: 0,
      friends: [],
      services: COMMERCE,
    })
    const customer = {
      userId: 'u1',
      name: '민수',
      email: 'a@b.c',
      status: 'ACTIVE' as const,
      tier: tier('GOLD', '골드', '#D97706'),
      basisAmount: 320000,
      rollingAmount: 184000,
      joinedAt: '2026-09-01T00:00:00',
      termsAgreedAt: '2026-09-27T03:00:00',
      privacyAgreedAt: '2026-09-27T03:00:00',
      migrated: true,
    }

    it('shows the tier card, order counts, recent orders linked to the order page, coupons, counts and tier history', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue(detail())
      vi.spyOn(customers, 'getCustomerSummary').mockResolvedValue({
        ...emptySummary(),
        customer,
        orderCounts: { PAID: 1, SHIPPING: 2, DELIVERED: 5, CANCELLED: 1 },
        deliveredAmountTotal: 512000,
        lastOrderAt: '2026-09-27T01:00:00',
        recentOrders: [{ id: 77, orderNo: 'ORD-0077', status: 'DELIVERED', paymentAmount: 45000, createdAt: '2026-09-27T01:00:00', itemSummary: '모두 다이어리 2027 외 1건' }],
        coupons: { available: 3, used: 4, expired: 2 },
        wishlistCount: 6,
        reviewCount: 2,
      })
      vi.spyOn(customers, 'getCustomer').mockResolvedValue({
        ...customer,
        tierHistory: [
          { fromCode: 'SILVER', toCode: 'GOLD', basisAmount: 320000, periodLabel: '2026.03 ~ 2026.08', changedAt: '2026-08-31T15:10:00', reason: 'MONTHLY' },
        ],
      })
      vi.spyOn(tiers, 'getTiers').mockResolvedValue([
        { ...tier('SILVER', '실버', '#94A3B8'), sortOrder: 1, coupons: [], customerCount: 0 },
        { ...tier('GOLD', '골드', '#D97706'), sortOrder: 2, coupons: [], customerCount: 0 },
      ])

      renderPage()

      const panel = await screen.findByRole('tabpanel')
      const card = await within(panel).findByRole('region', { name: '커머스 등급' })
      // 등급 카드는 이름만 큰 배지로(머리의 "커머스 · 골드" 를 되풀이하지 않는다).
      expect(within(card).getByText('골드')).toHaveClass('tier-badge--lg')
      expect(within(card).queryByText('커머스 · 골드')).toBeNull()
      expect(card).toHaveTextContent('적립 3%')
      expect(card).toHaveTextContent('기준 금액320,000원')
      expect(card).toHaveTextContent('최근 6개월184,000원')

      const agreement = within(panel).getByRole('region', { name: '커머스 가입' })
      expect(agreement).toHaveTextContent('2026-09-27 12:00') // 약관 동의(KST)
      expect(agreement).toHaveTextContent('이전 이용 기록으로 등록')

      // 숫자 칸은 딱 4개.
      const kpis = panel.querySelectorAll('.kpi-grid--4 > .kpi')
      expect(kpis).toHaveLength(4)
      expect(kpis[0]).toHaveTextContent('배송 완료 누적512,000원마지막 주문 2026-09-27 10:00')
      expect(kpis[1]).toHaveTextContent('주문9건')
      expect(kpis[1]).toHaveTextContent('결제 1배송중 2완료 5취소 1')
      expect(kpis[1].querySelectorAll('.order-bar .order-bar-seg')).toHaveLength(4)
      expect(kpis[2]).toHaveTextContent('보유 3장사용 4 · 만료 2')
      expect(kpis[3]).toHaveTextContent('6찜2리뷰')

      const recent = within(panel).getByRole('region', { name: '최근 주문' })
      expect(within(recent).getByRole('link', { name: 'ORD-0077' })).toHaveAttribute('href', '/orders/77')
      expect(recent).toHaveTextContent('모두 다이어리 2027 외 1건')
      expect(within(recent).getByText('배송완료')).toHaveClass('status-badge--done')

      const history = within(panel).getByRole('region', { name: '등급 이력' })
      expect(await within(history).findByText('실버')).toBeInTheDocument()
      expect(history).toHaveTextContent('2026-09-01 00:10') // 이력 시각(KST)
      expect(history).toHaveTextContent('정기 산정')
    })

    it('says 약관 동의 전 for a customer who has not agreed yet', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue(detail())
      const notAgreed = { ...customer, termsAgreedAt: null, privacyAgreedAt: null }
      vi.spyOn(customers, 'getCustomerSummary').mockResolvedValue({ ...emptySummary(), customer: notAgreed })
      vi.spyOn(customers, 'getCustomer').mockResolvedValue({ ...notAgreed, tierHistory: [] })
      renderPage()
      const agreement = await screen.findByRole('region', { name: '커머스 가입' })
      expect(within(agreement).getByText('약관 동의 전')).toHaveClass('status-badge')
      expect(agreement).not.toHaveTextContent('개인정보 동의')
      // 이력이 없으면 표 대신 한 줄 안내.
      expect(await screen.findByText('등급 변경 이력이 없어요')).toBeInTheDocument()
    })

    const tierList = [
      { ...tier('SILVER', '실버', '#94A3B8'), minAmount: 0, sortOrder: 1, coupons: [], customerCount: 0 },
      { ...tier('GOLD', '골드', '#D97706'), minAmount: 300000, sortOrder: 2, coupons: [], customerCount: 0 },
      { ...tier('VIP', 'VIP', '#7C3AED'), minAmount: 1000000, sortOrder: 3, coupons: [], customerCount: 0 },
    ]

    it('shows how much is left to the next tier from the tier list and the last 6 months', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue(detail())
      vi.spyOn(customers, 'getCustomerSummary').mockResolvedValue({
        ...emptySummary(),
        customer: { ...customer, tier: tier('SILVER', '실버', '#94A3B8'), rollingAmount: 120000 },
      })
      vi.spyOn(tiers, 'getTiers').mockResolvedValue(tierList)
      renderPage()

      const card = await screen.findByRole('region', { name: '커머스 등급' })
      expect(await within(card).findByText('골드까지 180,000원')).toBeInTheDocument()
      expect(within(card).getByRole('progressbar', { name: '다음 등급까지' })).toHaveAttribute('aria-valuenow', '40')
    })

    it('says 최고 등급 at the top tier and hides the bar when tiers cannot be read', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue(detail())
      vi.spyOn(customers, 'getCustomerSummary').mockResolvedValue({
        ...emptySummary(),
        customer: { ...customer, tier: tier('VIP', 'VIP', '#7C3AED'), rollingAmount: 1500000 },
      })
      vi.spyOn(tiers, 'getTiers').mockResolvedValue(tierList)
      const { unmount } = renderPage()
      const card = await screen.findByRole('region', { name: '커머스 등급' })
      expect(await within(card).findByText('최고 등급')).toBeInTheDocument()
      unmount()

      vi.spyOn(tiers, 'getTiers').mockRejectedValue(new ApiError(503, 'down'))
      renderPage()
      const again = await screen.findByRole('region', { name: '커머스 등급' })
      await waitFor(() => expect(tiers.getTiers).toHaveBeenCalled())
      expect(within(again).queryByRole('progressbar')).toBeNull()
    })
  })
})
