import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConsoleLayout, hasRole, LoginPage, RequireAuth } from '@modu/console-core'
import { navSections } from './nav'
import MemberDetailPage from './pages/MemberDetailPage'
import MembersPage from './pages/MembersPage'
import StaffPage from './pages/StaffPage'

/** 메뉴는 렌더할 때마다 토큰을 다시 읽어 정하므로 로그인·로그아웃을 따라간다. */
function Shell() {
  return <ConsoleLayout brand="모두 인터널" sections={navSections(hasRole('ROLE_SUPER'))} />
}

/** 사내 업무 콘솔(ROLE_INTERNAL). 회원 조회와 직원 권한. 직원 메뉴와 권한 변경은 최상위(ROLE_SUPER)만 본다. */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage title="모두 인터널 로그인" home="/members" />} />
        <Route
          element={
            <RequireAuth role="ROLE_INTERNAL">
              <Shell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/members" replace />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/members/:id" element={<MemberDetailPage />} />
          <Route path="/staff" element={<StaffPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
