/**
 * Participants E2E tests — two describe blocks:
 *   1. Participants — Table basics (PRT-01 to PRT-08): read-only table interactions
 *   2. Participants — CRUD & Sidebar (PRT-09 to PRT-22): create, edit, study, device
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
	expectErrorToast,
	navigateTo,
	createParticipant
} from '../helpers/selectors';

// =============================================================================
// Block A — Table basics (read-only, relies on seeded data)
// =============================================================================

test.describe('Participants — Table basics', () => {
	test.beforeEach(async ({ authenticatedPage: page }) => {
		await navigateTo(page, 'Participants');
		await waitForParticipantsTable(page);
	});

	// -----------------------------------------------------------------------
	// Table loading & seeded data
	// -----------------------------------------------------------------------

	test('PRT-01 — Table loads with seeded participants', async ({ authenticatedPage: page }) => {
		await expect(page.getByText('Ana Test')).toBeVisible();
		await expect(page.getByText('Bojan Test')).toBeVisible();
	});

	test('PRT-02 — Record counter', async ({ authenticatedPage: page }) => {
		await expect(page.getByText(/records/)).toBeVisible();
	});

	// -----------------------------------------------------------------------
	// Search
	// -----------------------------------------------------------------------

	test('PRT-03 — Search by username', async ({ authenticatedPage: page }) => {
		await page.getByLabel('Search').fill('test_participant_1');
		await page.waitForTimeout(400);

		await expect(page.getByText('test_participant_1')).toBeVisible();
		await expect(page.getByText('test_participant_2')).not.toBeVisible();
	});

	test('PRT-04 — Search by name', async ({ authenticatedPage: page }) => {
		await page.getByLabel('Search').fill('Ana');
		await page.waitForTimeout(400);

		await expect(page.getByText('Ana Test')).toBeVisible();
		await expect(page.getByText('Bojan Test')).not.toBeVisible();
	});

	test('PRT-05 — Empty state on non-existent search', async ({ authenticatedPage: page }) => {
		await page.getByLabel('Search').fill('ZZZ_NONEXISTENT');
		await page.waitForTimeout(400);

		await expect(page.getByText('No participants found')).toBeVisible();
	});

	// -----------------------------------------------------------------------
	// Filter
	// -----------------------------------------------------------------------

	test('PRT-06 — Filter by study', async ({ authenticatedPage: page }) => {
		await page.locator('#study-filter').selectOption('Test Study Alpha');
		await page.waitForTimeout(400);

		// Ana and Bojan are in Test Study Alpha
		await expect(page.getByText('Ana Test')).toBeVisible();
		await expect(page.getByText('Bojan Test')).toBeVisible();
	});

	// -----------------------------------------------------------------------
	// Pagination
	// -----------------------------------------------------------------------

	test('PRT-07 — Prev/Next buttons disabled on single page', async ({ authenticatedPage: page }) => {
		// Set the largest page size so all records fit on one page
		await page.getByLabel('Records per page').selectOption('500');

		// With all records on one page, both buttons should be disabled
		await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
	});

	test('PRT-08 — Change page size', async ({ authenticatedPage: page }) => {
		await page.getByLabel('Records per page').selectOption('10');

		// Table should still display results after page-size change
		await expect(page.getByText('Ana Test')).toBeVisible();
	});

	test('PRT-23 — Page navigation with 3 records per page', async ({ authenticatedPage: page }) => {
		// Add one extra participant so we have 6 total (5 seeded + 1 new).
		// With pageSize=3 that gives 2 pages to navigate between.
		const ts = Date.now();
		await createParticipant(
			page,
			`e2e_paginate_${ts}`,
			'testpass123',
			`Paginate User ${ts}`,
			30,
			'male'
		);

		// createParticipant leaves the search field filled with the new username.
		// Clear it so we see ALL participants.
		await page.getByLabel('Search').clear();
		await page.waitForTimeout(400);

		// Set page size to 3 — should produce 2 pages (6 participants)
		await page.getByLabel('Records per page').selectOption('3');
		await page.waitForTimeout(500);

		// Page 1: Next should be enabled, Previous disabled
		await expect(page.getByText(/Page 1 of/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Next page' })).toBeEnabled();
		await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();

		// Navigate to page 2
		await page.getByRole('button', { name: 'Next page' }).click();
		await page.waitForTimeout(500);
		await expect(page.getByText(/Page 2 of/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Previous page' })).toBeEnabled();

		// Navigate back to page 1
		await page.getByRole('button', { name: 'Previous page' }).click();
		await page.waitForTimeout(500);
		await expect(page.getByText(/Page 1 of/)).toBeVisible();
	});
});

// =============================================================================
// Block B — CRUD & Sidebar (creates a fresh participant per test run)
// =============================================================================

test.describe('Participants — CRUD & Sidebar', () => {
	let createdUsername: string;
	let createdName: string;

	test.beforeEach(async ({ authenticatedPage: page }) => {
		// Auth fixture starts on dashboard (/). Navigate to participants page.
		await navigateTo(page, 'Participants');
		await waitForParticipantsTable(page);

		// Create a new participant with a unique, letters-only name
		// (edit validation rejects digits — "Name can only contain letters")
		const ts = Date.now();
		const letters = 'abcdefghijklmnopqrstuvwxyz';
		createdName = `Test User ${letters[ts % 26]}${letters[Math.floor(ts / 26) % 26]}`;
		createdUsername = `e2e_participant_${ts}`;
		await createParticipant(page, createdUsername, 'testpass123', createdName, '30', 'male');
	});

	// ---------------------------------------------------------------------------
	// Add participant / validation
	// ---------------------------------------------------------------------------

	test('PRT-09 — Dodajanje novega participanta', async ({ authenticatedPage: page }) => {
		const uniqueUsername = `e2e_new_user_${Date.now()}`;

		await expect(page.getByText(createdName)).toBeVisible();
		await page.getByRole('button', { name: 'Add Participant' }).click();

		// Wait for the dialog heading to appear before scoping
		await expect(page.getByRole('heading', { name: 'Add Participant' })).toBeVisible();
		const dialog = page.getByRole('dialog');

		await dialog.getByLabel('Username').fill(uniqueUsername);
		// PasswordInput component uses placeholder, not a label association
		await dialog.getByPlaceholder('Enter password').fill('testpass123');
		await dialog.locator('#modal-name').fill(createdName);
		await dialog.locator('#modal-age').fill('30');
		await dialog.locator('#modal-sex').selectOption('male');

		// Scope to dialog to avoid ambiguity with other "Create" buttons
		await dialog.getByRole('button', { name: 'Create' }).click();
		await expectSuccessToast(page, 'Participant');

		// Search for the new user to verify it appears in table
		await page.getByLabel('Search').fill(uniqueUsername);
		await expect(page.getByText(uniqueUsername)).toBeVisible();
	});

	test('PRT-10 — Validacija — prazen username', async ({ authenticatedPage: page }) => {
		await page.getByRole('button', { name: 'Add Participant' }).click();

		// Wait for dialog to fully render (heading + form fields)
		await expect(page.getByRole('heading', { name: 'Add Participant' })).toBeVisible();
		const dialog = page.getByRole('dialog');

		// Leave username empty — wait for the field to be interactive first
		const usernameField = dialog.getByLabel('Username');
		await usernameField.waitFor({ state: 'visible' });
		await usernameField.clear();

		await dialog.getByPlaceholder('Enter password').fill('testpass123');

		// Click Create — API rejects empty username, dialog stays open
		const createBtn = dialog.getByRole('button', { name: 'Create' });
		await createBtn.waitFor({ state: 'visible' });
		await createBtn.click();

		// Dialog stays open (API returned error — empty username not allowed)
		await expect(dialog).toBeVisible();

		// Close dialog via Cancel
		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect(dialog).not.toBeVisible();
	});

	// ---------------------------------------------------------------------------
	// Details panel (sidebar) — read-only interactions
	// ---------------------------------------------------------------------------

	test('PRT-11 — Odpiranje detajlov (sidebar)', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, createdUsername);

		// Sidebar heading shows participant name
		await expect(page.getByRole('heading', { name: createdName })).toBeVisible();
		// Username with @ prefix only appears in sidebar
		await expect(page.getByText(`@${createdUsername}`)).toBeVisible();
	});

	test('PRT-19 — Sidebar — zapiranje z X gumbom', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, createdUsername);
		await closeDetailsPanelWithButton(page);

		// Sidebar username text should be gone
		await expect(page.getByText(`@${createdUsername}`)).not.toBeVisible();
	});

	test('PRT-20 — Sidebar — zapiranje s klikom na backdrop', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, createdUsername);
		await closeDetailsPanel(page);

		// Sidebar username text should be gone
		await expect(page.getByText(`@${createdUsername}`)).not.toBeVisible();
	});

	// ---------------------------------------------------------------------------
	// Sidebar — edit personal info / validation
	// ---------------------------------------------------------------------------

	test('PRT-12 — Sidebar — edit personal info', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, createdUsername);
		await page.waitForTimeout(300);

		// Enter edit mode — wait for Edit button to be visible in the sidebar
		const editButton = page.getByRole('button', { name: 'Edit' }).first();
		await editButton.waitFor({ state: 'visible' });
		await editButton.click();

		// Wait for form fields to appear after clicking Edit
		const modifiedName = `${createdName} Modified`;
		await page.locator('#edit-name').waitFor({ state: 'visible' });
		await page.locator('#edit-name').fill(modifiedName);
		await page.locator('#edit-age').waitFor({ state: 'visible' });
		await page.locator('#edit-age').fill('31');
		await page.getByRole('button', { name: 'Save' }).first().click();

		await expectSuccessToast(page, 'updated');

		// Sidebar stays open with updated heading
		await expect(page.getByRole('heading', { name: modifiedName })).toBeVisible();

		// Close and reopen to verify persistence in database
		await closeDetailsPanelWithButton(page);
		await openParticipantDetails(page, createdUsername);
		await expect(page.getByRole('heading', { name: modifiedName })).toBeVisible();
	});

	test('PRT-13 — Sidebar — validacija imena (samo črke)', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, createdUsername);
		await page.waitForTimeout(300);

		const editButton = page.getByRole('button', { name: 'Edit' }).first();
		await editButton.waitFor({ state: 'visible' });
		await editButton.click();

		// Wait for the form fields to be visible in edit mode
		await page.locator('#edit-name').waitFor({ state: 'visible' });
		await page.locator('#edit-name').fill('TestUser123');
		await page.getByRole('button', { name: 'Save' }).first().click();

		// Name validation rejects digits: "Name can only contain letters"
		await expectErrorToast(page);
	});

	test('PRT-14 — Sidebar — Cancel urejanja', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, createdUsername);
		await page.waitForTimeout(300);

		const editButton = page.getByRole('button', { name: 'Edit' }).first();
		await editButton.waitFor({ state: 'visible' });
		await editButton.click();

		// Wait for the form fields to be visible in edit mode
		await page.locator('#edit-name').waitFor({ state: 'visible' });
		await page.locator('#edit-name').fill('Temp Name');
		await page.getByRole('button', { name: 'Cancel' }).first().click();

		// After cancel, we are back in display mode (Edit button visible)
		await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible();
		// The temp name should NOT be visible anywhere
		await expect(page.getByText('Temp Name')).not.toBeVisible();
		// The original name should still show
		await expect(page.getByRole('heading', { name: createdName })).toBeVisible();
	});

	// ---------------------------------------------------------------------------
	// Sidebar — study / device operations
	// ---------------------------------------------------------------------------

	test('PRT-15 — Sidebar — dodajanje v študijo', async ({ authenticatedPage: page }) => {
		// test_participant_4 is in Beta, not Alpha — so Alpha should be available
		await openParticipantDetails(page, createdUsername);
		await page.waitForTimeout(300);

		await page.getByRole('button', { name: 'Add', exact: true }).click();

		// Wait for the Add to Study dialog to open
		await expect(page.getByRole('heading', { name: 'Add to Study' })).toBeVisible();
		const dialog = page.getByRole('dialog');

		// Available studies list is a $derived reactive computation — wait for
		// options to be populated before trying to select one.
		await dialog.locator('#select-study option[value]:not([value=""])').first().waitFor({ state: 'attached' });

		// Select first available study (Test Study Alpha)
		await dialog.locator('#select-study').selectOption({ index: 1 });

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
		// Step 1: First add the dynamic user to a study (like PRT-15)
		await openParticipantDetails(page, createdUsername);
		await page.waitForTimeout(300);

		await page.getByRole('button', { name: 'Add', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Add to Study' })).toBeVisible();
		const addDialog = page.getByRole('dialog');
		await addDialog.locator('#select-study option[value]:not([value=""])').first().waitFor({ state: 'attached' });
		await addDialog.locator('#select-study').selectOption({ index: 1 });

		const today = new Date().toISOString().split('T')[0];
		const nextYear = new Date();
		nextYear.setFullYear(nextYear.getFullYear() + 1);
		const endDate = nextYear.toISOString().split('T')[0];

		await addDialog.getByLabel('Start Date').fill(today);
		await addDialog.getByLabel('End Date').fill(endDate);
		await addDialog.getByRole('button', { name: 'Add to Study' }).click();
		await expectSuccessToast(page, 'study');

		// Step 2: Now edit the membership period
		await page.waitForTimeout(500); // let sidebar update after study assignment
		await page.getByLabel('Edit study').click();

		// Wait for edit mode date inputs to appear
		await page.getByLabel('Edit start date').waitFor({ state: 'visible' });

		const editToday = new Date().toISOString().split('T')[0];
		const editNextYear = new Date();
		editNextYear.setFullYear(editNextYear.getFullYear() + 1);
		const editEndDate = editNextYear.toISOString().split('T')[0];

		await page.getByLabel('Edit start date').fill(editToday);
		await page.getByLabel('Edit end date').fill(editEndDate);

		await page.getByLabel('Save changes').click();
		await expectSuccessToast(page, 'period');
	});

	test('PRT-17 — Sidebar — assign naprave', async ({ authenticatedPage: page }) => {
		// Dynamic user has NO device assigned — sidebar shows "No devices assigned"
		await openParticipantDetails(page, createdUsername);
		await page.waitForTimeout(500);

		// Click "Assign" button to open the Assign Device modal
		await page.getByRole('button', { name: 'Assign' }).click();

		// Wait for Assign Device modal (custom dialog, not HTML <dialog>)
		await expect(page.getByRole('heading', { name: 'Assign Device' })).toBeVisible();

		// Scope to the dialog for all subsequent interactions
		const dialog = page.getByRole('dialog', { name: 'Assign Device' });

		// Type sensor name to filter the dropdown
		await dialog.getByLabel('Select Sensor').fill('Test Sensor Beta');

		// Click the matching option from the dropdown
		const option = dialog.getByRole('option', { name: 'Test Sensor Beta' });
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
		// Step 1: First assign a device to the dynamic user (like PRT-17)
		await openParticipantDetails(page, createdUsername);
		await page.waitForTimeout(500);

		// Click "Assign" button to open the Assign Device modal
		await page.getByRole('button', { name: 'Assign' }).click();
		await expect(page.getByRole('heading', { name: 'Assign Device' })).toBeVisible();
		const assignDialog = page.getByRole('dialog', { name: 'Assign Device' });

		// Select a sensor
		await assignDialog.getByLabel('Select Sensor').fill('Test Sensor Beta');
		const option = assignDialog.getByRole('option', { name: 'Test Sensor Beta' });
		await option.waitFor({ state: 'visible' });
		await option.click();

		const today = new Date().toISOString().split('T')[0];
		const nextYear = new Date();
		nextYear.setFullYear(nextYear.getFullYear() + 1);
		const endDate = nextYear.toISOString().split('T')[0];

		await assignDialog.getByLabel('Start Date').fill(today);
		await assignDialog.getByLabel('End Date').fill(endDate);
		await assignDialog.getByRole('button', { name: 'Assign' }).click();
		await expectSuccessToast(page, 'Device');

		// Step 2: Now edit the ownership period
		await page.waitForTimeout(500); // let sidebar update after device assignment
		await page.getByLabel('Edit device').click();

		// Wait for edit mode date inputs to appear
		await page.getByLabel('Edit start date').waitFor({ state: 'visible' });

		const editToday2 = new Date().toISOString().split('T')[0];
		const editNextYear2 = new Date();
		editNextYear2.setFullYear(editNextYear2.getFullYear() + 1);
		const editEndDate2 = editNextYear2.toISOString().split('T')[0];

		await page.getByLabel('Edit start date').fill(editToday2);
		await page.getByLabel('Edit end date').fill(editEndDate2);

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
		await dialog.locator('#modal-name').fill(createdName);
		await dialog.locator('#modal-age').fill('25');
		await dialog.locator('#modal-sex').selectOption('female');

		await dialog.getByRole('button', { name: 'Create' }).click();

		// Success toast should appear — use longer timeout since toast may fade in/out
		await expect(page.getByText('Participant added successfully')).toBeVisible({ timeout: 15000 });
	});

	test('PRT-22 — Error toast ob validacijski napaki', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, createdUsername);
		await page.waitForTimeout(300);

		const editButton = page.getByRole('button', { name: 'Edit' }).first();
		await editButton.waitFor({ state: 'visible' });
		await editButton.click();

		// Wait for the form field to appear in edit mode
		await page.locator('#edit-name').waitFor({ state: 'visible' });
		await page.locator('#edit-name').fill('TestUser123');
		await page.getByRole('button', { name: 'Save' }).first().click();

		// Name validation rejects digits: "Name can only contain letters"
		await expectErrorToast(page);
	});
});
