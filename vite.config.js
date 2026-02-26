import { defineConfig } from 'vite'

// GitHub Actions では BASE_URL 環境変数でリポジトリ名を渡す
// ローカル開発時は '/' のまま
export default defineConfig({
  base: process.env.BASE_URL || '/',
})
