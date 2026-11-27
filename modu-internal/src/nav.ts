import type { NavSection } from '@modu/console-core'

/** 인터널 콘솔은 직원 전용이다(2026-11-27). 회원 조회는 모두의 어드민에서 한다. 메뉴는 권한과 무관하게 같다 — 직원 추가·권한 변경 버튼만 최상위에게 보인다. */
export const navSections = (): NavSection[] => [{ title: '직원', links: [{ to: '/staff', label: '직원 목록' }] }]
