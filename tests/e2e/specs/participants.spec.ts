/**
 * Participants E2E tests — search, filter, pagination, details panel,
 * add participant, add to study, assign device, edit, validation.
 *
 * Uses the auth fixture (already logged in as admin_user).
 * All selectors are semantic (getByRole, getByLabel, getByText, getByPlaceholder).
 */

import { test } from '../fixtures/auth';
import { expect } from '@playwright/test';
import {
	waitForParticipantsTable,
	openParticipantDetails,
	closeDetailsPanel,
	closeDetailsPanelWithButton,
	expectSuccessToast,
	expectErrorToast
} from '../helpers/selectors';

test.describe('Participants', () => {
	test.beforeEach(async ({ authenticatedPage: page }) => {
		// Fixture already navigates to /users via client-side link — no need for page.goto
		await page.waitForLoadState('networkidle');
	});

	// ---------------------------------------------------------------------------
	// Read-only tests (no data modification — rely on seeded data)
	// ---------------------------------------------------------------------------

	test('PRT-01 — Seznam participantov se pravilno naloži', async ({ authenticatedPage: page }) => {
		await waitForParticipantsTable(page);
		await expect(page.getByText('Ana Test')).toBeVisible();
		await expect(page.getByText('test_participant_1')).toBeVisible();
		await expect(page.getByText('Bojan Test')).toBeVisible();
	});

	test('PRT-02 — Iskanje po imenu', async ({ authenticatedPage: page }) => {
		await expect(page.getByText('Ana Test')).toBeVisible();
		await page.getByLabel('Search').fill('Ana');
		await page.waitForTimeout(400);
		await expect(page.getByText('Ana Test')).toBeVisible();
		await expect(page.getByText('Bojan Test')).not.toBeVisible();
	});

	test('PRT-03 — Iskanje po uporabniškem imenu', async ({ authenticatedPage: page }) => {
		await expect(page.getByText('Ana Test')).toBeVisible();
		await page.getByLabel('Search').fill('test_participant_4');
		await page.waitForTimeout(400);
		await expect(page.getByText('test_participant_4')).toBeVisible();
		await expect(page.getByText('David Test')).toBeVisible();
	});

	test('PRT-04 — Filter po študiji', async ({ authenticatedPage: page }) => {
		await expect(page.getByText('Ana Test')).toBeVisible();
		await page.getByLabel('Study').selectOption('Test Study Alpha');
		await page.waitForTimeout(500);
		await expect(page.getByText('Ana Test')).toBeVisible();
		await expect(page.getByText('Bojan Test')).toBeVisible();
		await expect(page.getByText('Cvetka Test')).toBeVisible();
		await expect(page.getByText('David Test')).not.toBeVisible();
	});

	test('PRT-05 — Paginacija — spreminjanje page size', async ({ authenticatedPage: page }) => {
		await expect(page.getByText('Ana Test')).toBeVisible();
		await page.getByLabel('Records per page').selectOption('10');
		await page.waitForTimeout(300);
		await expect(page.getByText('Ana Test')).toBeVisible();
	});

	test('PRT-06 — Paginacija — prev/next gumba', async ({ authenticatedPage: page }) => {
		// With 10 participants and pageSize=10, all fit on one page
		await expect(page.getByText('Ana Test')).toBeVisible();
		await page.getByLabel('Records per page').selectOption('10');
		await page.waitForTimeout(300);

		// Page indicator should show 1 / 1
		await expect(page.getByText('Page 1 of 1')).toBeVisible();

		// Next button disabled (only one page)
		const nextBtn = page.getByRole('button', { name: 'Next page' });
		await expect(nextBtn).toBeDisabled();

		// Previous button also disabled (already on first page)
		const prevBtn = page.getByRole('button', { name: 'Previous page' });
		await expect(prevBtn).toBeDisabled();
	});

	test('PRT-07 — "X of Y records" prikazuje pravilno', async ({ authenticatedPage: page }) => {
		await waitForParticipantsTable(page);
		await expect(page.getByText('Ana Test')).toBeVisible();
		await expect(page.getByText(/\d+ of \d+ records/)).toBeVisible();
	});

	test('PRT-08 — "No participants found" ob neobstoječem iskanju', async ({ authenticatedPage: page }) => {
		await expect(page.getByText('Ana Test')).toBeVisible();
		await page.getByLabel('Search').fill('ZZZ_NONEXISTENT_ZZZ');
		await page.waitForTimeout(500);
		await expect(page.getByText('No participants found')).toBeVisible();
	});

	// ---------------------------------------------------------------------------
	// Add participant / validation
	// ---------------------------------------------------------------------------

	test('PRT-09 — Dodajanje novega participanta', async ({ authenticatedPage: page }) => {
		const uniqueUsername = `e2e_new_user_${Date.now()}`;

		await expect(page.getByText('Ana Test')).toBeVisible();
		await page.getByRole('button', { name: 'Add Participant' }).click();
		await page.waitForSelector('dialog[open]');
		const dialog = page.locator('dialog[open]');

		await dialog.getByLabel('Username').fill(uniqueUsername);
		await dialog.getByPlaceholder('Enter password').fill('testpass123');
		await dialog.getByLabel('Name').fill('Test User');
		await dialog.getByLabel('Age').fill('30');
		await dialog.getByLabel('Sex').selectOption('male');

		await dialog.getByRole('button', { name: 'Create' }).click();
		await expectSuccessToast(page, 'Participant');

		// Search for the new user to verify it appears in table
		await page.getByLabel('Search').fill(uniqueUsername);
		await expect(page.getByText(uniqueUsername)).toBeVisible();
	});

	test('PRT-10 — Validacija — prazen username', async ({ authenticatedPage: page }) => {
		await page.getByRole('button', { name: 'Add Participant' }).click();
		await page.waitForSelector('dialog[open]');
		const dialog = page.locator('dialog[open]');

		// Leave username empty, click Create
		await dialog.getByRole('button', { name: 'Create' }).click();

		// Either HTML5 validation keeps form open or API rejects → error toast
		await expectErrorToast(page);
		// Dialog stays open after error
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Cancel' }).click();
	});

	// ---------------------------------------------------------------------------
	// Details panel (sidebar) — read-only interactions
	// ---------------------------------------------------------------------------

	test('PRT-11 — Odpiranje detajlov (sidebar)', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, 'test_participant_1');

		// Sidebar heading shows participant name
		await expect(page.getByRole('heading', { name: 'Ana Test' })).toBeVisible();
		// Username with @ prefix only appears in sidebar
		await expect(page.getByText('@test_participant_1')).toBeVisible();
	});

	test('PRT-19 — Sidebar — zapiranje z X gumbom', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, 'test_participant_1');
		await closeDetailsPanelWithButton(page);

		// Sidebar username text should be gone
		await expect(page.getByText('@test_participant_1')).not.toBeVisible();
	});

	test('PRT-20 — Sidebar — zapiranje s klikom na backdrop', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, 'test_participant_1');
		await closeDetailsPanel(page);

		// Sidebar username text should be gone
		await expect(page.getByText('@test_participant_1')).not.toBeVisible();
	});

	// ---------------------------------------------------------------------------
	// Sidebar — edit personal info / validation
	// ---------------------------------------------------------------------------

	test('PRT-12 — Sidebar — edit personal info', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, 'test_participant_1');

		// Enter edit mode — wait for Edit button to be visible in the sidebar
		const editButton = page.getByRole('button', { name: 'Edit' });
		await editButton.waitFor({ state: 'visible' });
		await editButton.click();

		// Wait for form fields to appear after clicking Edit
		await page.getByRole('textbox', { name: 'Name' }).waitFor({ state: 'visible' });
		await page.getByRole('textbox', { name: 'Name' }).fill('Ana Modified');
		await page.getByRole('spinbutton', { name: 'Age' }).fill('26');
		await page.getByRole('button', { name: 'Save' }).click();

		await expectSuccessToast(page, 'updated');

		// Sidebar stays open with updated heading
		await expect(page.getByRole('heading', { name: 'Ana Modified' })).toBeVisible();

		// Close and reopen to verify persistence in database
		await closeDetailsPanelWithButton(page);
		await openParticipantDetails(page, 'test_participant_1');
		await expect(page.getByRole('heading', { name: 'Ana Modified' })).toBeVisible();
	});

	test('PRT-13 — Sidebar — validacija imena (samo črke)', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, 'test_participant_2');

		const editButton = page.getByRole('button', { name: 'Edit' });
		await editButton.waitFor({ state: 'visible' });
		await editButton.click();

		// Wait for the form fields to be visible in edit mode
		await page.getByRole('textbox', { name: 'Name' }).waitFor({ state: 'visible' });
		await page.getByRole('textbox', { name: 'Name' }).fill('Bojan123');
		await page.getByRole('button', { name: 'Save' }).click();

		// Name validation rejects digits: "Name can only contain letters"
		await expectErrorToast(page);
	});

	test('PRT-14 — Sidebar — Cancel urejanja', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, 'test_participant_2');

		const editButton = page.getByRole('button', { name: 'Edit' });
		await editButton.waitFor({ state: 'visible' });
		await editButton.click();

		// Wait for the form fields to be visible in edit mode
		await page.getByRole('textbox', { name: 'Name' }).waitFor({ state: 'visible' });
		await page.getByRole('textbox', { name: 'Name' }).fill('Temp Name');
		await page.getByRole('button', { name: 'Cancel' }).click();

		// After cancel, we are back in display mode (Edit button visible)
		await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
		// The temp name should NOT be visible anywhere
		await expect(page.getByText('Temp Name')).not.toBeVisible();
		// The original name should still show
		await expect(page.getByRole('heading', { name: 'Bojan Test' })).toBeVisible();
	});

	// ---------------------------------------------------------------------------
	// Sidebar — study / device operations
	// ---------------------------------------------------------------------------

	test('PRT-15 — Sidebar — dodajanje v študijo', async ({ authenticatedPage: page }) => {
		// test_participant_4 is in Beta, not Alpha — so Alpha should be available
		await openParticipantDetails(page, 'test_participant_4');

		await page.getByRole('button', { name: 'Add' }).click();

		// Wait for the Add to Study dialog to open
		await expect(page.getByRole('heading', { name: 'Add to Study' })).toBeVisible();
		const dialog = page.getByRole('dialog');

		// Select first available study (Test Study Alpha)
		await dialog.getByLabel('Select Study').selectOption({ index: 1 });

		const today = new Date().toISOString().split('T')[0];
		const nextYear = new Date();
		nextYear.setFullYear(nextYear.getFullYear() + 1);
		const endDate = nextYear.toISOString().split('T')[0];

		await dialog.getByLabel('Start Date').fill(today);
		await dialog.getByLabel('End Date').fill(endDate);

		await dialog.getByRole('button', { name: 'Add to Study' }).click();
		await expectSuccessToast(page, 'study');
	});

	test('PRT-16 — Sidebar — edit study membership period', async ({ authenticatedPage: page }) => {
		// test_participant_1 is already in Alpha with a membership period
		await openParticipantDetails(page, 'test_participant_1');

		await page.getByLabel('Edit study').click();

		// Wait for edit mode date inputs to appear
		await page.getByLabel('Edit start date').waitFor({ state: 'visible' });

		const today = new Date().toISOString().split('T')[0];
		const nextYear = new Date();
		nextYear.setFullYear(nextYear.getFullYear() + 1);
		const endDate = nextYear.toISOString().split('T')[0];

		await page.getByLabel('Edit start date').fill(today);
		await page.getByLabel('Edit end date').fill(endDate);

		await page.getByLabel('Save changes').click();
		await expectSuccessToast(page, 'period');
	});

	test('PRT-17 — Sidebar — assign naprave', async ({ authenticatedPage: page }) => {
		// test_participant_4 has NO device assigned (good candidate for assignment)
		await openParticipantDetails(page, 'test_participant_4');

		await page.getByRole('button', { name: 'Assign' }).click();

		// Wait for Assign Device modal (custom dialog, not HTML <dialog>)
		await expect(page.getByRole('heading', { name: 'Assign Device' })).toBeVisible();

		// Scope to the dialog for all subsequent interactions
		const dialog = page.getByRole('dialog', { name: 'Assign Device' });

		// Type sensor name to filter the dropdown
		await dialog.getByLabel('Select Sensor').fill('Test Sensor Beta');

		// Click the matching option from the dropdown
		const option = page.getByRole('option', { name: 'Test Sensor Beta' });
		await option.waitFor({ state: 'visible' });
		await option.click();

		const today = new Date().toISOString().split('T')[0];
		const nextYear = new Date();
		nextYear.setFullYear(nextYear.getFullYear() + 1);
		const endDate = nextYear.toISOString().split('T')[0];

		await dialog.getByLabel('Start Date').fill(today);
		await dialog.getByLabel('End Date').fill(endDate);

		// Submit via the dialog's Assign button
		await dialog.getByRole('button', { name: 'Assign' }).click();

		await expectSuccessToast(page, 'Device');
	});

	test('PRT-18 — Sidebar — edit ownership period', async ({ authenticatedPage: page }) => {
		// test_participant_1 has Test Sensor Alpha assigned (from seed data)
		await openParticipantDetails(page, 'test_participant_1');

		await page.getByLabel('Edit device').click();

		// Wait for edit mode date inputs to appear
		await page.getByLabel('Edit start date').waitFor({ state: 'visible' });

		const today = new Date().toISOString().split('T')[0];
		const nextYear = new Date();
		nextYear.setFullYear(nextYear.getFullYear() + 1);
		const endDate = nextYear.toISOString().split('T')[0];

		await page.getByLabel('Edit start date').fill(today);
		await page.getByLabel('Edit end date').fill(endDate);

		await page.getByLabel('Save changes').click();
		await expectSuccessToast(page, 'updated');
	});

	// ---------------------------------------------------------------------------
	// Toast verification
	// ---------------------------------------------------------------------------

	test('PRT-21 — Success toast po dodajanju participanta', async ({ authenticatedPage: page }) => {
		const uniqueUsername = `e2e_toast_${Date.now()}`;

		await page.getByRole('button', { name: 'Add Participant' }).click();

		// Wait for the dialog to open and scope all interactions
		await expect(page.getByRole('heading', { name: 'Add Participant' })).toBeVisible();
		const dialog = page.getByRole('dialog');

		await dialog.getByLabel('Username').fill(uniqueUsername);
		await dialog.getByPlaceholder('Enter password').fill('testpass123');
		await dialog.getByLabel('Name').fill('Toast User');
		await dialog.getByLabel('Age').fill('25');
		await dialog.getByLabel('Sex').selectOption('female');

		await dialog.getByRole('button', { name: 'Create' }).click();

		// Success toast should appear with text mentioning participant / success
		await expectSuccessToast(page, 'Participant');
		await expect(page.getByText('Participant added successfully')).toBeVisible();
	});

	test('PRT-22 — Error toast ob validacijski napaki', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, 'test_participant_3');

		const editButton = page.getByRole('button', { name: 'Edit' });
		await editButton.waitFor({ state: 'visible' });
		await editButton.click();

		// Wait for the form field to appear in edit mode
		await page.getByRole('textbox', { name: 'Name' }).waitFor({ state: 'visible' });
		await page.getByRole('textbox', { name: 'Name' }).fill('Cvetka123');
		await page.getByRole('button', { name: 'Save' }).click();

		// Name validation rejects digits: "Name can only contain letters"
		await expectErrorToast(page);
	});
});
