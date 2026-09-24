import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConsoleLayout, LoginPage, RequireAuth, type NavSection } from '@modu/console-core'
import GatewayRoutesPage from './pages/GatewayRoutesPage'

/** 시스템 운영 콘솔. 지금은 게이트웨이 설정 조회뿐이다. */
const SECTIONS: NavSection[] = [{ title: '게이트웨이', links: [{ to: '/gateway/routes', label: '라우트' }] }]

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage title="모두 시스템 로그인" home="/gateway/routes" />} />
        <Route
          element={
            <RequireAuth>
              <ConsoleLayout brand="모두 시스템" sections={SECTIONS} />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/gateway/routes" replace />} />
          <Route path="/gateway/routes" element={<GatewayRoutesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
