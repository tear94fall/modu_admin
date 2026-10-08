import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDisplayTimeZone } from '../util/timeZone'
import { clearImageCache } from '../api/imageCache'
import * as rooms from '../api/rooms'
import * as storage from '../api/storage'
import { mockViewport } from '../test/viewport'
import RoomDetailPage from './RoomDetailPage'

const room = {
  id: 1,
  roomId: 'r1',
  roomName: '테스트방',
  lastChatMsg: '이전 대화 요약',
  lastChatTime: '2025-02-08 11:10:33',
  createdDate: '2025-02-01 23:00:00',
  members: [{ id: 11, userId: 'u1', username: '민수', email: 'm@x.y', role: 'ROLE_MEMBER' }],
}

const HASH = 'c5d47a1a1f25b1c224ff67d57afc486352fb7c603350b10c2f27215831a701f5'
const empty = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 15 }
const onePage = (content: rooms.Chat[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 15 })

function renderPage(path = '/rooms/r1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/rooms/:roomId" element={<RoomDetailPage />} />
        <Route path="/rooms" element={<div>채팅방 목록 스텁</div>} />
        <Route path="/members/:id" element={<div>회원 상세 스텁</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RoomDetailPage', () => {
  afterEach(() => setDisplayTimeZone(null))

  beforeEach(() => {
    // 실행하는 기기의 시간대와 무관하게: 표시 시간대를 UTC 로 고정한다.
    setDisplayTimeZone('UTC')
    clearImageCache()
  })

  it('paginates messages via the Pager', async () => {
    vi.spyOn(rooms, 'getRoom').mockResolvedValue(room)
    const getRoomChats = vi.spyOn(rooms, 'getRoomChats').mockImplementation((_roomId, page) =>
      Promise.resolve(
        page === 0
          ? {
              content: [
                { id: 1, sender: 'u1', message: '첫번째 메시지', chatTime: '10:00', chatType: 1 },
                { id: 2, sender: 'u1', message: '두번째 메시지', chatTime: '10:01', chatType: 1 },
              ],
              totalElements: 3,
              totalPages: 2,
              number: 0,
              size: 2,
            }
          : {
              content: [{ id: 3, sender: 'u1', message: '세번째 메시지', chatTime: '10:02', chatType: 1 }],
              totalElements: 3,
              totalPages: 2,
              number: 1,
              size: 2,
            },
      ),
    )
    renderPage()

    expect(await screen.findByText('첫번째 메시지')).toBeInTheDocument()
    expect(screen.getByText('두번째 메시지')).toBeInTheDocument()
    expect(screen.getByText('3개 중 1–2')).toBeInTheDocument()

    // 보낸 사람은 사용자 ID 대신 이름으로 보인다.
    const item = screen.getByText('첫번째 메시지').closest('li') as HTMLElement
    expect(within(item).getByText('민수')).toBeInTheDocument()
    expect(within(item).queryByText('u1')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '다음' }))

    expect(await screen.findByText('세번째 메시지')).toBeInTheDocument()
    expect(getRoomChats).toHaveBeenCalledWith('r1', 1)
    expect(screen.getByText('3개 중 3–3')).toBeInTheDocument()
  })

  it('has a back link to the room list', async () => {
    vi.spyOn(rooms, 'getRoom').mockResolvedValue(room)
    vi.spyOn(rooms, 'getRoomChats').mockResolvedValue(empty)
    renderPage()

    await userEvent.click(await screen.findByRole('link', { name: '← 채팅방 목록' }))
    expect(await screen.findByText('채팅방 목록 스텁')).toBeInTheDocument()
  })

  it('shows the room card: name, member chip, room ID with copy, last message preview', async () => {
    vi.spyOn(rooms, 'getRoom').mockResolvedValue(room)
    vi.spyOn(rooms, 'getRoomChats').mockResolvedValue(empty)
    renderPage()

    const card = await screen.findByRole('complementary', { name: '채팅방 정보' })
    expect(within(card).getByRole('heading', { name: '테스트방' })).toBeInTheDocument()
    expect(within(card).getByText('멤버 1명')).toBeInTheDocument()
    expect(within(card).getByText('r1')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: '채팅방 ID 복사' })).toBeInTheDocument()
    expect(within(card).getByText('이전 대화 요약')).toBeInTheDocument()
    // 채팅방 멤버에는 옛 role(권한) 칸이 없다.
    expect(screen.queryByText('일반 회원')).toBeNull()
  })

  it('labels a two-member room 1:1 and a bigger one 그룹', async () => {
    const other = { id: 12, userId: 'u2', username: '지수', email: 'j@x.y' }
    vi.spyOn(rooms, 'getRoom').mockResolvedValue({ ...room, members: [...room.members, other] })
    vi.spyOn(rooms, 'getRoomChats').mockResolvedValue(empty)
    const { unmount } = renderPage()
    expect(await screen.findByText('1:1')).toBeInTheDocument()
    unmount()

    vi.spyOn(rooms, 'getRoom').mockResolvedValue({
      ...room,
      members: [...room.members, other, { id: 13, userId: 'u3', username: '하나', email: 'h@x.y' }],
    })
    renderPage()
    expect(await screen.findByText('그룹')).toBeInTheDocument()
    expect(screen.getByText('멤버 3명')).toBeInTheDocument()
  })

  it('shows the last message marker as a kind label, not the raw value', async () => {
    vi.spyOn(rooms, 'getRoom').mockResolvedValue({ ...room, lastChatMsg: `${HASH}.jpg` })
    vi.spyOn(rooms, 'getRoomChats').mockResolvedValue(empty)
    renderPage()

    const card = await screen.findByRole('complementary', { name: '채팅방 정보' })
    expect(within(card).getByText('사진')).toBeInTheDocument()
    expect(within(card).queryByText(`${HASH}.jpg`)).toBeNull()
  })

  it('shows the room-name fallback letter when roomImage is empty', async () => {
    vi.spyOn(rooms, 'getRoom').mockResolvedValue(room)
    vi.spyOn(rooms, 'getRoomChats').mockResolvedValue(empty)
    renderPage()

    expect(await screen.findByRole('heading', { name: '테스트방' })).toBeInTheDocument()
    expect(screen.getByText('테')).toBeInTheDocument()
  })

  it('has message and member tabs with counts; messages is the default', async () => {
    vi.spyOn(rooms, 'getRoom').mockResolvedValue(room)
    vi.spyOn(rooms, 'getRoomChats').mockResolvedValue(
      onePage([{ id: 1, sender: 'u1', message: '안녕', chatTime: '2026-09-17 10:00:00', chatType: 1 }]),
    )
    renderPage()

    const messagesTab = await screen.findByRole('tab', { name: '메시지 (1)' })
    expect(messagesTab).toHaveAttribute('aria-selected', 'true')
    const membersTab = screen.getByRole('tab', { name: '멤버 (1)' })
    expect(membersTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('안녕')).toBeInTheDocument()

    await userEvent.click(membersTab)
    expect(screen.getByRole('tab', { name: '멤버 (1)' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('안녕')).toBeNull()
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['이름', '이메일', '사용자 ID'])
  })

  it('renders image, file and audio messages by kind instead of the stored hash name', async () => {
    vi.spyOn(rooms, 'getRoom').mockResolvedValue(room)
    vi.spyOn(rooms, 'getRoomChats').mockResolvedValue(
      onePage([
        { id: 1, sender: 'u1', message: '글 메시지', chatTime: '2026-09-17 10:00:00', chatType: 1 },
        { id: 2, sender: 'u1', message: `${HASH}.jpg`, chatTime: '2026-09-17 10:01:00', chatType: 2 },
        { id: 3, sender: 'u1', message: `${HASH}.pdf`, chatTime: '2026-09-17 10:02:00', chatType: 3 },
        { id: 4, sender: 'u1', message: `${HASH}.m4a`, chatTime: '2026-09-17 10:03:00', chatType: 4 },
        // 옛 데이터: 글 타입인데 본문이 저장 파일 이름
        { id: 5, sender: 'u1', message: `${HASH}.png`, chatTime: '2026-09-17 10:04:00', chatType: 1 },
      ]),
    )
    const fetchImageObjectUrl = vi.spyOn(storage, 'fetchImageObjectUrl').mockResolvedValue('blob:thumb')
    renderPage()

    expect(await screen.findByText('글 메시지')).toBeInTheDocument()
    for (const ext of ['jpg', 'pdf', 'm4a', 'png']) expect(screen.queryByText(`${HASH}.${ext}`)).toBeNull()

    const thumbs = (await screen.findAllByAltText('사진')).filter((el) => el.tagName === 'IMG') as HTMLImageElement[]
    expect(thumbs).toHaveLength(2)
    expect(thumbs[0].src).toBe('blob:thumb')
    expect(fetchImageObjectUrl).toHaveBeenCalledWith(`${HASH}.jpg`)
    expect(fetchImageObjectUrl).toHaveBeenCalledWith(`${HASH}.png`)
    expect(screen.getAllByText('사진')).toHaveLength(2)

    const file = screen.getByText('파일').closest('li') as HTMLElement
    expect(within(file).getByTitle(`${HASH}.pdf`)).toBeInTheDocument()
    expect(within(file).getByText('2026-09-17 10:02')).toBeInTheDocument()
    expect(screen.getByText('음성').closest('[title]')).toHaveAttribute('title', `${HASH}.m4a`)
  })

  it('shows a member avatar image via a blob object URL when profileImage is set', async () => {
    vi.spyOn(rooms, 'getRoom').mockResolvedValue({
      ...room,
      members: [{ ...room.members[0], profileImage: 'a.jpg' }],
    })
    vi.spyOn(rooms, 'getRoomChats').mockResolvedValue(empty)
    const fetchImageObjectUrl = vi.spyOn(storage, 'fetchImageObjectUrl').mockResolvedValue('blob:fake')
    renderPage('/rooms/r1?tab=members')

    const img = (await screen.findAllByAltText('민수')).find((el) => el.tagName === 'IMG') as HTMLImageElement
    expect(img).toBeDefined()
    expect(img.src).toBe('blob:fake')
    expect(fetchImageObjectUrl).toHaveBeenCalledWith('a.jpg')
  })

  it('links a member name to the member detail page', async () => {
    vi.spyOn(rooms, 'getRoom').mockResolvedValue(room)
    vi.spyOn(rooms, 'getRoomChats').mockResolvedValue(empty)
    renderPage('/rooms/r1?tab=members')

    const link = await screen.findByRole('link', { name: /민수/ })
    expect(link).toHaveAttribute('href', '/members/11')
    await userEvent.click(link)
    expect(await screen.findByText('회원 상세 스텁')).toBeInTheDocument()
  })

  it('on a narrow screen shows members as cards and messages as a list, without tables', async () => {
    const restore = mockViewport(true)
    try {
      vi.spyOn(rooms, 'getRoom').mockResolvedValue(room)
      vi.spyOn(rooms, 'getRoomChats').mockResolvedValue(
        onePage([{ id: 1, sender: 'u1', message: '첫번째 메시지', chatTime: '2026-09-17T10:00:00', chatType: 1 }]),
      )
      renderPage()

      const message = await screen.findByText('첫번째 메시지')
      const item = message.closest('li') as HTMLElement
      expect(within(item).getByText('민수')).toBeInTheDocument()
      expect(within(item).getByText('2026-09-17 10:00')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('tab', { name: '멤버 (1)' }))
      const memberCard = await screen.findByRole('button', { name: /민수/ })
      expect(memberCard).toHaveTextContent('m@x.y')
      expect(screen.queryByRole('table')).toBeNull()
      await userEvent.click(memberCard)
      expect(await screen.findByText('회원 상세 스텁')).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('shows the room created time and times in the chosen time zone', async () => {
    setDisplayTimeZone('Asia/Seoul')
    vi.spyOn(rooms, 'getRoom').mockResolvedValue(room)
    vi.spyOn(rooms, 'getRoomChats').mockResolvedValue(empty)
    renderPage()

    // UTC 2025-02-01 23:00 → 한국 02-02 08:00, UTC 02-08 11:10 → 한국 20:10
    expect(await screen.findByText('2025-02-02 08:00')).toBeInTheDocument()
    expect(screen.getByText('2025-02-08 20:10')).toBeInTheDocument()
    expect(screen.getByText(/Asia\/Seoul \(UTC\+9\)/)).toBeInTheDocument()
  })

  it('shows an error inside the messages tab when messages fail to load', async () => {
    vi.spyOn(rooms, 'getRoom').mockResolvedValue(room)
    vi.spyOn(rooms, 'getRoomChats').mockRejectedValue(new Error('boom'))
    renderPage()

    expect(await screen.findByText('메시지를 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '테스트방' })).toBeInTheDocument()
  })
})
