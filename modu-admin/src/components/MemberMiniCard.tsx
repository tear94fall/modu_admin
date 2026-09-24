import { formatRole } from '../util/format'
import RemoteImage from './RemoteImage'

/** 회원 상세의 친구(Member)와 채팅방 상세의 멤버(RoomMember)가 공통으로 가진 것만 쓴다. */
interface MiniMember {
  username: string
  email: string
  userId: string
  role?: string
  profileImage?: string
}

interface Props {
  member: MiniMember
  /** 비어 있지 않으면 이름 옆에 "내가 정한 이름" 으로 보인다(회원 상세의 친구 목록). */
  friendName?: string
  onClick: () => void
}

/** 폰 화면의 회원 한 줄 카드. 회원 상세의 친구 목록과 채팅방 상세의 멤버 목록이 같이 쓴다. */
export default function MemberMiniCard({ member, friendName, onClick }: Props) {
  return (
    <button type="button" className="card" onClick={onClick}>
      <RemoteImage filename={member.profileImage} alt="" className="avatar avatar--sm" />
      <span className="card-body">
        <span className="card-title">
          {member.username}
          {friendName ? <span className="card-muted"> · {friendName}</span> : null}
        </span>
        <span className="card-line">{member.email}</span>
        <span className="card-line card-muted">{member.userId}</span>
        <span className="card-meta">
          <span className="chip">{formatRole(member.role)}</span>
        </span>
      </span>
    </button>
  )
}
