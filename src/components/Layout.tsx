import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout as logoutRequest } from '../api/auth'
import { clearToken } from '../auth/token'
import { useIsMobile } from '../hooks/useIsMobile'

/** 사이드바 메뉴를 서비스별로 묶는다. 푸시·앱 설정은 채팅 앱의 기능이라 채팅 묶음에 둔다. */
const SECTIONS = [
  { title: '회원', links: [{ to: '/members', label: '회원' }] },
  {
    title: '채팅',
    links: [
      { to: '/rooms', label: '채팅방' },
      { to: '/push', label: '푸시' },
      { to: '/settings', label: '앱 설정' },
    ],
  },
  {
    title: '커머스',
    links: [
      { to: '/categories', label: '카테고리' },
      { to: '/products', label: '상품' },
    ],
  },
]

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link active' : 'nav-link')

function Brand() {
  return (
    <div className="brand">
      {/* 옆 글자가 이름을 말하므로 로고는 장식이다 — alt 를 비워 화면 낭독기가 두 번 읽지 않게 한다. */}
      <img src="/favicon.svg" alt="" className="brand-logo" />
      <span>모두의 어드민</span>
    </div>
  )
}

/** 섹션 메뉴와 하단(내 정보·로그아웃). PC 사이드바와 폰 드로어가 같이 쓴다. */
function NavContent({ onNavigate, onLogout }: { onNavigate?: () => void; onLogout: () => void }) {
  return (
    <>
      <div className="sidebar-nav">
        {SECTIONS.map((section) => (
          <div key={section.title} className="nav-section">
            <div className="nav-section-title">{section.title}</div>
            {section.links.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass} onClick={onNavigate}>
                {link.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <NavLink to="/me" className={linkClass} onClick={onNavigate}>
          내 정보
        </NavLink>
        <button type="button" className="btn btn--ghost" onClick={onLogout}>
          로그아웃
        </button>
      </div>
    </>
  )
}

export default function Layout() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const logout = () => {
    logoutRequest()
      .catch(() => {})
      .finally(() => {
        clearToken()
        navigate('/login')
      })
  }

  if (isMobile) {
    const close = () => setDrawerOpen(false)
    return (
      <div className="layout layout--mobile">
        <header className="mobile-bar">
          <button type="button" className="menu-button" aria-label="메뉴" onClick={() => setDrawerOpen(true)}>
            <span aria-hidden="true">≡</span>
          </button>
          <Brand />
        </header>
        {/* 드로어는 항상 렌더하고 open 으로만 열고 닫는다 — 슬라이드 전환이 CSS 에서 붙는다. */}
        {drawerOpen && <button type="button" className="drawer-backdrop" aria-label="메뉴 닫기" onClick={close} />}
        {/* 이름은 상단 바에 있으니 드로어는 메뉴만 담는다. */}
        <nav className={drawerOpen ? 'sidebar sidebar--drawer open' : 'sidebar sidebar--drawer'} aria-hidden={!drawerOpen}>
          <NavContent onNavigate={close} onLogout={logout} />
        </nav>
        <main className="content">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="layout">
      <nav className="sidebar">
        <Brand />
        <NavContent onLogout={logout} />
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
