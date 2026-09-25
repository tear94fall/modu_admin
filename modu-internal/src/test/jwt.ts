import { setToken } from '@modu/console-core'

/** 테스트용 액세스 토큰(서명은 보지 않는다). 콘솔은 payload 의 roles 만 읽는다. */
export function loginAs(roles: string[]) {
  const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  setToken(`${enc({ alg: 'RS256' })}.${enc({ sub: 'viewer', roles })}.sig`)
}

export const SUPER_ROLES = ['ROLE_SUPER', 'ROLE_ADMIN', 'ROLE_SYSTEM', 'ROLE_INTERNAL']
