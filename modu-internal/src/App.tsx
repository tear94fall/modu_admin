import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConsoleLayout, LoginPage, RequireAuth } from '@modu/console-core'
import { navSections } from './nav'
import StaffAddPage from './pages/StaffAddPage'
import StaffDetailPage from './pages/StaffDetailPage'
import StaffPage from './pages/StaffPage'

function Shell() {
  return <ConsoleLayout brand="모두 인터널" sections={navSections()} />
}

/** 직원 전용 콘솔(ROLE_INTERNAL): 직원 목록·권한 보기. 직원 추가·권한 변경·해제는 최상위(ROLE_SUPER)만. 회원 운영 조회는 모두의 어드민. */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage title="모두 인터널 로그인" home="/staff" />} />
        <Route
          element={
            <RequireAuth role="ROLE_INTERNAL">
              <Shell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/staff" replace />} />
          <Route path="/members" element={<Navigate to="/staff" replace />} />
          <Route path="/members/:id" element={<Navigate to="/staff" replace />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/staff/new" element={<StaffAddPage />} />
          <Route path="/staff/:id" element={<StaffDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
