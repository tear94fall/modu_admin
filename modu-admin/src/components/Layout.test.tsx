import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { mockViewport } from '../test/viewport'
import Layout from './Layout'

const renderLayout = () =>
  render(
    <MemoryRouter>
      <Layout />
    </MemoryRouter>,
  )

describe('Layout', () => {
  it('shows the brand logo next to the title', () => {
    const { container } = renderLayout()

    const logo = container.querySelector('.brand-logo')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/favicon.svg')
    // 옆 글자가 이름을 말하므로 로고는 장식이다 — 낭독기가 두 번 읽으면 안 된다.
    expect(logo).toHaveAttribute('alt', '')
    expect(screen.getByText('모두의 어드민')).toBeInTheDocument()
  })

  it('links to the main sections', () => {
    renderLayout()

    expect(screen.getByRole('link', { name: '회원' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '채팅방' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '상품' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '푸시' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '앱 설정' })).toBeInTheDocument()
  })

  it('groups the menu by service: 회원 / 채팅 / 혜택 / 커머스', () => {
    const { container } = renderLayout()

    // 섹션 제목 → 그 아래 링크 순서. 푸시·앱 설정은 채팅 앱 기능이라 채팅 묶음에 들어간다.
    const sections = Array.from(container.querySelectorAll('.nav-section')).map((section) => ({
      title: section.querySelector('.nav-section-title')?.textContent,
      links: Array.from(section.querySelectorAll('a')).map((a) => a.textContent),
    }))

    expect(sections).toEqual([
      { title: '회원', links: ['회원'] },
      { title: '채팅', links: ['채팅방', '푸시', '앱 설정'] },
      { title: '혜택', links: ['포인트', '쿠폰'] },
      { title: '커머스', links: ['카테고리', '상품', '주문', '리뷰', '기획전·이벤트'] },
    ])
  })

  it('keeps 내 정보 and 로그아웃 in the footer, outside the sections', () => {
    const { container } = renderLayout()

    const footer = container.querySelector('.sidebar-footer')
    expect(footer?.querySelector('a')?.textContent).toBe('내 정보')
    expect(footer?.querySelector('button')?.textContent).toBe('로그아웃')
    expect(footer?.closest('.nav-section')).toBeNull()
  })

  describe('on a narrow screen', () => {
    let restore: () => void
    afterEach(() => restore())

    it('replaces the sidebar with a top bar and a menu button', () => {
      restore = mockViewport(true)
      const { container } = renderLayout()

      expect(screen.getByRole('button', { name: '메뉴' })).toBeInTheDocument()
      expect(screen.getByText('모두의 어드민')).toBeInTheDocument()
      // 드로어는 닫힌 채로 시작한다.
      expect(container.querySelector('.sidebar--drawer.open')).toBeNull()
    })

    it('opens the drawer with the same sections and closes it after choosing a menu', async () => {
      restore = mockViewport(true)
      const user = userEvent.setup()
      const { container } = renderLayout()

      await user.click(screen.getByRole('button', { name: '메뉴' }))
      expect(container.querySelector('.sidebar--drawer.open')).not.toBeNull()
      const titles = Array.from(container.querySelectorAll('.sidebar--drawer .nav-section-title')).map((el) => el.textContent)
      expect(titles).toEqual(['회원', '채팅', '혜택', '커머스'])

      await user.click(screen.getByRole('link', { name: '상품' }))
      expect(container.querySelector('.sidebar--drawer.open')).toBeNull()
    })
  })
})
