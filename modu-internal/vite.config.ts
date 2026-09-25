/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 사내 업무 콘솔. 개발 서버도 같은 출처로 부르고 Vite 가 게이트웨이로 넘긴다(배포는 nginx). 게이트웨이 CORS 가 필요 없다.
const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177,
    strictPort: true,
    proxy: {
      '/auth-service': { target: GATEWAY, changeOrigin: true },
      '/member-service': { target: GATEWAY, changeOrigin: true },
    },
  },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', globals: true },
})
