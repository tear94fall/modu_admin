import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout as logoutRequest } from '../auth/auth'
import { clearToken } from '../auth/token'
import { useIsMobile } from '../hooks/useIsMobile'

export interface NavSection {
  title: string
  links: { to: string; label: string }[]
}

interface ConsoleLayoutProps {
  /** 사이드바 상단 이름(예: '모두 시스템'). */
  brand: string
  sections: NavSection[]
}

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link active' : 'nav-link')

function Brand({ name }: { name: string }) {
  return (
    <div className="brand">
      {/* 옆 글자가 이름을 말하므로 로고는 장식이다. */}
      <img src="/favicon.svg" alt="" className="brand-logo" />
      <span>{name}</span>
    </div>
  )
}

function NavContent({ sections, onNavigate, onLogout }: { sections: NavSection[]; onNavigate?: () => void; onLogout: () => void }) {
  return (
    <>
      <div className="sidebar-nav">
        {sections.map((section) => (
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
        <button type="button" className="btn btn--ghost" onClick={onLogout}>
          로그아웃
        </button>
      </div>
    </>
  )
}

/** 콘솔 공통 뼈대: PC 는 고정 사이드바, 폰은 상단 바 + 드로어. 모두의 어드민과 같은 모양이다. */
export default function ConsoleLayout({ brand, sections }: ConsoleLayoutProps) {
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
          <Brand name={brand} />
        </header>
        {drawerOpen && <button type="button" className="drawer-backdrop" aria-label="메뉴 닫기" onClick={close} />}
        <nav className={drawerOpen ? 'sidebar sidebar--drawer open' : 'sidebar sidebar--drawer'} aria-hidden={!drawerOpen}>
          <NavContent sections={sections} onNavigate={close} onLogout={logout} />
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
        <Brand name={brand} />
        <NavContent sections={sections} onLogout={logout} />
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
