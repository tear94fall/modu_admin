import { useSyncExternalStore } from 'react'

/**
 * 미디어 쿼리 구독. 공통 useIsMobile(768px) 과 같은 역할이고, 폭 기준만 따로 받는다.
 * matchMedia 가 없는 환경(jsdom)에서는 항상 false.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )
}

/**
 * 배포 표의 일곱 칸을 글자를 줄이지 않고 보여 주기 어려운 폭. 이보다 좁으면 핵심 칸만 두고 나머지는 상세 화면에서 본다.
 * 1280px 창이면 내용 폭이 약 1016px(사이드바 200 + 여백 64)인데, 태그 두 칸·마지막 배포(약 200px)·버튼 두 개까지 두면 그보다 넓어야 한다.
 */
export const NARROW_QUERY = '(max-width: 1280px)'
