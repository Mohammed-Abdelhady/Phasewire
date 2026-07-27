import { defineConfig } from '@playwright/test'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4318',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // Reuse core/server dist when present; prepare deps from a clean checkout.
      command:
        '(node -e "const fs=require(\'fs\');const path=require(\'path\');const root=path.resolve(\'..\',\'..\');process.exit(fs.existsSync(path.join(root,\'packages/core/dist/index.js\'))&&fs.existsSync(path.join(root,\'packages/server/dist/index.js\'))?0:1)" || npm run build:deps --prefix ../..) && npx tsx e2e/support/live-service.ts',
      cwd: webRoot,
      url: 'http://127.0.0.1:4317/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      cwd: webRoot,
      url: 'http://127.0.0.1:4318',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
})
