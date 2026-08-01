/**
 * Auth fixture — provides an authenticated page for tests.
 *
 * Usage:
 *   import { test } from '../fixtures/auth';
 *   test('my test', async ({ authenticatedPage }) => {
 *     await authenticatedPage.goto('/devices');
 *     // page is already logged in as admin_user
 *   });
 */

import { test as base, type Page, expect as playExpect } from '@playwright/test';

const ADMIN_USERNAME = 'admin_user';
const ADMIN_PASSWORD = 'admin_geslo_123';

export type AuthFixtures = {
	authenticatedPage: Page;
};

/**
 * Extended test with `authenticatedPage` fixture.
 * Logs in as admin_user and returns a page that can be used for
 * authenticated test scenarios.
 */
export const test = base.extend<AuthFixtures>({
	authenticatedPage: async ({ page }, use) => {
		await page.goto('/auth/login');
		await page.getByLabel('Username').fill(ADMIN_USERNAME);
		await page.getByPlaceholder('Enter your password').fill(ADMIN_PASSWORD);
		await page.getByRole('button', { name: 'Sign In' }).click();
		await page.waitForURL('/');

		// Navigate to devices via SvelteKit client-side link (preserves auth)
		// /users would be empty since seed now only has admin_user
		await page.getByRole('link', { name: /Devices/ }).first().click();
		await page.waitForURL('/devices');
		await page.waitForLoadState('networkidle');
		await use(page);
	}
});

export { playExpect as expect } from '@playwright/test';
