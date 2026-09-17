import { vi } from 'vitest'

/**
 * jsdom 에는 matchMedia 가 없다. 폭 기준 분기(useIsMobile)를 테스트할 때 원하는 결과로 흉내 낸다.
 * 돌려주는 함수로 원래 상태로 되돌린다.
 */
export function mockViewport(mobile: boolean) {
  const original = window.matchMedia
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mobile,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  return () => {
    window.matchMedia = original
  }
}
