import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConsoleLayout, LoginPage, RequireAuth, type NavSection } from '@modu/console-core'
import ConfigRepoPage from './pages/ConfigRepoPage'
import GatewayRoutesPage from './pages/GatewayRoutesPage'

// Swagger UI 는 크다. 이 화면을 열 때만 받도록 따로 떼어 낸다(다른 화면은 swagger 를 싣지 않는다).
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'))

/** 시스템 운영 콘솔. 게이트웨이 라우트, 설정 서버(config-repo), 서비스별 API 문서 조회. */
const SECTIONS: NavSection[] = [
  { title: '게이트웨이', links: [{ to: '/gateway/routes', label: '라우트' }] },
  { title: '설정 서버', links: [{ to: '/config/files', label: 'Config 설정' }] },
  { title: '개발', links: [{ to: '/api-docs', label: 'API 문서' }] },
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
          <Route
            path="/api-docs"
            element={
              <Suspense fallback={<p>불러오는 중...</p>}>
                <ApiDocsPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
