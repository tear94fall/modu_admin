import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as points from '../api/points'
import { mockViewport } from '../test/viewport'
import PointsPage from './PointsPage'

const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 15 }

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/points']}>
      <Routes>
        <Route path="/points" element={<PointsPage />} />
        <Route path="/points/:userId" element={<p>상세 페이지</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('PointsPage', () => {
  let restore: () => void
  beforeEach(() => {
    vi.restoreAllMocks()
    restore = mockViewport(false)
    vi.spyOn(points, 'listRules').mockResolvedValue([])
  })
  afterEach(() => restore())

  it('lists accounts by name and email (never the raw userId) and opens the account on click', async () => {
    vi.spyOn(points, 'searchAccounts').mockResolvedValue({
      ...emptyPage,
      content: [
        {
          userId: 'google-sub-1',
          username: '임준섭',
          email: 'joon@example.com',
          balance: 1234,
          createdDate: '2026-09-23T09:00:00',
          updatedDate: '2026-09-23T10:30:00',
        },
      ],
      totalElements: 1,
      totalPages: 1,
    })
    renderPage()

    expect(await screen.findByText('1,234 P')).toBeInTheDocument()
    expect(screen.getByText('joon@example.com')).toBeInTheDocument()
    expect(screen.getByText('2026-09-23 10:30')).toBeInTheDocument()
    expect(screen.queryByText('google-sub-1')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('임준섭'))
    expect(await screen.findByText('상세 페이지')).toBeInTheDocument()
  })

  it('shows a placeholder when member-service could not supply a name', async () => {
    vi.spyOn(points, 'searchAccounts').mockResolvedValue({
      ...emptyPage,
      content: [{ userId: 'google-sub-2', username: null, email: null, balance: 10 }],
      totalElements: 1,
      totalPages: 1,
    })
    renderPage()
    expect(await screen.findByText('(이름 없음)')).toBeInTheDocument()
  })

  it('searches by userId keyword from page 0', async () => {
    const search = vi.spyOn(points, 'searchAccounts').mockResolvedValue(emptyPage)
    renderPage()
    await screen.findByText('포인트가 있는 사용자가 아직 없습니다')

    await userEvent.type(screen.getByPlaceholderText('이름/이메일 검색'), '준섭')
    await userEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => expect(search).toHaveBeenLastCalledWith('준섭', 0))
  })

  it('shows rules and saves one row with blank limits sent as null', async () => {
    vi.spyOn(points, 'searchAccounts').mockResolvedValue(emptyPage)
    vi.spyOn(points, 'listRules').mockResolvedValue([
      { code: 'DAILY_CHECKIN', name: '출석 체크', points: 10, dailyLimit: 1, totalLimit: null, enabled: true },
      { code: 'SIGNUP', name: '가입 축하', points: 100, dailyLimit: null, totalLimit: 1, enabled: false },
    ])
    const update = vi.spyOn(points, 'updateRule').mockImplementation(async (code, body) => ({ code, ...body }))
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '적립 규칙' }))
    expect(await screen.findByText('DAILY_CHECKIN')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /SIGNUP 꺼짐/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /DAILY_CHECKIN 사용 중/ })).toBeInTheDocument()

    // 줄의 "수정" 을 누르면 그 자리에 편집 폼이 열린다.
    const checkinRow = screen.getByText('DAILY_CHECKIN').closest('tr')!
    await userEvent.click(within(checkinRow).getByRole('button', { name: '수정' }))
    const form = await screen.findByRole('form', { name: '규칙 DAILY_CHECKIN' })
    const pointsInput = form.querySelector<HTMLInputElement>('#rule-DAILY_CHECKIN-points')!
    await userEvent.clear(pointsInput)
    await userEvent.type(pointsInput, '15')
    await userEvent.clear(form.querySelector<HTMLInputElement>('#rule-DAILY_CHECKIN-daily')!)
    await userEvent.click(form.querySelector<HTMLButtonElement>('button[type="submit"]')!)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('DAILY_CHECKIN', {
        name: '출석 체크',
        points: 15,
        dailyLimit: null,
        totalLimit: null,
        enabled: true,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('form', { name: '규칙 DAILY_CHECKIN' })).toBeNull())
    expect(screen.getByText('15 P')).toBeInTheDocument()
  })

  it('toggles a rule on and off from the status pill', async () => {
    vi.spyOn(points, 'searchAccounts').mockResolvedValue(emptyPage)
    vi.spyOn(points, 'listRules').mockResolvedValue([
      { code: 'SIGNUP', name: '가입 축하', points: 100, dailyLimit: null, totalLimit: 1, enabled: true },
    ])
    const update = vi.spyOn(points, 'updateRule').mockImplementation(async (code, body) => ({ code, ...body }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '적립 규칙' }))
    await userEvent.click(await screen.findByRole('button', { name: /SIGNUP 사용 중/ }))
    await waitFor(() => expect(update).toHaveBeenCalledWith('SIGNUP', { name: '가입 축하', points: 100, dailyLimit: null, totalLimit: 1, enabled: false }))
    expect(await screen.findByRole('button', { name: /SIGNUP 꺼짐/ })).toBeInTheDocument()
  })

  it('adds a rule with an upper-cased code and removes one after confirming', async () => {
    vi.spyOn(points, 'searchAccounts').mockResolvedValue(emptyPage)
    vi.spyOn(points, 'listRules').mockResolvedValue([
      { code: 'DAILY_CHECKIN', name: '출석 체크', points: 10, dailyLimit: 1, totalLimit: null, enabled: true },
      { code: 'SIGNUP', name: '가입 축하', points: 100, dailyLimit: null, totalLimit: 1, enabled: true },
    ])
    const create = vi.spyOn(points, 'createRule').mockImplementation(async (body) => body)
    const remove = vi.spyOn(points, 'deleteRule').mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '적립 규칙' }))
    await userEvent.click(await screen.findByRole('button', { name: '+ 규칙 추가' }))
    const form = await screen.findByRole('form', { name: '새 규칙' })
    await userEvent.type(form.querySelector<HTMLInputElement>('#new-rule-code')!, 'review_write')
    await userEvent.type(form.querySelector<HTMLInputElement>('#new-rule-name')!, '리뷰 작성')
    await userEvent.type(form.querySelector<HTMLInputElement>('#new-rule-points')!, '5')
    await userEvent.type(form.querySelector<HTMLInputElement>('#new-rule-daily')!, '3')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ code: 'REVIEW_WRITE', name: '리뷰 작성', points: 5, dailyLimit: 3, totalLimit: null, enabled: true }),
    )
    expect(await screen.findByText('REVIEW_WRITE')).toBeInTheDocument()
    expect(screen.getByText('REVIEW_WRITE 규칙을 추가했습니다')).toBeInTheDocument()

    // 출석 규칙 줄에는 삭제 버튼이 없고, 다른 규칙은 확인 뒤 지워진다.
    expect(within(screen.getByText('DAILY_CHECKIN').closest('tr')!).queryByRole('button', { name: '삭제' })).toBeNull()
    await userEvent.click(within(screen.getByText('SIGNUP').closest('tr')!).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('SIGNUP'))
    await waitFor(() => expect(screen.queryByText('SIGNUP')).toBeNull())
  })

  it('rejects a malformed rule code before calling the server', async () => {
    vi.spyOn(points, 'searchAccounts').mockResolvedValue(emptyPage)
    const create = vi.spyOn(points, 'createRule')
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '적립 규칙' }))
    await userEvent.click(await screen.findByRole('button', { name: '+ 규칙 추가' }))
    const form = await screen.findByRole('form', { name: '새 규칙' })
    await userEvent.type(form.querySelector<HTMLInputElement>('#new-rule-code')!, '1bad code')
    await userEvent.type(form.querySelector<HTMLInputElement>('#new-rule-name')!, 'x')
    await userEvent.type(form.querySelector<HTMLInputElement>('#new-rule-points')!, '1')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(await screen.findByText(/코드는 대문자로 시작하는/)).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })
})
