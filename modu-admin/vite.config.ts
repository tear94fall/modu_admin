/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 날짜 표시 테스트가 브라우저 로컬 시간대(KST)를 가정한다. CI 러너는 UTC 라 테스트 시간대를 고정한다.
process.env.TZ = 'Asia/Seoul'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    globals: true,
  },
})
