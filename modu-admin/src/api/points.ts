import { api, PAGE_SIZE } from './client'
import type { Page } from './members'

/**
 * 포인트 계정. 사용자는 userId(구글 sub)로 식별하고, 이름·이메일은 point-service 가 member-service 에서 붙여 준다.
 * member-service 가 응답하지 않으면 이름·이메일이 비어 온다.
 */
export interface PointAccount {
  userId: string
  username?: string | null
  email?: string | null
  balance: number
  createdDate?: string
  updatedDate?: string
}

/** 계정이 없는 사용자도 누구인지 보여 주기 위한 회원 요약. */
export interface PointMember {
  userId: string
  username?: string | null
  email?: string | null
}

export type PointTransactionType = 'EARN' | 'SPEND' | 'REFUND' | 'ADJUST'

export interface PointTransaction {
  id: number
  type: PointTransactionType
  /** 부호가 있다. 적립 +, 사용·회수 − */
  amount: number
  balanceAfter: number
  ruleCode?: string | null
  refId?: string | null
  memo?: string | null
  createdDate?: string
}

/** 적립 규칙. 점수·상한은 여기서 정하고 다른 서비스는 코드만 보낸다. 상한이 null 이면 무제한. */
export interface PointRule {
  code: string
  name: string
  points: number
  dailyLimit: number | null
  totalLimit: number | null
  enabled: boolean
}

export const searchAccounts = (keyword: string, page: number) =>
  api<Page<PointAccount>>(
    `/point-service/api-admin/point/accounts?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${PAGE_SIZE}`,
  )
export const getAccount = (userId: string) =>
  api<PointAccount>(`/point-service/api-admin/point/accounts/${encodeURIComponent(userId)}`)
export const getAccountMember = (userId: string) =>
  api<PointMember>(`/point-service/api-admin/point/accounts/${encodeURIComponent(userId)}/member`)
export const getHistory = (userId: string, page: number) =>
  api<Page<PointTransaction>>(
    `/point-service/api-admin/point/accounts/${encodeURIComponent(userId)}/history?page=${page}&size=${PAGE_SIZE}`,
  )
/** 양수는 지급, 음수는 회수. 메모는 필수(원장에 남는다). */
export const adjustPoints = (userId: string, body: { amount: number; memo: string }) =>
  api<{ userId: string; balance: number }>(`/point-service/api-admin/point/accounts/${encodeURIComponent(userId)}/adjust`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
export const listRules = () => api<PointRule[]>('/point-service/api-admin/point/rules')
/** 새 규칙. 코드는 대문자·숫자·밑줄(다른 서비스가 그대로 보내는 식별자). 같은 코드가 있으면 409. */
export const createRule = (body: PointRule) =>
  api<PointRule>('/point-service/api-admin/point/rules', { method: 'POST', body: JSON.stringify(body) })
/** 규칙 삭제. 과거 이력은 남는다. 출석 규칙(DAILY_CHECKIN)은 서버가 409 로 거부한다. */
export const deleteRule = (code: string) =>
  api<void>(`/point-service/api-admin/point/rules/${encodeURIComponent(code)}`, { method: 'DELETE' })
export const updateRule = (code: string, body: Omit<PointRule, 'code'>) =>
  api<PointRule>(`/point-service/api-admin/point/rules/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const TRANSACTION_TYPE_LABEL: Record<PointTransactionType, string> = {
  EARN: '적립',
  SPEND: '사용',
  REFUND: '환불',
  ADJUST: '조정',
}

/** 1234 → "1,234 P" */
export const formatPoints = (points: number) => `${points.toLocaleString('ko-KR')} P`
