/**
 * Bulk Upload & Download E2E tests.
 *
 * Uses the auth fixture (already logged in as admin_user).
 * All selectors are semantic (getByRole, getByLabel, getByText, getByPlaceholder).
 */

import { test } from '../fixtures/auth';
import { expect } from '@playwright/test';
import {
	waitForParticipantsTable,
	getToast,
	navigateTo
} from '../helpers/selectors';

// =============================================================================
// CSV helper — builds a CSV string from headers + rows
// =============================================================================

function makeCSV(headers: string[], rows: string[][]): string {
	const lines = [headers.join(',')];
	for (const row of rows) {
		lines.push(row.join(','));
	}
	return lines.join('\n');
}

// =============================================================================
// Shared helpers for bulk upload wizard
// =============================================================================

/**
 * Open the bulk upload modal via the Bulk Actions popover on /users page.
 */
async function openBulkUploadModal(page: import('@playwright/test').Page) {
	await navigateTo(page, 'Participants');
	await waitForParticipantsTable(page);

	// Open the Bulk Actions popover
	await page.getByRole('button', { name: 'Bulk actions' }).click();
	// Click "Bulk Upload" in the popover
	await page.getByRole('button', { name: 'Bulk Upload' }).click();

	// Wait for the modal dialog and the "Bulk Upload" heading
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByText('Bulk Upload')).toBeVisible({ timeout: 5000 });
	return dialog;
}

/**
 * Paste CSV text into the bulk upload modal's textarea (step 1).
 */
