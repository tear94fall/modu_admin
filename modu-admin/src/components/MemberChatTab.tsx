import { type ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type AdminFriend, type FriendCounts, type FriendFilter, type FriendPage, FRIEND_PAGE_SIZE, getMemberFriends, type Member } from '../api/members'
import { useIsMobile } from '../hooks/useIsMobile'
import MemberMiniCard from './MemberMiniCard'
import Pager from './Pager'
import RemoteImage from './RemoteImage'
import StaffBadges from './StaffBadges'

interface Props {
  member: Member
  /** 회원 상세 응답의 친구 수. 친구 목록을 읽기 전·못 읽었을 때만 쓴다. */
  friendCount: number
}

const FILTERS: { value: FriendFilter; label: string; count: keyof FriendCounts; empty: string }[] = [
  { value: 'ALL', label: '전체', count: 'all', empty: '친구가 없어요' },
  { value: 'NORMAL', label: '일반', count: 'normal', empty: '친구가 없어요' },
  { value: 'FAVORITE', label: '즐겨찾기', count: 'favorite', empty: '즐겨찾기한 친구가 없어요' },
  { value: 'HIDDEN', label: '숨김', count: 'hidden', empty: '숨긴 친구가 없어요' },
  { value: 'BLOCKED', label: '차단', count: 'blocked', empty: '차단한 친구가 없어요' },
]

/** 어느 요청(회원·필터·페이지)의 결과인지 key 로 남긴다. 지금 key 와 다르면 읽는 중이다. */
type FriendsResult = { key: string } & ({ kind: 'error' } | { kind: 'ok'; page: FriendPage })
type FriendsState = { kind: 'loading' } | FriendsResult

/**
 * 회원 상세의 채팅 탭: 친구 수·상태 메시지, 친구 목록(필터·페이지), 맨 아래 접힌 파일 정보.
 * 친구 목록은 이 탭이 보일 때 따로 읽는다. 실패해도 친구 카드 안에만 안내가 뜬다.
 */
