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
      command: 'npm run build -w @phasewire/server && npx tsx e2e/support/live-service.ts',
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
