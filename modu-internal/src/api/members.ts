import { api, PAGE_SIZE, type Page } from '@modu/console-core'

/** member-service 백오피스 API 의 회원. 시각(createdDate)은 시간대 표시 없는 UTC 다. */
export interface Member {
  id: number
  userId: string
  email: string
  username: string
  role: string
  statusMessage?: string
  createdDate?: string
}

export interface MemberDetail {
  member: Member
  friendCount: number
  createdDate?: string
}

/** 서버(MemberSort)가 받는 정렬 중 이 화면이 쓰는 것. */
export type MemberSort = 'name,asc' | 'email,asc' | 'createdDate,desc' | 'createdDate,asc'

export const MEMBER_SORT_LABELS: Record<MemberSort, string> = {
  'name,asc': '이름순',
  'email,asc': '이메일순',
  'createdDate,desc': '최근 가입순',
  'createdDate,asc': '오래된 가입순',
}

/** 이름·이메일·userId 부분 일치 검색(서버가 한다). */
export const searchMembers = (keyword: string, page: number, sort: MemberSort = 'name,asc') =>
  api<Page<Member>>(
    `/member-service/api-admin/member?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${PAGE_SIZE}&sort=${encodeURIComponent(sort)}`,
  )

export const getMember = (id: string) => api<MemberDetail>(`/member-service/api-admin/member/${encodeURIComponent(id)}`)

export const roleLabel = (role?: string) => (role === 'ROLE_ADMIN' ? '관리자' : '일반 회원')
