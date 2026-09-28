import type { ReactNode } from 'react'
import type { StaffPermission } from '../util/format'
import RemoteImage from './RemoteImage'
import StaffBadges from './StaffBadges'

/** 회원 상세의 친구(Member)와 채팅방 상세의 멤버(RoomMember)가 공통으로 가진 것만 쓴다. */
interface MiniMember {
  username: string
  email: string
  userId: string
  /** 회원 상세의 친구 목록에서만 온다. 채팅방 멤버에는 없다. */
  staffPermissions?: StaffPermission[]
  profileImage?: string
}

interface Props {
  member: MiniMember
  /** 비어 있지 않으면 이름 옆에 "내가 정한 이름" 으로 보인다(회원 상세의 친구 목록). */
  friendName?: string
  /** 즐겨찾기한 친구면 이름 앞에 ★(회원 상세의 친구 목록). */
  favorite?: boolean
  /** 직원 배지 옆에 붙는 배지(친구의 숨김·차단·즐겨찾기 등). */
  badges?: ReactNode
  onClick: () => void
}

/** 폰 화면의 회원 한 줄 카드. 회원 상세의 친구 목록과 채팅방 상세의 멤버 목록이 같이 쓴다. */
export default function MemberMiniCard({ member, friendName, favorite, badges, onClick }: Props) {
  const hasStaff = !!member.staffPermissions && member.staffPermissions.length > 0
  return (
    <button type="button" className="card" onClick={onClick}>
      <RemoteImage filename={member.profileImage} alt="" className="avatar avatar--sm" />
      <span className="card-body">
        <span className="card-title">
          {favorite && (
            <span className="friend-star" role="img" aria-label="즐겨찾기">
              ★
            </span>
          )}
          {member.username}
          {friendName ? <span className="card-muted"> · {friendName}</span> : null}
        </span>
        <span className="card-line">{member.email}</span>
        <span className="card-line card-muted">{member.userId}</span>
        {(hasStaff || badges) && (
          <span className="card-meta">
            {badges}
            {hasStaff && <StaffBadges permissions={member.staffPermissions} />}
          </span>
        )}
      </span>
    </button>
  )
}
