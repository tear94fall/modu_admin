/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 패키지 자체는 빌드하지 않는다(콘솔 앱이 소스를 그대로 가져가 번들한다). 테스트만 돌린다.
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', globals: true },
})
