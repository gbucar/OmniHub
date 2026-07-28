/**
 * Studies E2E tests — add study, validation.
 */

import { test } from '../fixtures/auth';
import { expect } from '@playwright/test';
import { expectSuccessToast, expectErrorToast } from '../helpers/selectors';

test.describe('Studies', () => {
	test.beforeEach(async ({ authenticatedPage: page }) => {
		// Fixture already navigates to /users via client-side link
		await page.waitForLoadState('networkidle');
	});

	test('STD-01 — add a new study via modal', async ({ authenticatedPage: page }) => {
		// Click "Add Study" button
		await page.getByRole('button', { name: 'Add Study' }).click();

		// Wait for modal
		await page.waitForSelector('dialog[open]');
		const dialog = page.locator('dialog[open]');

		// Fill in study details
		const today = new Date();
		const startDate = today.toISOString().split('T')[0];
		const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
		const endDate = nextYear.toISOString().split('T')[0];

		await dialog.getByLabel('Study Name').fill(`E2E Test Study ${Date.now()}`);
		await dialog.getByLabel('Start Date').fill(startDate);
		await dialog.getByLabel('End Date').fill(endDate);

		// Submit (button text is "Create")
		await dialog.getByRole('button', { name: 'Create' }).click();

		// Expect success toast
		await expectSuccessToast(page, 'Study');
	});

	test('STD-02 — empty study name shows validation error', async ({ authenticatedPage: page }) => {
		await page.getByRole('button', { name: 'Add Study' }).click();
		await page.waitForSelector('dialog[open]');
		const dialog = page.locator('dialog[open]');

		// Leave name empty, fill dates
		const today = new Date().toISOString().split('T')[0];
		await dialog.getByLabel('Start Date').fill(today);
		await dialog.getByLabel('End Date').fill(today);

		// Submit (button text is "Create")
		await dialog.getByRole('button', { name: 'Create' }).click();

		// Should show error toast (from handleAddStudy validation)
		await expectErrorToast(page);
	});

	test('STD-03 — end date before start date shows validation error', async ({ authenticatedPage: page }) => {
		await page.getByRole('button', { name: 'Add Study' }).click();
		await page.waitForSelector('dialog[open]');
		const dialog = page.locator('dialog[open]');

		const today = new Date().toISOString().split('T')[0];
		const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

		await dialog.getByLabel('Study Name').fill(`E2E Invalid Study ${Date.now()}`);
		await dialog.getByLabel('Start Date').fill(today);
		await dialog.getByLabel('End Date').fill(yesterday);

		await dialog.getByRole('button', { name: 'Create' }).click();

		// Should show error about dates
		await expectErrorToast(page);
	});
});
