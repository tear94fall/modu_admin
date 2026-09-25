import type { NavSection } from '@modu/console-core'

const SECTIONS: NavSection[] = [{ title: '회원', links: [{ to: '/members', label: '회원 조회' }] }]
const SUPER_SECTIONS: NavSection[] = [{ title: '직원', links: [{ to: '/staff', label: '직원' }] }]

/** 로그인한 사람의 권한에 맞는 메뉴. 직원 메뉴는 최상위(ROLE_SUPER)만 본다. */
export const navSections = (isSuper: boolean): NavSection[] => (isSuper ? [...SECTIONS, ...SUPER_SECTIONS] : SECTIONS)
