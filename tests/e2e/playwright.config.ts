import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',

  timeout: 15_000,

  // Abort the whole run after 10 min in CI — a fully failing run
  // (35 tests × 15s × retry) would otherwise take ~18 min.
  globalTimeout: process.env.CI ? 10 * 60_000 : 0,

  expect: {
    timeout: 5_000,
  },

  retries: process.env.CI ? 1 : 0,

  // Single worker locally (deterministic output), 4 in CI (parallel by spec file).
  // Tests within each spec file stay sequential. With 5 spec files and
  // 4 workers the run time drops from ~2 min to ~30 s.
  workers: process.env.CI ? 4 : 1,

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

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
