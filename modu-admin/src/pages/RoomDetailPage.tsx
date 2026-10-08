import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getRoom, getRoomChats, type Chat, type RoomDetail } from '../api/rooms'
import { PAGE_SIZE } from '../api/client'
import type { Page } from '../api/members'
import CopyButton from '../components/CopyButton'
import MemberMiniCard from '../components/MemberMiniCard'
import Pager from '../components/Pager'
import RemoteImage from '../components/RemoteImage'
import { useIsMobile } from '../hooks/useIsMobile'
import { CHAT_KIND_LABELS, chatKindOf, lastMessagePreview } from '../util/chatMessage'
import { formatUtcDateTime, timeZoneLabel, useDisplayTimeZone } from '../util/timeZone'

type Tab = 'messages' | 'members'
type RoomMember = RoomDetail['members'][number]

/**
 * 채팅방 상세. 회원 상세와 같은 배치: 왼쪽은 방 정보 카드, 오른쪽은 탭(메시지·멤버).
 * 넓은 화면(1200px~)에서는 2단, 그보다 좁으면 카드 아래로 탭이 쌓인다. 탭은 ?tab=messages|members 로 URL 에 남는다.
 * 시각은 서버 UTC 값을 '내 정보'에서 고른 시간대(기본: 브라우저)로 보여 준다.
 */
export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [params, setParams] = useSearchParams()
  const timeZone = useDisplayTimeZone()
  const [room, setRoom] = useState<RoomDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(0)
  const [chats, setChats] = useState<Page<Chat> | null>(null)
  const [chatsError, setChatsError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getRoom(roomId)
      .then((result) => {
        if (cancelled) return
        setRoom(result)
      })
      .catch(() => {
        if (!cancelled) setError('채팅방 정보를 불러오지 못했습니다')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    let cancelled = false
    setChatsError(null)
    getRoomChats(roomId, page)
      .then((result) => {
        if (cancelled) return
        setChats(result)
      })
      .catch(() => {
        if (!cancelled) setChatsError('메시지를 불러오지 못했습니다')
      })
    return () => {
      cancelled = true
    }
  }, [roomId, page])

  const memberByUserId = useMemo(() => {
    const map = new Map<string, RoomMember>()
    room?.members.forEach((m) => map.set(m.userId, m))
    return map
  }, [room])

  if (loading) return <p>불러오는 중...</p>
  if (error) return <p className="error-text">{error}</p>
  if (!room) return <p>채팅방을 찾을 수 없습니다</p>

  const active: Tab = params.get('tab') === 'members' ? 'members' : 'messages'
  const selectTab = (tab: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', tab)
    setParams(next, { replace: true })
  }
  const labels: Record<Tab, string> = {
    messages: chats ? `메시지 (${chats.totalElements.toLocaleString('ko-KR')})` : '메시지',
    members: `멤버 (${room.members.length.toLocaleString('ko-KR')})`,
  }

  return (
    <div>
      <Link to="/rooms" className="back-link">
        ← 채팅방 목록
      </Link>

      <div className="member-hub">
        <RoomProfilePanel room={room} timeZone={timeZone} />

        <section className="member-hub-main" aria-label="채팅방 내용">
          <div className="member-tabs" role="tablist" aria-label="채팅방">
            {(['messages', 'members'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={`room-tab-${t}`}
                aria-selected={active === t}
                aria-controls={`room-panel-${t}`}
                className={active === t ? 'member-tab active' : 'member-tab'}
                onClick={() => selectTab(t)}
              >
                {labels[t]}
              </button>
            ))}
          </div>
          <div className="member-tab-panel" role="tabpanel" id={`room-panel-${active}`} aria-labelledby={`room-tab-${active}`}>
            {active === 'messages' && (
              <MessagesTab chats={chats} error={chatsError} memberByUserId={memberByUserId} timeZone={timeZone} onPage={setPage} />
            )}
            {active === 'members' && <MembersTab members={room.members} />}
          </div>
        </section>
      </div>
    </div>
  )
}

/** 왼쪽 방 정보 카드: 배경(방 이미지)·아바타·이름·칩, 기본 정보, 마지막 메시지. */
function RoomProfilePanel({ room, timeZone }: { room: RoomDetail; timeZone: string }) {
  const memberCount = room.members.length
  const preview = lastMessagePreview(room.lastChatMsg)
  const initial = <div className="avatar avatar-placeholder member-profile-avatar">{room.roomName.charAt(0)}</div>
  return (
    <aside className="member-profile member-hub-header room-profile" aria-label="채팅방 정보">
      {room.roomImage ? (
        <RemoteImage
          filename={room.roomImage}
          alt={`${room.roomName} 배경 이미지`}
          className="member-profile-cover"
          fallback={<div className="member-profile-cover member-profile-cover--empty" />}
        />
      ) : (
        <div className="member-profile-cover member-profile-cover--empty" />
      )}

      <div className="member-profile-head">
        {room.roomImage ? (
          <RemoteImage filename={room.roomImage} alt={room.roomName} className="avatar member-profile-avatar" fallback={initial} />
        ) : (
          initial
        )}
        <div className="member-profile-name">
          <h1 className="profile-username">{room.roomName}</h1>
        </div>
        <span className="service-badges room-profile-chips">
          <span className="tier-badge service-badge">멤버 {memberCount.toLocaleString('ko-KR')}명</span>
          {memberCount === 2 && <span className="tier-badge service-badge">1:1</span>}
          {memberCount > 2 && <span className="tier-badge service-badge">그룹</span>}
        </span>
      </div>

      <dl className="member-profile-facts">
        <dt>채팅방 ID</dt>
        <dd className="member-profile-id">
          <code>{room.roomId}</code>
          <CopyButton text={room.roomId} label="채팅방 ID 복사" />
        </dd>
        <dt>생성</dt>
        <dd>{formatUtcDateTime(room.createdDate, timeZone) || '-'}</dd>
        <dt>최근 대화</dt>
        <dd>{formatUtcDateTime(room.lastChatTime, timeZone) || '-'}</dd>
        <dd className="card-muted room-profile-tz">{timeZoneLabel(timeZone)} · 내 정보에서 바꿀 수 있습니다</dd>
      </dl>

      <div className="member-profile-section">
        <h2 className="member-profile-section-title">마지막 메시지</h2>
        <p className={preview ? 'room-profile-last' : 'room-profile-last card-muted'} title={preview || undefined}>
          {preview || '-'}
        </p>
      </div>
    </aside>
  )
}

