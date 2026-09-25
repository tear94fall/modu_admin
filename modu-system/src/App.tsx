import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConsoleLayout, LoginPage, RequireAuth, type NavSection } from '@modu/console-core'
import ConfigRepoPage from './pages/ConfigRepoPage'
import GatewayRoutesPage from './pages/GatewayRoutesPage'

/** 시스템 운영 콘솔. 게이트웨이 라우트와 설정 서버(config-repo) 조회. 모두 읽기 전용이다. */
const SECTIONS: NavSection[] = [
  { title: '게이트웨이', links: [{ to: '/gateway/routes', label: '라우트' }] },
  { title: '설정 서버', links: [{ to: '/config/files', label: 'Config 설정' }] },
]

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage title="모두 시스템 로그인" home="/gateway/routes" />} />
        <Route
          element={
            <RequireAuth role="ROLE_SYSTEM">
              <ConsoleLayout brand="모두 시스템" sections={SECTIONS} />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/gateway/routes" replace />} />
          <Route path="/gateway/routes" element={<GatewayRoutesPage />} />
          <Route path="/config/files" element={<ConfigRepoPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
