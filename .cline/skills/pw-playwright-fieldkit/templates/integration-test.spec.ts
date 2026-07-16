// Integration test template. Copy into your project's tests/ folder and adapt.
//
// The findings from `crawl.mjs` / `inspect.mjs` tell you WHAT to test:
//   - each form in the report  -> a "happy path" + a "validation error" test
//   - each error page          -> a regression test asserting it now loads clean
//   - each user journey         -> an end-to-end flow test
//
// Prefer user-facing locators (getByRole/getByLabel/getByText) over CSS/XPath —
// they survive refactors and read like the user's intent.

import { test, expect } from '@playwright/test';

test.describe('Example feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/'); // baseURL comes from playwright.config.ts
  });

  test('happy path: user can submit the form', async ({ page }) => {
    // Arrange — locate by what the user sees.
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('correct horse battery staple');

    // Act
    await page.getByRole('button', { name: /log in|sign in/i }).click();

    // Assert — verify the OUTCOME, not an implementation detail.
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  });

  test('validation: empty submit shows an error', async ({ page }) => {
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await expect(page.getByText(/required|enter your/i)).toBeVisible();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0);
  });
});
