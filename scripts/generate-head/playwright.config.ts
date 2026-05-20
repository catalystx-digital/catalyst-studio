import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const repoRoot = process.cwd()

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  outputDir: path.resolve(repoRoot, 'test-results', 'head-generator-playwright'),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
