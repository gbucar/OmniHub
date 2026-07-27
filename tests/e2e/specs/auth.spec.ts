/**
 * Auth E2E tests — login, logout, redirect.
 *
 * Uses the base test (not authenticated fixture) to test the login flow.
 */

import { test, expect } from '@playwright/test';
import { expectErrorToast, expectSuccessToast } from '../helpers/selectors';

/** Shared helper: fill and submit the login form */
async function login(page: import('@playwright/test').Page, username: string, password: string) {
	await page.goto('/auth/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign In' }).click();
}

test.describe('Authentication', () => {
	test('AUTH-01 — login with valid credentials redirects to dashboard', async ({ page }) => {
		await login(page, 'admin_user', 'admin_geslo_123');
		await page.waitForURL('/');
		await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible();
	});

	test('AUTH-02 — login with wrong password shows error toast', async ({ page }) => {
		await login(page, 'admin_user', 'wrong_password');
		await expectErrorToast(page);
		await expect(page).toHaveURL(/\/auth\/login/);
	});

	test('AUTH-03 — login with empty fields triggers HTML5 validation', async ({ page }) => {
		await page.goto('/auth/login');
		await page.getByRole('button', { name: 'Sign In' }).click();
		// Should stay on login page — HTML5 required attribute prevents submission
		await expect(page).toHaveURL(/\/auth\/login/);
	});

	test('AUTH-04 — logout redirects to login', async ({ page }) => {
		// First login
		await login(page, 'admin_user', 'admin_geslo_123');
		await page.waitForURL('/');

		// Open hamburger menu
		await page.locator('.dropdown .btn-circle.btn-ghost').first().click();
		// Click Logout
		await page.getByRole('button', { name: /Logout/i }).click();

		await expect(page).toHaveURL(/\/auth\/login/);
	});

	test('AUTH-05 — unauthenticated user is redirected to login', async ({ page }) => {
		// Try to access /users without being logged in
		await page.goto('/users');
		await expect(page).toHaveURL(/\/auth\/login/);
	});

	test('AUTH-06 — after logout, protected routes redirect to login', async ({ page }) => {
		// Login first
		await login(page, 'admin_user', 'admin_geslo_123');
		await page.waitForURL('/');

		// Logout
		await page.locator('.dropdown .btn-circle.btn-ghost').first().click();
		await page.getByRole('button', { name: /Logout/i }).click();
		await expect(page).toHaveURL(/\/auth\/login/);

		// Try to access /users
		await page.goto('/users');
		await expect(page).toHaveURL(/\/auth\/login/);
	});
});
