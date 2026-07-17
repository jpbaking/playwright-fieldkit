// Minimal Playwright config for the integration tests you generate.
// Copy to your project root. Docs: https://playwright.dev/docs/test-configuration
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // Point every test at your app; goto('/path') resolves against this.
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    // Evidence runs force traces with `--trace on` on the CLI (see the
    // pw-run-automated-tests workflow); tracing every routine run costs
    // runtime and artifact storage, so keep the default lean.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] } },
  ],
  // Uncomment to have Playwright start your dev server automatically:
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
