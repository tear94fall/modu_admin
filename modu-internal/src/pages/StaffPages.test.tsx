import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, setDisplayTimeZone } from '@modu/console-core'
import * as members from '../api/members'
import { navSections } from '../nav'
import { loginAs, SUPER_ROLES } from '../test/jwt'
import StaffAddPage from './StaffAddPage'
import StaffDetailPage from './StaffDetailPage'
import StaffPage from './StaffPage'

const staffInfo = (over: Partial<members.StaffInfo> = {}): members.StaffInfo => ({
  permissions: ['INTERNAL', 'ADMIN'],
  createdDate: '2026-09-20T01:00:00',
  modifiedDate: '2026-09-24T03:30:00',
  modifiedBy: 'super-user',
  modifiedByName: '최상위',
  ...over,
})

const entry = (info: Partial<members.StaffInfo> = {}, over: Partial<members.StaffEntry> = {}): members.StaffEntry => ({
  memberId: 11,
  userId: '104614857372392207989',
  username: '임준섭',
  email: 'joonsub2990@gmail.com',
  profileImage: null,
  ...staffInfo(info),
  ...over,
})

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

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}</p>
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/staff/new" element={<StaffAddPage />} />
        <Route path="/staff/:id" element={<StaffDetailPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
const location = () => screen.getByTestId('location').textContent

describe('staff console', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    setDisplayTimeZone('Asia/Seoul')
    loginAs(['ROLE_INTERNAL'])
  })
  afterEach(() => setDisplayTimeZone(null))

  it('has only the 직원 menu, for everyone', () => {
    expect(navSections().flatMap((s) => s.links.map((l) => l.to))).toEqual(['/staff'])
  })

  it('calls api-staff to read staff and api-super to find members and manage staff', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }))
    await members.listStaff()
    expect(fetchMock.mock.calls[0][0]).toBe('/member-service/api-staff/staff')
    fetchMock.mockResolvedValue(new Response(JSON.stringify(entry()), { status: 200 }))
    await members.getStaff('11')
    expect(fetchMock.mock.calls[1][0]).toBe('/member-service/api-staff/staff/11')
    fetchMock.mockResolvedValue(new Response(JSON.stringify(page([])), { status: 200 }))
    await members.searchMembers('a b', 2)
    expect(fetchMock.mock.calls[2][0]).toBe('/member-service/api-super/member?keyword=a%20b&sort=name%2Casc&page=2&size=15')
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await members.removeStaff(11)
    expect(fetchMock.mock.calls[3][0]).toBe('/member-service/api-super/staff/11')
    expect(fetchMock.mock.calls[3][1]?.method).toBe('DELETE')
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    await members.updateStaff(11, ['ADMIN'])
    expect(fetchMock.mock.calls[4][0]).toBe('/member-service/api-super/staff/11')
    expect(fetchMock.mock.calls[4][1]?.method).toBe('PUT')
    expect(fetchMock.mock.calls[4][1]?.body).toBe('{"permissions":["ADMIN"]}')
  })

  it('lists staff for an INTERNAL viewer without the add button, and a row opens the read-only staff detail', async () => {
    vi.spyOn(members, 'listStaff').mockResolvedValue([
      entry(),
      entry({ permissions: ['SUPER'], modifiedBy: null, modifiedByName: null }, { memberId: 1, userId: 'u1', username: null, email: 'root@modu.local' }),
    ])
    vi.spyOn(members, 'getStaff').mockResolvedValue(entry())
    renderAt('/staff')

    const row = (await screen.findByText('joonsub2990@gmail.com')).closest('tr')!
    expect(within(row).getByText('어드민')).toBeInTheDocument()
    // UTC 03:30 → 한국 12:30
    expect(within(row).getByText('2026-09-24 12:30')).toBeInTheDocument()
    expect(within(row).getByText('최상위', { selector: 'td' })).toBeInTheDocument()
    // 이름이 없으면 이메일
    const rootRow = screen.getByText('root@modu.local', { selector: 'td' }).closest('tr')!
    expect(within(rootRow).getByText('root@modu.local', { selector: '.int-name' })).toBeInTheDocument()
    expect(screen.getByText('2명')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '직원 추가' })).not.toBeInTheDocument()

    await userEvent.click(row)
    expect(location()).toBe('/staff/11')
    expect(await screen.findByText('104614857372392207989')).toBeInTheDocument()
    const section = screen.getByRole('region', { name: '직원 권한' })
    expect(within(section).getByText('어드민')).toBeInTheDocument()
    expect(within(section).getByText('인터널')).toBeInTheDocument()
    expect(within(section).getByText(/2026-09-24 12:30 · 최상위/)).toBeInTheDocument()
    expect(within(section).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /저장|직원 해제/ })).not.toBeInTheDocument()
    expect(within(section).getByText('직원 지정·권한 변경은 최상위 관리자만 할 수 있습니다.')).toBeInTheDocument()
  })

  it('shows 404 as "직원이 아닙니다" on the detail', async () => {
    vi.spyOn(members, 'getStaff').mockRejectedValue(new ApiError(404, '{}'))
    renderAt('/staff/99')
    expect(await screen.findByText('직원이 아닙니다')).toBeInTheDocument()
  })

  it('lets a SUPER find a member and designate them as staff, then lands on the staff detail', async () => {
    loginAs(SUPER_ROLES)
    vi.spyOn(members, 'listStaff').mockResolvedValue([])
    const search = vi.spyOn(members, 'searchMembers').mockResolvedValue(page([member(), member({ id: 3, username: null, email: 'gone@x.com', status: 'WITHDRAWN' }), member({ id: 1, username: '관리자', email: 'admin@modu.local', permissions: ['SUPER'] })]))
    const update = vi.spyOn(members, 'updateStaff').mockResolvedValue(entry({ permissions: ['INTERNAL'], modifiedByName: '나' }))
    vi.spyOn(members, 'getStaff').mockResolvedValue(entry({ permissions: ['INTERNAL'], modifiedByName: '나' }))
    renderAt('/staff')

    await userEvent.click(await screen.findByRole('link', { name: '직원 추가' }))
    expect(location()).toBe('/staff/new')
    await userEvent.type(screen.getByRole('textbox', { name: '회원 검색' }), 'joonsub')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(search).toHaveBeenLastCalledWith('joonsub', 0)
    const adminRow = (await screen.findByText('admin@modu.local')).closest('li, tr') as HTMLElement
    expect(within(adminRow).getByText('최상위')).toBeInTheDocument()   // 이미 직원이면 권한이 보인다
    expect(within(screen.getAllByText('gone@x.com')[0].closest('li, tr') as HTMLElement).getByText('탈퇴')).toBeInTheDocument()

    await userEvent.click(screen.getByText('임준섭'))
    const section = await screen.findByRole('region', { name: '직원 권한' })
    expect(within(section).getByText('직원이 아닙니다.')).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('checkbox', { name: /인터널/ }))
    await userEvent.click(within(section).getByRole('button', { name: '저장' }))
    const dialog = screen.getByRole('dialog', { name: '직원 지정' })
    await userEvent.click(within(dialog).getByRole('button', { name: '직원으로 지정' }))
    expect(update).toHaveBeenCalledWith(11, ['INTERNAL'])
    expect(await screen.findByText(/2026-09-24 12:30 · 나/)).toBeInTheDocument()
    expect(location()).toBe('/staff/11')
  })

  it('cannot save permissions for a withdrawn member picked on the add page', async () => {
    loginAs(SUPER_ROLES)
    vi.spyOn(members, 'searchMembers').mockResolvedValue(page([member({ id: 3, username: null, email: 'gone@x.com', status: 'WITHDRAWN' })]))
    renderAt('/staff/new')
    await userEvent.type(screen.getByRole('textbox', { name: '회원 검색' }), 'gone')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    await userEvent.click((await screen.findAllByText('gone@x.com'))[0])
    const section = await screen.findByRole('region', { name: '직원 권한' })
    expect(within(section).getByText('탈퇴한 회원은 직원으로 지정할 수 없습니다.')).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('checkbox', { name: /인터널/ }))
    expect(within(section).getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('does not offer the add page to a non-SUPER viewer', async () => {
    renderAt('/staff/new')
    expect(await screen.findByText('직원 지정은 최상위 관리자만 할 수 있습니다')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '회원 검색' })).not.toBeInTheDocument()
  })

  it('shows the server message when a SUPER changes their own permissions', async () => {
    loginAs(SUPER_ROLES)
    vi.spyOn(members, 'getStaff').mockResolvedValue(entry({ permissions: ['SUPER'] }))
    vi.spyOn(members, 'updateStaff').mockRejectedValue(
      new ApiError(409, JSON.stringify({ status: 409, error: 'Conflict', message: '자기 자신의 직원 권한은 바꿀 수 없습니다', path: '/api-super/staff/11' })),
    )
    renderAt('/staff/11')

    const section = await screen.findByRole('region', { name: '직원 권한' })
    await userEvent.click(within(section).getByRole('checkbox', { name: /시스템/ }))
    await userEvent.click(within(section).getByRole('button', { name: '저장' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: '직원 권한 저장' })).getByRole('button', { name: '권한 저장' }))
    expect(await within(section).findByRole('alert')).toHaveTextContent('자기 자신의 직원 권한은 바꿀 수 없습니다')
  })

  it('removes staff only after the danger confirm dialog', async () => {
    loginAs(SUPER_ROLES)
    vi.spyOn(members, 'getStaff').mockResolvedValue(entry())
    const remove = vi.spyOn(members, 'removeStaff').mockResolvedValue(undefined)
    renderAt('/staff/11')

    const section = await screen.findByRole('region', { name: '직원 권한' })
    await userEvent.click(within(section).getByRole('button', { name: '직원 해제' }))
    expect(remove).not.toHaveBeenCalled()
    let dialog = screen.getByRole('dialog', { name: '직원 해제' })
    expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus()
    expect(within(dialog).getByText('임준섭')).toBeInTheDocument()
    expect(within(dialog).getByText(/어드민/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(within(section).getByRole('button', { name: '직원 해제' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()

    await userEvent.click(within(section).getByRole('button', { name: '직원 해제' }))
    dialog = screen.getByRole('dialog', { name: '직원 해제' })
    await userEvent.click(within(dialog).getByRole('button', { name: '직원 해제' }))
    expect(remove).toHaveBeenCalledWith(11)
    expect(await within(section).findByText('직원에서 해제했습니다')).toBeInTheDocument()
    expect(within(section).getByText('직원이 아닙니다.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← 직원 목록' })).toBeInTheDocument()
  })

  it('confirms a permission change with a before → after diff; cancel and Esc never call the API', async () => {
    loginAs(SUPER_ROLES)
    vi.spyOn(members, 'getStaff').mockResolvedValue(entry())
    const update = vi.spyOn(members, 'updateStaff').mockResolvedValue(entry({ permissions: ['ADMIN', 'SYSTEM'], modifiedByName: '나' }))
    renderAt('/staff/11')

    const section = await screen.findByRole('region', { name: '직원 권한' })
    const save = within(section).getByRole('button', { name: '저장' })
    expect(save).toBeDisabled()
    await userEvent.click(within(section).getByRole('checkbox', { name: /인터널/ }))
    await userEvent.click(within(section).getByRole('checkbox', { name: /시스템/ }))
    expect(within(section).getByText('변경 사항 있음')).toBeInTheDocument()

    await userEvent.click(save)
    let dialog = screen.getByRole('dialog', { name: '직원 권한 저장' })
    const added = within(dialog).getByText('추가될 권한').nextElementSibling as HTMLElement
    const removed = within(dialog).getByText('빠질 권한').nextElementSibling as HTMLElement
    expect(added).toHaveTextContent('+ 시스템')
    expect(removed).toHaveTextContent('− 인터널')
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    await userEvent.click(save)
    await userEvent.keyboard('{Escape}')
    expect(update).not.toHaveBeenCalled()

    await userEvent.click(save)
    dialog = screen.getByRole('dialog', { name: '직원 권한 저장' })
    await userEvent.dblClick(within(dialog).getByRole('button', { name: '권한 저장' }))
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(11, ['ADMIN', 'SYSTEM'])
    expect(await within(section).findByText('직원 권한을 저장했습니다')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: '저장' })).toBeDisabled()
  })
})