interface MessagesTabProps {
  chats: Page<Chat> | null
  error: string | null
  memberByUserId: Map<string, RoomMember>
  timeZone: string
  onPage: (page: number) => void
}

/** 메시지 탭: 보낸 사람(아바타·이름), 종류별 본문, 시각. 아래 "N개 중 a–b" 와 페이저. */
function MessagesTab({ chats, error, memberByUserId, timeZone, onPage }: MessagesTabProps) {
  if (error) return <p className="error-text sub-card-empty">{error}</p>
  if (!chats) return <p className="card-muted sub-card-empty">불러오는 중...</p>
  if (chats.totalElements === 0) return <p className="card-muted sub-card-empty">메시지가 없습니다</p>

  const size = chats.size || PAGE_SIZE
  const from = chats.number * size + 1
  const to = chats.number * size + chats.content.length
  return (
    <section className="sub-card" aria-label="메시지 목록">
      <ul className="room-messages">
        {chats.content.map((c) => {
          const sender = memberByUserId.get(c.sender)
          const name = sender?.username ?? c.sender
          return (
            <li key={c.id} className="room-message">
              <RemoteImage filename={sender?.profileImage} alt={name} className="avatar avatar--sm" />
              <div className="room-message-main">
                <span className="room-message-sender">{name}</span>
                <MessageBody chat={c} />
              </div>
              <span className="room-message-time card-muted">{formatUtcDateTime(c.chatTime, timeZone)}</span>
            </li>
          )
        })}
      </ul>
      <div className="friends-footer">
        <span className="card-muted friends-range">
          {chats.totalElements.toLocaleString('ko-KR')}개 중 {from}–{to}
        </span>
        <Pager page={chats.number} totalPages={chats.totalPages} onChange={onPage} />
      </div>
    </section>
  )
}

/** 본문을 종류별로: 글은 그대로, 사진은 썸네일 + "사진", 파일·음성은 아이콘 + 이름. 저장 파일 이름은 title 로만 남긴다. */
function MessageBody({ chat }: { chat: Chat }) {
  const kind = chatKindOf(chat.chatType, chat.message)
  if (kind === 'text') return <span className="room-message-text">{chat.message}</span>
  const label = CHAT_KIND_LABELS[kind]
  return (
    <span className={`room-message-attachment room-message-attachment--${kind}`} title={chat.message}>
      {kind === 'image' ? (
        <RemoteImage
          filename={chat.message}
          alt={label}
          className="room-message-thumb"
          fallback={<span className="room-message-thumb room-message-thumb--empty" aria-hidden="true" />}
        />
      ) : (
        <AttachmentIcon kind={kind} />
      )}
      <span className="room-message-kind">{label}</span>
    </span>
  )
}

function AttachmentIcon({ kind }: { kind: 'file' | 'audio' }) {
  return (
    <span className="room-message-icon" aria-hidden="true">
      {kind === 'file' ? (
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path d="M4 1.75h5.2L12.5 5v9.25H4z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M9 1.9V5.2h3.3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="16" height="16">
          <rect x="5.75" y="1.75" width="4.5" height="8" rx="2.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.25" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}

/** 멤버 탭: 넓으면 표(이름 → 회원 상세 링크, 이메일, 사용자 ID), 폰이면 카드. */
function MembersTab({ members }: { members: RoomMember[] }) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  if (members.length === 0) return <p className="card-muted sub-card-empty">멤버가 없습니다</p>
  return (
    <section className="sub-card" aria-label="멤버 목록">
      {isMobile ? (
        <ul className="card-list">
          {members.map((m) => (
            <li key={m.userId}>
              <MemberMiniCard member={m} onClick={() => navigate(`/members/${m.id}`)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="table-scroll">
          <table className="sub-card-table room-members-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>이메일</th>
                <th>사용자 ID</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId}>
                  <td>
                    <Link to={`/members/${m.id}`} className="friend-name-cell room-member-link">
                      <RemoteImage filename={m.profileImage} alt={m.username} className="avatar avatar--sm" />
                      <span>{m.username}</span>
                    </Link>
                  </td>
                  <td className="nowrap">{m.email}</td>
                  <td className="nowrap">{m.userId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
