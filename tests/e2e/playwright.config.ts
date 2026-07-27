import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',

  timeout: 15_000,

  expect: {
    timeout: 5_000,
  },

  retries: process.env.CI ? 1 : 0,

  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',

  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3001',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'on-first-retry',
  },

  webServer: {
    command: 'echo "Using existing docker stack"',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
