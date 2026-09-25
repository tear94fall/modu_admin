import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, setDisplayTimeZone } from '@modu/console-core'
import * as members from '../api/members'
import { navSections } from '../nav'
import { loginAs, SUPER_ROLES } from '../test/jwt'
import MemberDetailPage from './MemberDetailPage'
import MembersPage from './MembersPage'
import StaffPage from './StaffPage'

const member = (over: Partial<members.StaffMemberSummary> = {}): members.StaffMemberSummary => ({
  id: 11,
  userId: '104614857372392207989',
  email: 'joonsub2990@gmail.com',
  username: '임준섭',
  profileImage: null,
  status: 'ACTIVE',
  permissions: [],
  createdDate: '2026-09-04T11:45:00',
  ...over,
})
const page = (content: members.StaffMemberSummary[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 15 })

const detail = (over: Partial<members.StaffMemberDetail> = {}): members.StaffMemberDetail => ({
  id: 11,
  userId: '104614857372392207989',
  email: 'joonsub2990@gmail.com',
  username: '임준섭',
  profileImage: null,
  statusMessage: '인생은 즐거워!!!',
  createdDate: '2026-09-04T11:45:00',
  status: 'ACTIVE',
  friendCount: 25,
  staff: null,
  ...over,
})

const staffInfo = (over: Partial<members.StaffInfo> = {}): members.StaffInfo => ({
  permissions: ['INTERNAL', 'ADMIN'],
  createdDate: '2026-09-20T01:00:00',
  modifiedDate: '2026-09-24T03:30:00',
  modifiedBy: 'super-user',
  modifiedByName: '최상위',
  ...over,
})

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/members" element={<MembersPage />} />
        <Route path="/members/:id" element={<MemberDetailPage />} />
        <Route path="/staff" element={<StaffPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('internal members', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    setDisplayTimeZone('Asia/Seoul')
    loginAs(['ROLE_INTERNAL'])
  })
  afterEach(() => setDisplayTimeZone(null))

  it('lists members with staff badges, join dates in the display zone, search and the staff-only filter', async () => {
    const search = vi
      .spyOn(members, 'searchMembers')
      .mockResolvedValue(page([member(), member({ id: 1, username: '관리자', email: 'admin@modu.local', userId: 'admin', permissions: ['INTERNAL', 'SUPER'] }), member({ id: 3, username: null, email: 'gone@x.com', status: 'WITHDRAWN' })]))
    renderAt('/members')

    expect(await screen.findByText('임준섭')).toBeInTheDocument()
    // UTC 11:45 → 한국 20:45
    expect(screen.getAllByText('2026-09-04 20:45').length).toBe(3)
    const adminRow = screen.getByText('admin@modu.local').closest('tr')!
    expect(within(adminRow).getByText('직원')).toBeInTheDocument()
    // 권한은 서버 순서와 무관하게 최상위 → 인터널 순서
    expect(within(adminRow).getAllByText(/최상위|인터널/).map((e) => e.textContent)).toEqual(['최상위', '인터널'])
    expect(within(screen.getByText('joonsub2990@gmail.com').closest('tr')!).queryByText('직원')).not.toBeInTheDocument()
    expect(within(screen.getAllByText('gone@x.com')[0].closest('tr')!).getByText('탈퇴')).toBeInTheDocument()
    expect(screen.getByText('3명')).toBeInTheDocument()
    expect(search).toHaveBeenLastCalledWith('', 0, 'name,asc', false)

    await userEvent.type(screen.getByRole('textbox', { name: '회원 검색' }), 'joonsub')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(search).toHaveBeenLastCalledWith('joonsub', 0, 'name,asc', false)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '정렬' }), 'createdDate,desc')
    expect(search).toHaveBeenLastCalledWith('joonsub', 0, 'createdDate,desc', false)

    await userEvent.click(screen.getByRole('checkbox', { name: '직원만' }))
    expect(search).toHaveBeenLastCalledWith('joonsub', 0, 'createdDate,desc', true)
  })

  it('calls api-staff for members and api-super for staff management', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(page([])), { status: 200 }))
    await members.searchMembers('a b', 2, 'email,asc', true)
    expect(fetchMock.mock.calls[0][0]).toBe('/member-service/api-staff/member?keyword=a%20b&sort=email%2Casc&page=2&size=15&staffOnly=true')
    fetchMock.mockResolvedValue(new Response(JSON.stringify(detail()), { status: 200 }))
    await members.getMember('11')
    expect(fetchMock.mock.calls[1][0]).toBe('/member-service/api-staff/member/11')
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await members.removeStaff(11)
    expect(fetchMock.mock.calls[2][0]).toBe('/member-service/api-super/staff/11')
    expect(fetchMock.mock.calls[2][1]?.method).toBe('DELETE')
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))
    await members.listStaff()
    expect(fetchMock.mock.calls[3][0]).toBe('/member-service/api-super/staff')
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    await members.updateStaff(11, ['ADMIN'])
    expect(fetchMock.mock.calls[4][0]).toBe('/member-service/api-super/staff/11')
    expect(fetchMock.mock.calls[4][1]?.method).toBe('PUT')
    expect(fetchMock.mock.calls[4][1]?.body).toBe('{"permissions":["ADMIN"]}')
  })

  it('shows the staff section read-only to a non-SUPER viewer', async () => {
    vi.spyOn(members, 'searchMembers').mockResolvedValue(page([member()]))
    vi.spyOn(members, 'getMember').mockResolvedValue(detail({ staff: staffInfo() }))
    renderAt('/members')

    await userEvent.click(await screen.findByText('임준섭'))
    expect(await screen.findByText('인생은 즐거워!!!')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('104614857372392207989')).toBeInTheDocument()
    const section = screen.getByRole('region', { name: '직원 권한' })
    expect(within(section).getByText('어드민')).toBeInTheDocument()
    expect(within(section).getByText('인터널')).toBeInTheDocument()
    // UTC 03:30 → 한국 12:30, 바꾼 사람 이름
    expect(within(section).getByText(/2026-09-24 12:30 · 최상위/)).toBeInTheDocument()
    expect(within(section).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /저장|직원 해제/ })).not.toBeInTheDocument()
    expect(within(section).getByText('직원 지정·권한 변경은 최상위 관리자만 할 수 있습니다.')).toBeInTheDocument()
  })

  it('lets a SUPER designate a member as staff', async () => {
    loginAs(SUPER_ROLES)
    vi.spyOn(members, 'getMember').mockResolvedValue(detail())
    const update = vi.spyOn(members, 'updateStaff').mockResolvedValue({
      memberId: 11,
      userId: '104614857372392207989',
      username: '임준섭',
      email: 'joonsub2990@gmail.com',
      profileImage: null,
      ...staffInfo({ permissions: ['SUPER'], modifiedByName: '나' }),
    })
    renderAt('/members/11')

    const section = await screen.findByRole('region', { name: '직원 권한' })
    expect(within(section).getByText('직원이 아닙니다.')).toBeInTheDocument()
    const save = within(section).getByRole('button', { name: '저장' })
    expect(save).toBeDisabled()
    expect(within(section).queryByRole('button', { name: '직원 해제' })).not.toBeInTheDocument()

    await userEvent.click(within(section).getByRole('checkbox', { name: /최상위/ }))
    expect(within(section).getByText(/최상위는 모든 콘솔을 포함합니다/)).toBeInTheDocument()
    await userEvent.click(save)
    expect(update).toHaveBeenCalledWith(11, ['SUPER'])
    expect(await within(section).findByText('직원으로 지정했습니다')).toBeInTheDocument()
    expect(within(section).getByText(/2026-09-24 12:30 · 나/)).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: '직원 해제' })).toBeInTheDocument()
  })

  it('shows the server message when a SUPER changes their own permissions', async () => {
    loginAs(SUPER_ROLES)
    vi.spyOn(members, 'getMember').mockResolvedValue(detail({ staff: staffInfo({ permissions: ['SUPER'] }) }))
    vi.spyOn(members, 'updateStaff').mockRejectedValue(
      new ApiError(409, JSON.stringify({ status: 409, error: 'Conflict', message: '자기 자신의 직원 권한은 바꿀 수 없습니다', path: '/api-super/staff/11' })),
    )
    renderAt('/members/11')

    const section = await screen.findByRole('region', { name: '직원 권한' })
    await userEvent.click(within(section).getByRole('checkbox', { name: /시스템/ }))
    await userEvent.click(within(section).getByRole('button', { name: '저장' }))
    expect(await within(section).findByRole('alert')).toHaveTextContent('자기 자신의 직원 권한은 바꿀 수 없습니다')
  })

  it('removes staff only after the in-page confirm', async () => {
    loginAs(SUPER_ROLES)
    vi.spyOn(members, 'getMember').mockResolvedValue(detail({ staff: staffInfo() }))
    const remove = vi.spyOn(members, 'removeStaff').mockResolvedValue(undefined)
    renderAt('/members/11')

    const section = await screen.findByRole('region', { name: '직원 권한' })
    await userEvent.click(within(section).getByRole('button', { name: '직원 해제' }))
    expect(remove).not.toHaveBeenCalled()
    const confirm = within(section).getByRole('group', { name: '직원 해제 확인' })
    await userEvent.click(within(confirm).getByRole('button', { name: '취소' }))
    expect(within(section).queryByRole('group', { name: '직원 해제 확인' })).not.toBeInTheDocument()

    await userEvent.click(within(section).getByRole('button', { name: '직원 해제' }))
    await userEvent.click(within(within(section).getByRole('group', { name: '직원 해제 확인' })).getByRole('button', { name: '해제' }))
    expect(remove).toHaveBeenCalledWith(11)
    expect(await within(section).findByText('직원에서 해제했습니다')).toBeInTheDocument()
    expect(within(section).getByText('직원이 아닙니다.')).toBeInTheDocument()
  })
})