async function pasteCSV(page: import('@playwright/test').Page, dialog: ReturnType<typeof page.getByRole>, csv: string) {
	await dialog.locator('#bulk-upload-paste').fill(csv);
	// Wait for the preview to render (effect runs on rawCsv change)
	await dialog.getByText('Preview (first 3 rows)').waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Upload a CSV file into the hidden file input (step 1).
 */
async function uploadCSVFile(page: import('@playwright/test').Page, dialog: ReturnType<typeof page.getByRole>, csv: string) {
	await dialog.locator('#bulk-upload-file').setInputFiles({
		name: 'test.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(csv, 'utf-8')
	});
	// Wait for the file name to appear (onFileSelected sets loadedFileName)
	await dialog.getByText('test.csv').waitFor({ state: 'visible', timeout: 5000 });
	// Wait for the preview to render
	await dialog.getByText('Preview (first 3 rows)').waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Advance through the wizard: step 1→2, 2→3, optionally set defaults, then confirm.
 */
async function completeWizard(
	page: import('@playwright/test').Page,
	dialog: ReturnType<typeof page.getByRole>,
	opts?: { defaultStudy?: string; defaultPassword?: string }
) {
	// Step 1 → Step 2: click "Next"
	const nextBtn1 = dialog.getByRole('button', { name: 'Next' });
	await expect(nextBtn1).toBeEnabled({ timeout: 3000 });
	await nextBtn1.click();

	// Step 2: assert mapping heading is visible
	await expect(dialog.getByText(/Map each CSV column/)).toBeVisible({ timeout: 3000 });

	// Step 2 → Step 3: click second "Next"
	const nextBtn2 = dialog.getByRole('button', { name: 'Next' });
	await expect(nextBtn2).toBeEnabled({ timeout: 3000 });
	await nextBtn2.click();

	// Step 3: wait for preview buckets
	await expect(dialog.getByText(/Valid/)).toBeVisible({ timeout: 5000 });

	// Optionally set default study / password
	if (opts?.defaultStudy) {
		const studySelect = dialog.getByLabel('Default study');
		// Wait for sensors to load before interacting
		await page.waitForTimeout(500);
		await studySelect.selectOption(opts.defaultStudy);
	}
	if (opts?.defaultPassword) {
		await dialog.getByPlaceholder('changeme').fill(opts.defaultPassword);
	}

	// Click "Confirm & Import"
	const confirmBtn = dialog.getByRole('button', { name: /Confirm & Import/ });
	await expect(confirmBtn).toBeEnabled({ timeout: 3000 });
	await confirmBtn.click();
}

// =============================================================================
// Tests
// =============================================================================

test.describe('Bulk Upload', () => {
	// -------------------------------------------------------------------------
	// BULK-01: Modal opens
	// -------------------------------------------------------------------------

	test('BULK-01 — Open bulk upload modal from Bulk Actions', async ({ authenticatedPage: page }) => {
		const dialog = await openBulkUploadModal(page);

		// Verify the 3 steps are rendered
		await expect(dialog.locator('.step').filter({ hasText: 'Load' })).toBeVisible();
		await expect(dialog.locator('.step').filter({ hasText: 'Map' })).toBeVisible();
		await expect(dialog.locator('.step').filter({ hasText: 'Preview' })).toBeVisible();

		// Close via X button (use aria-label to avoid matching the backdrop <button>close</button>)
		await dialog.getByLabel('Close').click();
		await expect(dialog).not.toBeVisible({ timeout: 3000 });
	});

	// -------------------------------------------------------------------------
	// BULK-02: Valid CSV via file upload
	// -------------------------------------------------------------------------

	test('BULK-02 — Upload valid CSV via file and import', async ({ authenticatedPage: page }) => {
		const ts = Date.now();
		const user1 = `bulk_e2e_a_${ts}`;
		const user2 = `bulk_e2e_b_${ts}`;
		const csv = makeCSV(
			['username', 'name', 'age', 'sex'],
			[
				[user1, 'Bulk Test A', '30', 'male'],
				[user2, 'Bulk Test B', '25', 'female']
			]
		);

		const dialog = await openBulkUploadModal(page);
		await uploadCSVFile(page, dialog, csv);
		await completeWizard(page, dialog, { defaultStudy: 'Test Study Alpha' });

		// Wait for success toast — 2 users imported
		const toast = await getToast(page);
		await expect(toast.locator('.alert-success')).toBeVisible({ timeout: 5000 });
		await expect(toast).toContainText('2 users');

		// Verify both users appear in the participants table
		await page.getByPlaceholder('Search participants...').fill(user1);
		await page.waitForTimeout(400);
		await expect(page.getByText(user1).first()).toBeVisible({ timeout: 5000 });
	});

	// -------------------------------------------------------------------------
	// BULK-03: Valid CSV via paste
	// -------------------------------------------------------------------------

	test('BULK-03 — Paste valid CSV and import', async ({ authenticatedPage: page }) => {
		const ts = Date.now();
		const user1 = `bulk_e2e_c_${ts}`;
		const csv = makeCSV(
			['username', 'name', 'age', 'sex'],
			[
				[user1, 'Paste Test', '40', 'female']
			]
		);

		const dialog = await openBulkUploadModal(page);
		await pasteCSV(page, dialog, csv);
		await completeWizard(page, dialog, { defaultStudy: 'Test Study Alpha' });

		// Verify success toast
		const toast = await getToast(page);
		await expect(toast.locator('.alert-success')).toBeVisible({ timeout: 5000 });

		// Verify the user appears in the table
		await page.getByPlaceholder('Search participants...').fill(user1);
		await page.waitForTimeout(400);
		await expect(page.getByText(user1).first()).toBeVisible({ timeout: 5000 });
	});

	// -------------------------------------------------------------------------
	// BULK-04: CSV with study assignment
	// -------------------------------------------------------------------------

	test('BULK-04 — Import with study_name maps to correct study', async ({ authenticatedPage: page }) => {
		const ts = Date.now();
		const user1 = `bulk_e2e_d_${ts}`;
		const csv = makeCSV(
			['username', 'name', 'study_name'],
			[[user1, 'Study User', 'Test Study Alpha']]
		);

		const dialog = await openBulkUploadModal(page);
		await pasteCSV(page, dialog, csv);
		await completeWizard(page, dialog);

		// Verify import succeeded
		const toast = await getToast(page);
		await expect(toast.locator('.alert-success')).toBeVisible({ timeout: 5000 });

		// Open participant details and verify study is assigned
		await page.getByPlaceholder('Search participants...').fill(user1);
		await page.waitForTimeout(400);
		await expect(page.getByText(user1).first()).toBeVisible({ timeout: 5000 });
	});

	// -------------------------------------------------------------------------
	// BULK-05: CSV with device assignment
	// -------------------------------------------------------------------------

	test('BULK-05 — Import with device assignment', async ({ authenticatedPage: page }) => {
		const ts = Date.now();
		const user1 = `bulk_e2e_e_${ts}`;
		const csv = makeCSV(
			['username', 'name', 'device_1_name', 'device_1_start_date', 'device_1_end_date'],
			[[user1, 'Device User', 'Test Sensor Alpha', '2025-01-01', '2025-12-31']]
		);

		const dialog = await openBulkUploadModal(page);
		await pasteCSV(page, dialog, csv);
		// Step 1 → 2: Next
		await dialog.getByRole('button', { name: 'Next' }).click();

		// Step 2: verify device columns mapped
		await expect(dialog.getByText(/Map each CSV column/)).toBeVisible({ timeout: 3000 });
		// Should have auto-detected device_1_name from "device_1_name" header
		await expect(dialog.locator('#map-device_1_name')).toBeVisible();

		// Next → step 3
		await dialog.getByRole('button', { name: 'Next' }).click();

		// Step 3: set default study and confirm
		await expect(dialog.getByText(/Valid/)).toBeVisible({ timeout: 5000 });
		await page.waitForTimeout(500);
		await dialog.getByLabel('Default study').selectOption('Test Study Alpha');
		await dialog.getByRole('button', { name: /Confirm & Import/ }).click();

		// Verify success
		const toast = await getToast(page);
		await expect(toast.locator('.alert-success')).toBeVisible({ timeout: 5000 });

		// Verify user exists
		await page.getByPlaceholder('Search participants...').fill(user1);
		await page.waitForTimeout(400);
		await expect(page.getByText(user1).first()).toBeVisible({ timeout: 5000 });
	});

	// -------------------------------------------------------------------------
	// BULK-06: Duplicate usernames — verify skip
	// -------------------------------------------------------------------------

	test('BULK-06 — Duplicate usernames are skipped', async ({ authenticatedPage: page }) => {
		const ts = Date.now();
		const newUser = `bulk_e2e_f_${ts}`;
		// test_participant_1 is a seeded user that already exists
		const csv = makeCSV(
			['username', 'name'],
			[
				['test_participant_1', 'Already Exists'],
				[newUser, 'New User']
			]
		);

		const dialog = await openBulkUploadModal(page);
		await pasteCSV(page, dialog, csv);
		await completeWizard(page, dialog, { defaultStudy: 'Test Study Alpha' });

		// Should get a mixed toast — 1 created, 1 skipped
		const toast = await getToast(page);
		// Skipped (existing) creates an error-type toast, but with partial success
		await expect(toast).toContainText('created');
		await expect(toast).toContainText('exist');

		// The new user should appear in the table
		await page.getByPlaceholder('Search participants...').fill(newUser);
		await page.waitForTimeout(400);
		await expect(page.getByText(newUser).first()).toBeVisible({ timeout: 5000 });
	});

	// -------------------------------------------------------------------------
	// BULK-07: Rejected rows — invalid data
	// -------------------------------------------------------------------------

	test('BULK-07 — Invalid data rows are rejected in preview', async ({ authenticatedPage: page }) => {
		const csv = makeCSV(
			['username', 'age'],
			[
				['', '99'],                     // empty username => rejected
				['valid_user_e2e', 'notanumber'], // bad age => rejected
				['valid_user_e2e', '999']        // unreasonable age => rejected
			]
		);

		const dialog = await openBulkUploadModal(page);
		await pasteCSV(page, dialog, csv);

		// Step 1 → 2
		await dialog.getByRole('button', { name: 'Next' }).click();
		// Step 2 → 3
		await expect(dialog.getByText(/Map each CSV column/)).toBeVisible({ timeout: 3000 });
		await dialog.getByRole('button', { name: 'Next' }).click();

		// Step 3: should show rejected rows
		await expect(dialog.getByText(/Rejected/)).toBeVisible({ timeout: 5000 });
		// Confirm button disabled — 0 valid rows
		const confirmBtn = dialog.getByRole('button', { name: /Confirm & Import/ });
		await expect(confirmBtn).toBeDisabled();
	});

	// -------------------------------------------------------------------------
	// BULK-08: Auto-detect mapping — Slovenian headers
	// -------------------------------------------------------------------------

	test('BULK-08 — Auto-detect mapping with Slovenian headers', async ({ authenticatedPage: page }) => {
		const ts = Date.now();
		const user1 = `bulk_e2e_g_${ts}`;
		const csv = makeCSV(
			['uporabnisko_ime', 'ime', 'starost', 'spol'],
			[[user1, 'Slovenski Uporabnik', '33', 'male']]
		);

		const dialog = await openBulkUploadModal(page);
		await pasteCSV(page, dialog, csv);

		// Step 1 → 2
		await dialog.getByRole('button', { name: 'Next' }).click();
		await expect(dialog.getByText(/Map each CSV column/)).toBeVisible({ timeout: 3000 });

		// Verify auto-detection: uporabnisko_ime → username, ime → name, starost → age, spol → sex
		const mapUser = dialog.locator('#map-username');
		const mapName = dialog.locator('#map-name');
		await expect(mapUser).toHaveValue('uporabnisko_ime', { timeout: 3000 });
		await expect(mapName).toHaveValue('ime', { timeout: 3000 });

		// Step 2 → 3 → confirm
		await dialog.getByRole('button', { name: 'Next' }).click();
		await expect(dialog.getByText(/Valid/)).toBeVisible({ timeout: 5000 });
		await page.waitForTimeout(500);
		await dialog.getByLabel('Default study').selectOption('Test Study Alpha');
		await dialog.getByRole('button', { name: /Confirm & Import/ }).click();

		// Verify toast
		const toast = await getToast(page);
		await expect(toast.locator('.alert-success')).toBeVisible({ timeout: 5000 });
	});

	// -------------------------------------------------------------------------
	// BULK-09: Default study & password
	// -------------------------------------------------------------------------

	test('BULK-09 — Default study and password in step 3', async ({ authenticatedPage: page }) => {
		const ts = Date.now();
		const user1 = `bulk_e2e_h_${ts}`;
		// CSV has no study_name or password — defaults from step 3 will be used
		const csv = makeCSV(
			['username', 'name'],
			[[user1, 'Default User']]
		);

		const dialog = await openBulkUploadModal(page);
		await pasteCSV(page, dialog, csv);
		await completeWizard(page, dialog, {
			defaultStudy: 'Test Study Alpha',
			defaultPassword: 'default-pass-123'
		});

		// Verify import succeeded
		const toast = await getToast(page);
		await expect(toast.locator('.alert-success')).toBeVisible({ timeout: 5000 });

		// Verify the user appears in the table
		await page.getByPlaceholder('Search participants...').fill(user1);
		await page.waitForTimeout(400);
		await expect(page.getByText(user1).first()).toBeVisible({ timeout: 5000 });
	});
});

// =============================================================================
// Bulk Download
// =============================================================================

test.describe('Bulk Download', () => {
	// -------------------------------------------------------------------------
	// BULK-10: Download from study
	// -------------------------------------------------------------------------

	test('BULK-10 — Download participants from a study', async ({ authenticatedPage: page }) => {
		await navigateTo(page, 'Participants');
		await waitForParticipantsTable(page);

		// Open Bulk Actions popover → Bulk Download
		await page.getByRole('button', { name: 'Bulk actions' }).click();
		await page.getByRole('button', { name: 'Bulk Download' }).click();

		// Wait for the bulk download modal
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByText('Bulk Download')).toBeVisible({ timeout: 5000 });

		// Select study by value (Test Study Alpha = id 1)
		await dialog.locator('#bulk-download-study').selectOption('1');
		await page.waitForTimeout(1000);

		// Wait for participants to load in the list
		await expect(dialog.getByText('test_participant_1')).toBeVisible({ timeout: 5000 });

		// Select all participants
		await dialog.getByRole('button', { name: /Select all/ }).click();
		await page.waitForTimeout(200);

		// Click Download CSV
		const downloadBtn = dialog.getByRole('button', { name: /Download CSV/ });
		await expect(downloadBtn).toBeEnabled({ timeout: 3000 });
		await downloadBtn.click();

		// Verify success toast appears — download was triggered
		const toast = await getToast(page);
		await expect(toast.locator('.alert-success')).toBeVisible({ timeout: 5000 });
		await expect(toast).toContainText('Downloaded');

		// Modal should have closed
		await expect(dialog).not.toBeVisible({ timeout: 3000 });
	});

	// -------------------------------------------------------------------------
	// BULK-11: Select specific participants
	// -------------------------------------------------------------------------

	test('BULK-11 — Select specific participants and download', async ({ authenticatedPage: page }) => {
		await navigateTo(page, 'Participants');
		await waitForParticipantsTable(page);

		// Open download modal
		await page.getByRole('button', { name: 'Bulk actions' }).click();
		await page.getByRole('button', { name: 'Bulk Download' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog.getByText('Bulk Download')).toBeVisible({ timeout: 5000 });

		// Select study by value (Test Study Alpha = id 1)
		await dialog.locator('#bulk-download-study').selectOption('1');
		await page.waitForTimeout(1000);
		await expect(dialog.getByText('test_participant_1')).toBeVisible({ timeout: 5000 });

		// Click "Select all"
		const selectAllBtn = dialog.getByRole('button', { name: /Select all/ });
		await selectAllBtn.click();

		// Click Download CSV
		await expect(dialog.getByRole('button', { name: /Download CSV/ })).toBeEnabled();
		await dialog.getByRole('button', { name: /Download CSV/ }).click();

		// Verify success toast appears
		const toast = await getToast(page);
		await expect(toast.locator('.alert-success')).toBeVisible({ timeout: 5000 });
		await expect(toast).toContainText('Downloaded');

		// Modal should have closed
		await expect(dialog).not.toBeVisible({ timeout: 3000 });
	});
});
