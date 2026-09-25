import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDisplayTimeZone } from '@modu/console-core'
import * as members from '../api/members'
import MemberDetailPage from './MemberDetailPage'
import MembersPage from './MembersPage'

const member = (over: Partial<members.Member> = {}): members.Member => ({
  id: 11,
  userId: '104614857372392207989',
  email: 'joonsub2990@gmail.com',
  username: '임준섭',
  role: 'ROLE_MEMBER',
  createdDate: '2026-09-04T11:45:00',
  ...over,
})
const page = (content: members.Member[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 15 })

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/members" element={<MembersPage />} />
        <Route path="/members/:id" element={<MemberDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('internal members', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setDisplayTimeZone('Asia/Seoul')
  })
  afterEach(() => setDisplayTimeZone(null))

  it('lists members with join dates in the display zone and searches by keyword', async () => {
    const search = vi.spyOn(members, 'searchMembers').mockResolvedValue(page([member(), member({ id: 1, username: '관리자', email: 'admin@modu.local', userId: 'admin', role: 'ROLE_ADMIN' })]))
    renderAt('/members')

    expect(await screen.findByText('임준섭')).toBeInTheDocument()
    // UTC 11:45 → 한국 20:45
    expect(screen.getAllByText('2026-09-04 20:45').length).toBe(2)
    expect(screen.getAllByText('관리자', { selector: 'td' })).toHaveLength(2) // 이름이 '관리자'인 회원의 이름 칸과 구분 칸
    expect(screen.getByText('2명')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: '회원 검색' }), 'joonsub')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))
    expect(search).toHaveBeenLastCalledWith('joonsub', 0, 'name,asc')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '정렬' }), 'createdDate,desc')
    expect(search).toHaveBeenLastCalledWith('joonsub', 0, 'createdDate,desc')
  })

  it('opens a read-only member detail', async () => {
    vi.spyOn(members, 'searchMembers').mockResolvedValue(page([member()]))
    vi.spyOn(members, 'getMember').mockResolvedValue({ member: member({ statusMessage: '인생은 즐거워!!!' }), friendCount: 25, createdDate: '2026-09-04T11:45:00' })
    renderAt('/members')

    await userEvent.click(await screen.findByText('임준섭'))
    expect(await screen.findByText('인생은 즐거워!!!')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('104614857372392207989')).toBeInTheDocument()
    expect(screen.getByText(/Asia\/Seoul \(UTC\+9\)/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /수정|저장/ })).not.toBeInTheDocument()
  })
})