describe('staff page and nav', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    setDisplayTimeZone('UTC')
  })
  afterEach(() => setDisplayTimeZone(null))

  it('shows the 직원 nav entry only to SUPER', () => {
    expect(navSections(false).flatMap((s) => s.links.map((l) => l.to))).toEqual(['/members'])
    expect(navSections(true).flatMap((s) => s.links.map((l) => l.to))).toEqual(['/members', '/staff'])
  })

  it('lists staff with permissions and last change, rows open the member detail', async () => {
    loginAs(SUPER_ROLES)
    vi.spyOn(members, 'listStaff').mockResolvedValue([
      { memberId: 11, userId: 'u11', username: '임준섭', email: 'joonsub2990@gmail.com', profileImage: null, ...staffInfo() },
      { memberId: 1, userId: 'u1', username: null, email: 'root@modu.local', profileImage: null, ...staffInfo({ permissions: ['SUPER'], modifiedBy: null, modifiedByName: null }) },
    ])
    vi.spyOn(members, 'getMember').mockResolvedValue(detail({ staff: staffInfo() }))
    renderAt('/staff')

    const row = (await screen.findByText('joonsub2990@gmail.com')).closest('tr')!
    expect(within(row).getByText('어드민')).toBeInTheDocument()
    expect(within(row).getByText('2026-09-24 03:30')).toBeInTheDocument()
    expect(within(row).getByText('최상위', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getAllByText('root@modu.local', { selector: 'td' })).toHaveLength(2) // 이름이 없으면 이메일

    await userEvent.click(row)
    expect(await screen.findByText('인생은 즐거워!!!')).toBeInTheDocument()
  })

  it('does not load the staff list for a non-SUPER viewer', () => {
    loginAs(['ROLE_INTERNAL'])
    const list = vi.spyOn(members, 'listStaff')
    renderAt('/staff')
    expect(screen.getByText('직원 목록은 최상위 관리자만 볼 수 있습니다')).toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
  })
})
