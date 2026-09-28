import { api, PAGE_SIZE } from './client'
import type { StaffPermission } from '../util/format'
export interface Member {
  id: number
  userId: string
  email: string
  username: string
  role: string
  statusMessage?: string
  profileImage?: string
  wallpaperImage?: string
  createdDate?: string
  /** 회원 상세의 친구 목록에서만 온다: 그 회원이 이 친구에게 정한 이름 */
  friendName?: string
  /** 직원 권한. 비어 있으면 직원이 아니다(role 은 콘솔 권한과 상관없는 옛 값이라 보여 주지 않는다). */
  staffPermissions?: StaffPermission[]
  /** 이 회원이 쓰는 서비스(CHAT, COMMERCE 순). 목록에서 온다. */
  services?: MemberService[]
  /** 탈퇴하면 WITHDRAWN. 서버가 안 주면 이용 중으로 본다. */
  status?: 'ACTIVE' | 'WITHDRAWN'
}
/** 회원이 쓰는 서비스. 인증 서버가 토큰을 줄 때 앱(클라이언트)마다 남긴 이용 기록으로 정한다. */
export type MemberService = 'CHAT' | 'COMMERCE'
/** 회원 목록의 서비스 필터. BOTH = 둘 다, NONE = 이용 기록 없음. */
export type ServiceFilter = MemberService | 'BOTH' | 'NONE'
export const SERVICE_FILTERS: readonly ServiceFilter[] = ['CHAT', 'COMMERCE', 'BOTH', 'NONE']
export const SERVICE_LABELS: Record<MemberService, string> = { CHAT: '채팅', COMMERCE: '커머스' }
/** 서비스별 이용 기록. 시각은 시간대 없는 UTC 값. */
export interface ServiceUsage {
  service: MemberService
  firstUsedAt: string | null
  lastUsedAt: string | null
}
export interface Page<T> { content: T[]; totalElements: number; totalPages: number; number: number; size: number }
export interface MemberDetail {
  member: Member
  friendCount: number
  createdDate?: string
  friends: Member[]
  /** 이 회원의 직원 권한. 비어 있으면 직원이 아니다. */
  staffPermissions?: StaffPermission[]
  /** 서비스별 처음·마지막 이용. 이용 기록이 없으면 비어 있다. */
  services?: ServiceUsage[]
}
/** 서버(MemberSort)가 받아 주는 값. 목록에 값이 보이는 열은 모두 있다. 그 밖의 값을 보내면 400 이 온다. */
export const MEMBER_SORTS = [
  'name,asc',
  'name,desc',
  'email,asc',
  'email,desc',
  'userId,asc',
  'userId,desc',
  'role,asc',
  'role,desc',
  'createdDate,desc',
  'createdDate,asc',
] as const
export type MemberSort = (typeof MEMBER_SORTS)[number]
/** 이름 가나다순(한글 이름 먼저). 서버 기본값과 같게 둔다. */
export const DEFAULT_MEMBER_SORT: MemberSort = 'name,asc'
export const searchMembers = (keyword: string, page: number, sort: MemberSort = DEFAULT_MEMBER_SORT, service?: ServiceFilter) =>
  api<Page<Member>>(
    `/member-service/api-admin/member?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${PAGE_SIZE}&sort=${encodeURIComponent(sort)}` +
      (service ? `&service=${service}` : ''),
  )
/** userId 로 회원 한 명을 찾는다(검색 결과에서 userId 가 정확히 같은 회원). 없으면 null. */
export async function findMemberByUserId(userId: string): Promise<Member | null> {
  const result = await searchMembers(userId, 0)
  return result.content.find((m) => m.userId === userId) ?? null
}
export const getMember = (id: string) => api<MemberDetail>(`/member-service/api-admin/member/${id}`)
export const getMe = () => api<MemberDetail>('/member-service/api-admin/member/me')
export const updateMe = (body: { username?: string; statusMessage?: string; profileImage?: string; wallpaperImage?: string }) =>
  api<MemberDetail>('/member-service/api-admin/member/me', { method: 'PUT', body: JSON.stringify(body) })
/** 친구 목록 필터. NORMAL = 숨김·차단이 아닌 친구(즐겨찾기 포함). */
export type FriendFilter = 'ALL' | 'NORMAL' | 'FAVORITE' | 'HIDDEN' | 'BLOCKED'
export type FriendStatus = 'NORMAL' | 'HIDDEN' | 'BLOCKED'
/** 회원 상세 채팅 탭의 친구 한 명: 회원 요약 + 그 회원이 정한 이름·즐겨찾기·숨김/차단. */
export interface AdminFriend extends Omit<Member, 'friendName'> {
  friendName: string | null
  favorite: boolean
  friendStatus: FriendStatus
}
export interface FriendCounts { all: number; normal: number; favorite: number; hidden: number; blocked: number }
export interface FriendPage extends Page<AdminFriend> { counts: FriendCounts }
/** 친구 목록 한 페이지 크기(회원 상세 안의 작은 표라 목록 화면보다 적다). */
export const FRIEND_PAGE_SIZE = 10
export const getMemberFriends = (id: string | number, filter: FriendFilter = 'ALL', page = 0) =>
  api<FriendPage>(`/member-service/api-admin/member/${id}/friends?filter=${filter}&page=${page}&size=${FRIEND_PAGE_SIZE}`)
