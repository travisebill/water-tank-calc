import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      // 原始碼 import firebase/*，但分享出來的憑證是佔位符（apiKey: ''）。
      // 這三個 alias 把它導到本地 shim → 完整離線可用、設定存 localStorage。
      'firebase/app': path.resolve(__dirname, 'src/shim/firebase-app.js'),
      'firebase/auth': path.resolve(__dirname, 'src/shim/firebase-auth.js'),
      'firebase/firestore': path.resolve(__dirname, 'src/shim/firebase-firestore.js'),
    },
  },
  define: {
    // Gemini 執行期注入的全域變數；此處明確定義為 undefined，走 App 內建的 fallback 分支
    __firebase_config: 'undefined',
    __app_id: 'undefined',
    __initial_auth_token: 'undefined',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
