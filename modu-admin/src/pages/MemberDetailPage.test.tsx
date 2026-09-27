import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import * as customers from '../api/customers'
import { clearImageCache } from '../api/imageCache'
import * as members from '../api/members'
import * as storage from '../api/storage'
import * as tiers from '../api/tiers'
import { mockViewport } from '../test/viewport'
import MemberDetailPage from './MemberDetailPage'

const renderPage = (id = '1') =>
  render(
    <MemoryRouter initialEntries={[`/members/${id}`]}>
      <Routes>
        <Route path="/members/:id" element={<MemberDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('MemberDetailPage', () => {
  beforeEach(() => {
    clearImageCache()
    vi.spyOn(customers, 'getCustomer').mockRejectedValue(new ApiError(404, '{"message":"not found"}'))
    vi.spyOn(tiers, 'getTiers').mockResolvedValue([])
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

  it('renders the friend list and lets you open a friend', async () => {
    vi.spyOn(members, 'getMember').mockResolvedValue({
      member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' },
      friendCount: 2,
      friends: [
        { id: 50, userId: 'demo-jiwoo', email: 'jiwoo@modu.chat', username: '김지우', role: 'ROLE_MEMBER', friendName: '지우야' },
        { id: 51, userId: 'demo-minjun', email: 'minjun@modu.chat', username: '박민준', role: 'ROLE_MEMBER', friendName: '' },
      ],
    })

    renderPage()

    expect(await screen.findByText('친구 2명')).toBeInTheDocument()
    expect(screen.getByText('김지우')).toBeInTheDocument()
    expect(screen.getByText('박민준')).toBeInTheDocument()
    expect(screen.getByText('demo-jiwoo')).toBeInTheDocument()
    // 그 회원이 정한 친구 이름. 비어 있으면 '-'
    expect(screen.getByText('지우야')).toBeInTheDocument()
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
  })

  it('says so when the member has no friends', async () => {
    vi.spyOn(members, 'getMember').mockResolvedValue({
      member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' },
      friendCount: 0,
      friends: [],
    })

    renderPage()

    expect(await screen.findByText('친구 0명')).toBeInTheDocument()
    expect(screen.getByText('친구가 없습니다')).toBeInTheDocument()
  })


  it('places the friend list beside the member card, not under it', async () => {
    vi.spyOn(members, 'getMember').mockResolvedValue({
      member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' },
      friendCount: 1,
      friends: [
        { id: 50, userId: 'demo-jiwoo', email: 'jiwoo@modu.chat', username: '김지우', role: 'ROLE_MEMBER' },
      ],
    })

    const { container } = renderPage()
    expect(await screen.findByText('친구 1명')).toBeInTheDocument()

    // 카드와 친구 목록이 같은 2단 컨테이너의 형제로 들어가야 옆에 나란히 놓인다.
    const columns = container.querySelector('.member-columns')
    expect(columns).toBeInTheDocument()
    expect(columns?.querySelector('.profile-card')).toBeInTheDocument()
    expect(columns?.querySelector('table')).toBeInTheDocument()
    expect(columns?.children.length).toBe(2)
  })


  it('on a narrow screen lists friends as cards and opens a friend on tap', async () => {
    const restore = mockViewport(true)
    try {
      vi.spyOn(members, 'getMember').mockImplementation((id) =>
        Promise.resolve(
          id === '50'
            ? { member: { id: 50, userId: 'demo-jiwoo', email: 'jiwoo@modu.chat', username: '김지우', role: 'ROLE_MEMBER' }, friendCount: 0, friends: [] }
            : {
                member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' },
                friendCount: 1,
                friends: [{ id: 50, userId: 'demo-jiwoo', email: 'jiwoo@modu.chat', username: '김지우', role: 'ROLE_MEMBER', friendName: '지우야' }],
              },
        ),
      )
      const user = userEvent.setup()
      renderPage()

      const card = await screen.findByRole('button', { name: /김지우/ })
      expect(screen.queryByRole('table')).toBeNull()
      expect(card).toHaveTextContent('지우야')
      expect(card).toHaveTextContent('jiwoo@modu.chat')

      await user.click(card)
      // 친구 상세로 이동해 그 회원의 카드가 뜬다.
      expect(await screen.findByText('친구 0명')).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  describe('커머스 section', () => {
    const detail = () => ({ member: { id: 1, userId: 'u1', email: 'a@b.c', username: '민수', role: 'ROLE_MEMBER' }, friendCount: 0, friends: [] })
    const tier = (code: string, name: string, color: string) => ({ code, name, color, earnRate: 3, minAmount: 0 })

    it('shows joined/agreed dates, amounts, tier history and a link to the customer page', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue(detail())
      const getCustomer = vi.spyOn(customers, 'getCustomer').mockResolvedValue({
        userId: 'u1',
        name: '민수',
        email: 'a@b.c',
        status: 'ACTIVE',
        tier: tier('GOLD', '골드', '#D97706'),
        basisAmount: 320000,
        rollingAmount: 184000,
        joinedAt: '2026-09-01T00:00:00',
        termsAgreedAt: '2026-09-27T03:00:00',
        privacyAgreedAt: '2026-09-27T03:00:00',
        migrated: true,
        tierHistory: [
          { fromCode: 'SILVER', toCode: 'GOLD', basisAmount: 320000, periodLabel: '2026.03 ~ 2026.08', changedAt: '2026-08-31T15:10:00', reason: 'MONTHLY' },
        ],
      })
      vi.spyOn(tiers, 'getTiers').mockResolvedValue([
        { ...tier('SILVER', '실버', '#94A3B8'), sortOrder: 1, coupons: [], customerCount: 0 },
        { ...tier('GOLD', '골드', '#D97706'), sortOrder: 2, coupons: [], customerCount: 0 },
      ])

      renderPage()

      const section = await screen.findByRole('region', { name: '커머스' })
      expect(await within(section).findByText('커머스 · 골드')).toBeInTheDocument()
      expect(getCustomer).toHaveBeenCalledWith('u1')
      expect(section).toHaveTextContent('2026-09-27 12:00') // 약관 동의(KST)
      expect(section).toHaveTextContent('320,000원')
      expect(section).toHaveTextContent('184,000원')
      expect(section).toHaveTextContent('이전 이용 기록으로 등록')
      expect(await within(section).findByText('실버')).toBeInTheDocument()
      expect(section).toHaveTextContent('2026-09-01 00:10') // 이력 시각(KST)
      expect(section).toHaveTextContent('정기 산정')
      expect(within(section).getByRole('link', { name: /고객 화면/ })).toHaveAttribute('href', '/customers/u1')
    })

    it('says the member is not a customer on 404 and keeps the page on other errors', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue(detail())
      renderPage()
      expect(await screen.findByText('커머스 고객이 아닙니다')).toBeInTheDocument()
    })

    it('keeps the member page when the commerce lookup fails', async () => {
      vi.spyOn(members, 'getMember').mockResolvedValue(detail())
      vi.spyOn(customers, 'getCustomer').mockRejectedValue(new ApiError(503, 'down'))
      renderPage()
      expect(await screen.findByText('커머스 정보를 불러오지 못했습니다')).toBeInTheDocument()
      expect(screen.getByText('친구 0명')).toBeInTheDocument()
    })
  })
})
