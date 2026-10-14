import { describe, expect, it } from 'vitest'
import { activeLink } from './ConsoleLayout'

const tos = ['/gateway/routes', '/config/files', '/deploy', '/deploy/history', '/api-docs']

describe('activeLink', () => {
  it('같은 경로의 링크만 켠다', () => {
    expect(activeLink('/deploy', tos)).toBe('/deploy')
    expect(activeLink('/deploy/history', tos)).toBe('/deploy/history')
  })
  it('하위 경로(상세)는 가장 긴 상위 링크 하나에 붙는다', () => {
    expect(activeLink('/deploy/point-service', tos)).toBe('/deploy')
    expect(activeLink('/deploy/history/x', tos)).toBe('/deploy/history')
  })
  it('맞는 링크가 없으면 null', () => {
    expect(activeLink('/login', tos)).toBeNull()
    expect(activeLink('/deployment', tos)).toBeNull()
  })
})