export default function MemberChatTab({ member, friendCount }: Props) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [filter, setFilter] = useState<FriendFilter>('ALL')
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<FriendsResult | null>(null)
  // 다른 필터·페이지를 읽는 동안에도 칩 숫자가 사라지지 않게 마지막 값을 둔다.
  const [counts, setCounts] = useState<FriendCounts | null>(null)

  const key = `${member.id}:${filter}:${page}`
  useEffect(() => {
    let cancelled = false
    getMemberFriends(member.id, filter, page)
      .then((found) => {
        if (cancelled) return
        setResult({ key, kind: 'ok', page: found })
        setCounts(found.counts)
      })
      .catch(() => {
        if (!cancelled) setResult({ key, kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [key, member.id, filter, page])
  const state: FriendsState = result && result.key === key ? result : { kind: 'loading' }

  const selectFilter = (next: FriendFilter) => {
    setFilter(next)
    setPage(0)
  }
  const goToMember = (friendId: number) => navigate(`/members/${friendId}`)
  const total = counts?.all ?? friendCount
  const emptyText = FILTERS.find((f) => f.value === filter)?.empty ?? '친구가 없어요'

  return (
    <div className="member-tab-body member-chat-tab">
      <div className="kpi-grid kpi-grid--3" aria-label="채팅 프로필">
        <div className="kpi">
          <div className="kpi-label">친구 수</div>
          <div className="kpi-value">{total.toLocaleString('ko-KR')}명</div>
        </div>
        <div className="kpi kpi--wide">
          <div className="kpi-label">상태 메시지</div>
          <div className={member.statusMessage ? 'kpi-text' : 'kpi-text card-muted'}>{member.statusMessage || '-'}</div>
        </div>
      </div>

      <section className="sub-card" aria-label="친구 목록">
        <div className="friends-head">
          <h3 className="sub-card-title">친구</h3>
          <div className="sort-chips" role="group" aria-label="친구 필터">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={filter === f.value ? 'sort-chip active' : 'sort-chip'}
                aria-pressed={filter === f.value}
                onClick={() => selectFilter(f.value)}
              >
                {f.label} {counts ? counts[f.count].toLocaleString('ko-KR') : '-'}
              </button>
            ))}
          </div>
        </div>

        {state.kind === 'loading' && <p className="card-muted sub-card-empty">불러오는 중...</p>}
        {state.kind === 'error' && <p className="error-text sub-card-empty">친구 목록을 불러오지 못했습니다</p>}
        {state.kind === 'ok' &&
          (state.page.content.length === 0 ? (
            <p className="card-muted sub-card-empty">{emptyText}</p>
          ) : (
            <>
              {isMobile ? (
                <ul className="card-list">
                  {state.page.content.map((f) => (
                    <li key={f.id} className={isMuted(f) ? 'friend-row--muted' : undefined}>
                      <MemberMiniCard
                        member={f}
                        friendName={f.friendName ?? undefined}
                        favorite={f.favorite}
                        badges={f.favorite || isMuted(f) ? <FriendStatusBadges friend={f} empty={null} /> : undefined}
                        onClick={() => goToMember(f.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="table-scroll">
                  <table className="sub-card-table friends-table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>내가 정한 이름</th>
                        <th>이메일</th>
                        <th>사용자 ID</th>
                        <th>상태</th>
                        <th>직원</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.page.content.map((f) => (
                        <tr
                          key={f.id}
                          className={isMuted(f) ? 'clickable-row friend-row--muted' : 'clickable-row'}
                          role="button"
                          tabIndex={0}
                          onClick={() => goToMember(f.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              goToMember(f.id)
                            }
                          }}
                        >
                          <td>
                            <span className="friend-name-cell">
                              <RemoteImage filename={f.profileImage} alt={f.username} className="avatar avatar--sm" />
                              {f.favorite && <FavoriteStar />}
                              <span>{f.username}</span>
                            </span>
                          </td>
                          <td>{f.friendName || '-'}</td>
                          <td>{f.email}</td>
                          <td>{f.userId}</td>
                          <td className="nowrap">
                            <FriendStatusBadges friend={f} empty={<span className="card-muted">-</span>} />
                          </td>
                          <td>
                            <StaffBadges permissions={f.staffPermissions} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <FriendsFooter page={state.page} onChange={setPage} />
            </>
          ))}
      </section>

      <details className="file-info">
        <summary>파일 정보</summary>
        <dl>
          <dt>프로필 이미지</dt>
          <dd>{member.profileImage ?? '-'}</dd>
          <dt>배경 이미지</dt>
          <dd>{member.wallpaperImage ?? '-'}</dd>
        </dl>
      </details>
    </div>
  )
}

const isMuted = (f: AdminFriend) => f.friendStatus !== 'NORMAL'

function FavoriteStar() {
  return (
    <span className="friend-star" role="img" aria-label="즐겨찾기">
      ★
    </span>
  )
}

/** 숨김(회색)·차단(빨강)·즐겨찾기(주황). 아무것도 없으면 empty. */
function FriendStatusBadges({ friend, empty }: { friend: AdminFriend; empty: ReactNode }) {
  const badges: ReactNode[] = []
  if (friend.friendStatus === 'HIDDEN') badges.push(<span key="hidden" className="status-badge">숨김</span>)
  if (friend.friendStatus === 'BLOCKED') badges.push(<span key="blocked" className="status-badge status-badge--cancelled">차단</span>)
  if (friend.favorite) badges.push(<span key="favorite" className="status-badge status-badge--amber">즐겨찾기</span>)
  if (badges.length === 0) return <>{empty}</>
  return <span className="friend-badges">{badges}</span>
}

/** "N명 중 a–b" 와 페이저. 한 페이지뿐이면 페이저는 숨긴다. */
function FriendsFooter({ page, onChange }: { page: FriendPage; onChange: (page: number) => void }) {
  const size = page.size || FRIEND_PAGE_SIZE
  const from = page.number * size + 1
  const to = page.number * size + page.content.length
  return (
    <div className="friends-footer">
      <span className="card-muted friends-range">
        {page.totalElements.toLocaleString('ko-KR')}명 중 {from}–{to}
      </span>
      {page.totalPages > 1 && <Pager page={page.number} totalPages={page.totalPages} onChange={onChange} />}
    </div>
  )
}
