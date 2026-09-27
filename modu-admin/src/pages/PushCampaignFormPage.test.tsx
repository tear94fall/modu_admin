import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as push from '../api/pushCampaigns'
import PushCampaignFormPage from './PushCampaignFormPage'

const campaign: push.AdminPushCampaign = {
  id: 7,
  title: '가을 특가',
  body: '다이어리 30% 할인',
  imageUrl: null,
  targetType: 'PRODUCT',
  targetId: 3,
  targetLabel: '가을 다이어리',
  path: '/products/3',
  status: 'SENT',
  scheduledAt: '2026-09-27T01:00:00',
  sentAt: '2026-09-27T01:00:05',
  canceledAt: null,
  nightApplied: false,
  targetUsers: 10,
  targetDevices: 12,
  successCount: 11,
  failureCount: 1,
  removedTokens: 1,
  openedCount: 3,
  createdBy: 'admin',
  createdAt: '2026-09-27T00:50:00',
  failureMessage: null,
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/push-campaigns/new" element={<PushCampaignFormPage />} />
        <Route path="/push-campaigns/:id" element={<p>상세 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('PushCampaignFormPage', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('previews with the ad prefix and opt-out line, confirms send-now in page and opens the detail', async () => {
    vi.spyOn(push, 'getPushAudience').mockResolvedValue({ night: false, users: 120, devices: 150, consentedUsers: 120, nightUsers: 40 })
    const create = vi.spyOn(push, 'createPushCampaign').mockResolvedValue({ ...campaign, id: 9, targetType: 'HOME' })
    renderAt('/push-campaigns/new')

    await userEvent.type(screen.getByLabelText('제목'), '주말 특가')
    await userEvent.type(screen.getByLabelText('내용'), '지금 보러 가기')
    expect(screen.getByText('5/40')).toBeInTheDocument()
    const preview = screen.getByTestId('push-preview')
    expect(preview).toHaveTextContent('모두의 커머스')
    expect(preview).toHaveTextContent('(광고) 주말 특가')
    expect(preview).toHaveTextContent('수신거부: 마이페이지 > 알림 설정')

    await userEvent.click(screen.getByRole('button', { name: '홈' }))
    expect(await screen.findByText('알림 동의 120명 · 기기 150대')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '보내기' }))
    expect(create).not.toHaveBeenCalled()
    expect(screen.getByText('알림 동의 120명에게 지금 보냅니다')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '보내기 확인' }))
    expect(create).toHaveBeenCalledWith({ title: '주말 특가', body: '지금 보러 가기', imageUrl: null, targetType: 'HOME', targetId: null, scheduledAt: null })
    expect(await screen.findByText('상세 화면')).toBeInTheDocument()
  })

  it('prefills from ?copy= and warns about night sends when scheduled', async () => {
    vi.spyOn(push, 'getPushCampaign').mockResolvedValue(campaign)
    const audience = vi.spyOn(push, 'getPushAudience').mockResolvedValue({ night: true, users: 40, devices: 44, consentedUsers: 120, nightUsers: 40 })
    renderAt('/push-campaigns/new?copy=7')

    expect(await screen.findByDisplayValue('가을 특가')).toBeInTheDocument()
    expect(screen.getByText('가을 다이어리')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '예약' }))
    await userEvent.selectOptions(screen.getByLabelText('시'), '22')
    expect(await screen.findByText('야간(21시~08시) 발송이라 야간 수신 동의자 40명(기기 44대)에게만 발송됩니다')).toBeInTheDocument()
    expect(audience).toHaveBeenLastCalledWith(expect.stringMatching(/T22:\d0:00\+09:00$/))
  })

  it('shows the server message when creating fails', async () => {
    vi.spyOn(push, 'getPushAudience').mockResolvedValue({ night: false, users: 1, devices: 1, consentedUsers: 1, nightUsers: 0 })
    vi.spyOn(push, 'createPushCampaign').mockRejectedValue(new (await import('../api/client')).ApiError(400, '{"message":"판매 중인 상품이 아닙니다"}'))
    renderAt('/push-campaigns/new')
    await userEvent.type(screen.getByLabelText('제목'), '특가')
    await userEvent.type(screen.getByLabelText('내용'), '보러 가기')
    await userEvent.click(screen.getByRole('button', { name: '쿠폰함' }))
    await userEvent.click(screen.getByRole('button', { name: '보내기' }))
    await userEvent.click(screen.getByRole('button', { name: '보내기 확인' }))
    expect(await screen.findByText('판매 중인 상품이 아닙니다')).toBeInTheDocument()
  })
})
