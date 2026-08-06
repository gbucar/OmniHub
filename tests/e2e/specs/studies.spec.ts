/**
 * Studies E2E tests — add study, validation.
 */

import { test } from '../fixtures/auth';
import { expect } from '@playwright/test';
import { expectSuccessToast, createStudy, navigateTo } from '../helpers/selectors';

test.describe('Studies', () => {
	let createdStudyName: string;

	test.beforeEach(async ({ authenticatedPage: page }) => {
		// Auth fixture starts on dashboard (/). Navigate to participants where studies are managed.
		await navigateTo(page, 'Participants');
		await page.waitForLoadState('networkidle');
	});

	// ---------------------------------------------------------------------------
	// Add study
	// ---------------------------------------------------------------------------

	test('STD-01 — add a new study via modal', async ({ authenticatedPage: page }) => {
		// Create a study for this test
		const uniqueStudyName = `e2e_study_${Date.now()}`;
		await createStudy(page, uniqueStudyName, new Date().toISOString().split('T')[0], new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]);

		// Study appears in the Study filter dropdown (only visible in table when assigned)
		await expect(page.getByRole('option', { name: uniqueStudyName }).first()).toBeAttached();
	});

	test('STD-02 — empty study name disables create button', async ({ authenticatedPage: page }) => {
		await page.getByRole('button', { name: 'Add Study' }).click();
		await page.waitForSelector('dialog[open]');
		const dialog = page.locator('dialog[open]');

		// Leave name empty, fill dates
		const today = new Date().toISOString().split('T')[0];
		await dialog.getByLabel('Start Date').fill(today);
		await dialog.getByLabel('End Date').fill(today);

		// Create button should be disabled when name is empty
		const createBtn = dialog.getByRole('button', { name: 'Create' });
		await expect(createBtn).toBeDisabled();
	});

	test('STD-03 — end date before start date shows inline error', async ({ authenticatedPage: page }) => {
		await page.getByRole('button', { name: 'Add Study' }).click();
		await page.waitForSelector('dialog[open]');
		const dialog = page.locator('dialog[open]');

		const today = new Date().toISOString().split('T')[0];
		const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

		await dialog.getByLabel('Study Name').fill(`E2E Invalid Study ${Date.now()}`);
		await dialog.getByLabel('Start Date').fill(today);
		await dialog.getByLabel('End Date').fill(yesterday);

		// Inline error alert should be visible inside the dialog
		await expect(dialog.locator('.alert-error')).toBeVisible();
		await expect(dialog.locator('.alert-error')).toContainText('End date must be on or after start date');

		// Create button should be disabled
		const createBtn = dialog.getByRole('button', { name: 'Create' });
		await expect(createBtn).toBeDisabled();
	});
});
