import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConsoleLayout, LoginPage, RequireAuth, type NavSection } from '@modu/console-core'
import MemberDetailPage from './pages/MemberDetailPage'
import MembersPage from './pages/MembersPage'

/** 사내 업무 콘솔. 지금은 회원 조회뿐이고, 직원 여부 설정이 여기에 들어올 예정이다. */
const SECTIONS: NavSection[] = [{ title: '회원', links: [{ to: '/members', label: '회원 조회' }] }]

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage title="모두 인터널 로그인" home="/members" />} />
        <Route
          element={
            <RequireAuth>
              <ConsoleLayout brand="모두 인터널" sections={SECTIONS} />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/members" replace />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/members/:id" element={<MemberDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
