import { api, PAGE_SIZE, STAFF_PERMISSION_LABELS, STAFF_PERMISSIONS, type Page, type StaffPermission } from '@modu/console-core'

/**
 * member-service 직원 API. 직원 목록·한 명(/api-staff/staff)은 ROLE_INTERNAL, 직원 지정·해제(/api-super/staff)와
 * 직원을 지정하려고 회원을 찾는 검색(/api-super/member)은 ROLE_SUPER 가 부른다. 회원 운영 조회는 어드민 콘솔이 한다(2026-11-27).
 * 시각(createdDate·modifiedDate)은 모두 시간대 표시 없는 UTC 다.
 */
export type { StaffPermission }

export type MemberStatus = 'ACTIVE' | 'WITHDRAWN'

export interface StaffMemberSummary {
  id: number
  userId: string
  username: string | null
  profileImage: string | null
  email: string
  createdDate: string
  status: MemberStatus
  /** 비었으면 직원이 아니다. */
  permissions: StaffPermission[]
}

export interface StaffInfo {
  permissions: StaffPermission[]
  createdDate: string
  modifiedDate: string
  /** 마지막으로 바꾼 최상위 관리자의 userId. */
  modifiedBy: string | null
  modifiedByName: string | null
}

export interface StaffEntry extends StaffInfo {
  memberId: number
  userId: string
  username: string | null
  email: string
  profileImage: string | null
}

/** 서버(MemberSort)가 받는 정렬 중 이 화면이 쓰는 것. */
export type MemberSort = 'name,asc' | 'email,asc' | 'createdDate,desc' | 'createdDate,asc'

export const MEMBER_SORT_LABELS: Record<MemberSort, string> = {
  'name,asc': '이름순',
  'email,asc': '이메일순',
  'createdDate,desc': '최근 가입순',
  'createdDate,asc': '오래된 가입순',
}

/** 직원으로 지정할 회원 찾기(이름·이메일·userId 부분 일치, 서버가 한다). 최상위만. */
export const searchMembers = (keyword: string, page: number, sort: MemberSort = 'name,asc') =>
  api<Page<StaffMemberSummary>>(`/member-service/api-super/member?keyword=${encodeURIComponent(keyword)}&sort=${encodeURIComponent(sort)}&page=${page}&size=${PAGE_SIZE}`)

/** 직원 목록(이름순). 인터널 권한이면 본다. */
export const listStaff = () => api<StaffEntry[]>('/member-service/api-staff/staff')

/** 직원 한 명. 직원이 아니면 404. */
export const getStaff = (memberId: string) => api<StaffEntry>(`/member-service/api-staff/staff/${encodeURIComponent(memberId)}`)

/** 직원 지정·권한 변경. 직원이 아니었으면 새로 만든다. 최상위만. */
export const updateStaff = (memberId: number, permissions: StaffPermission[]) =>
  api<StaffEntry>(`/member-service/api-super/staff/${memberId}`, { method: 'PUT', body: JSON.stringify({ permissions }) })

/** 직원 해제. 최상위만. */
export const removeStaff = (memberId: number) => api<void>(`/member-service/api-super/staff/${memberId}`, { method: 'DELETE' })

/** 권한을 정해진 순서(최상위·어드민·시스템·인터널)로. 서버 순서와 무관하게 늘 같게 보인다. */
export const sortPermissions = (permissions: StaffPermission[]) => STAFF_PERMISSIONS.filter((p) => permissions.includes(p))

export const permissionLabel = (p: StaffPermission) => STAFF_PERMISSION_LABELS[p] ?? p

export const displayName = (m: { username: string | null; email: string }) => m.username || m.email
