import { useEffect, useState } from 'react'

/** 이 폭 이하면 폰 배치(상단 바 + 드로어, 카드 목록)를 쓴다. PC 는 그대로다. */
export const MOBILE_QUERY = '(max-width: 768px)'

const matches = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_QUERY).matches

/** 화면 폭이 폰 기준 이하인지. 창 크기가 바뀌면 따라간다. matchMedia 가 없는 환경(jsdom)에서는 항상 false. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(matches)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(MOBILE_QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
