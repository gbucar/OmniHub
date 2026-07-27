/**
 * Navigation E2E tests — navbar, hamburger dropdown, theme toggle.
 */

import { test, expect } from '@playwright/test';
import { test as authTest } from '../fixtures/auth';

test.describe('Navigation', () => {
	test('NAV-01 — navbar links navigate to correct pages', async ({ page }) => {
		// Login manually
		await page.goto('/auth/login');
		await page.getByLabel('Username').fill('admin_user');
		await page.getByLabel('Password').fill('admin_geslo_123');
		await page.getByRole('button', { name: 'Sign In' }).click();
		await page.waitForURL('/');

		// Click Participants link
		await page.getByRole('link', { name: /Participants/ }).first().click();
		await expect(page).toHaveURL('/users');
		await expect(page.getByRole('heading', { name: 'Participants' })).toBeVisible();

		// Click Devices link
		await page.getByRole('link', { name: /Devices/ }).first().click();
		await expect(page).toHaveURL('/devices');
		await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible();

		// Click Dashboard link
		await page.getByRole('link', { name: /Dashboard/ }).first().click();
		await expect(page).toHaveURL('/');
		await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible();
	});

	test('NAV-02 — hamburger dropdown contains Users, Devices, Logout', async ({ page }) => {
		await page.goto('/auth/login');
		await page.getByLabel('Username').fill('admin_user');
		await page.getByLabel('Password').fill('admin_geslo_123');
		await page.getByRole('button', { name: 'Sign In' }).click();
		await page.waitForURL('/');

		// Open hamburger menu — it's the last btn-circle in the header
		// We target the dropdown trigger button
		const dropdownTrigger = page.locator('.dropdown-end .btn-circle.btn-ghost').first();
		await dropdownTrigger.click();

		// Check menu items
		await expect(page.getByRole('link', { name: /Users/ }).last()).toBeVisible();
		await expect(page.getByRole('link', { name: /Devices/ }).last()).toBeVisible();
		await expect(page.getByRole('button', { name: /Logout/ })).toBeVisible();
	});

	test('NAV-03 — theme toggle changes theme', async ({ page }) => {
		await page.goto('/auth/login');
		await page.getByLabel('Username').fill('admin_user');
		await page.getByLabel('Password').fill('admin_geslo_123');
		await page.getByRole('button', { name: 'Sign In' }).click();
		await page.waitForURL('/');

		// Get initial theme
		const initialTheme = await page.evaluate(() =>
			document.documentElement.getAttribute('data-theme')
		);

		// Click theme toggle (the sun/moon button)
		await page.getByRole('button', { name: /theme/i }).click();

		// Theme should have changed
		const newTheme = await page.evaluate(() =>
			document.documentElement.getAttribute('data-theme')
		);
		expect(newTheme).not.toBe(initialTheme);
	});

	test('NAV-04 — theme persists after page reload', async ({ page }) => {
		await page.goto('/auth/login');
		await page.getByLabel('Username').fill('admin_user');
		await page.getByLabel('Password').fill('admin_geslo_123');
		await page.getByRole('button', { name: 'Sign In' }).click();
		await page.waitForURL('/');

		// Set theme explicitly
		await page.getByRole('button', { name: /theme/i }).click();
		await page.waitForTimeout(200);

		const themeBeforeReload = await page.evaluate(() =>
			document.documentElement.getAttribute('data-theme')
		);

		// Reload
		await page.reload();
		await page.waitForURL('/');

		const themeAfterReload = await page.evaluate(() =>
			document.documentElement.getAttribute('data-theme')
		);

		expect(themeAfterReload).toBe(themeBeforeReload);
	});
});
