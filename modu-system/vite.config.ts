/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 시스템 콘솔. 개발 서버도 같은 출처로 부르고 Vite 가 게이트웨이로 넘긴다(배포는 nginx). 게이트웨이 CORS 가 필요 없다.
const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  // API 문서 화면(Swagger UI) 청크가 1.3MB 다. React.lazy 로 그 화면을 열 때만 받으므로 경고 기준을 그만큼 올린다.
  build: { chunkSizeWarningLimit: 1400 },
  server: {
    port: 5176,
    strictPort: true,
    proxy: {
      // nginx.conf.template 의 게이트웨이 경로와 같다. 서비스 경로는 API 문서 화면의 Try it out 용이다.
      '^/(auth-service|gateway-service|config-service|member-service|chat-service|chat-store-service|ws-service|push-service|storage-service|profile-service|point-service|schedule-service|commerce-service|deploy-service)/':
        { target: GATEWAY, changeOrigin: true },
    },
  },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', globals: true },
})
