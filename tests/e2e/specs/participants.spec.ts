/**
 * Participants E2E tests — search, filter, pagination, details panel,
 * add participant, add to study, assign device, edit, validation.
 *
 * Uses the auth fixture (already logged in as admin_user).
 * All selectors are semantic (getByRole, getByLabel, getByText, getByPlaceholder).
 * Each test creates its own participant data for isolation.
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

test.describe('Participants', () => {
	let createdUsername: string;

	test.beforeEach(async ({ authenticatedPage: page }) => {
		// Auth fixture navigates to /devices — redirect to /users for participants
		await navigateTo(page, 'Participants');
		await waitForParticipantsTable(page);

		// Create a new participant for this test suite
		createdUsername = `e2e_participant_${Date.now()}`;
		await createParticipant(page, createdUsername, 'testpass123', 'Test User', '30', 'male');
	});

	// ---------------------------------------------------------------------------
	// Add participant / validation
	// ---------------------------------------------------------------------------

	test('PRT-09 — Dodajanje novega participanta', async ({ authenticatedPage: page }) => {
		const uniqueUsername = `e2e_new_user_${Date.now()}`;

		await expect(page.getByText('Test User')).toBeVisible();
		await page.getByRole('button', { name: 'Add Participant' }).click();

		// Wait for the dialog heading to appear before scoping
		await expect(page.getByRole('heading', { name: 'Add Participant' })).toBeVisible();
		const dialog = page.getByRole('dialog');

		await dialog.getByLabel('Username').fill(uniqueUsername);
		// PasswordInput component uses placeholder, not a label association
		await dialog.getByPlaceholder('Enter password').fill('testpass123');
		await dialog.locator('#modal-name').fill('Test User');
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

		// Click Create — form validation prevents submission with empty username
		const createBtn = dialog.getByRole('button', { name: 'Create' });
		await createBtn.waitFor({ state: 'visible' });
		await createBtn.click({ force: true });

		// Dialog stays open (form was not submitted or API returned error)
		await expect(dialog).toBeVisible();

		// Close dialog via Cancel. Use force:true — sidebar z-10 elements
		// from previous tests may intercept pointer events.
		await dialog.getByRole('button', { name: 'Cancel' }).click({ force: true });
		await expect(dialog).not.toBeVisible();
	});

	// ---------------------------------------------------------------------------
	// Details panel (sidebar) — read-only interactions
	// ---------------------------------------------------------------------------

	test('PRT-11 — Odpiranje detajlov (sidebar)', async ({ authenticatedPage: page }) => {
		await openParticipantDetails(page, createdUsername);

		// Sidebar heading shows participant name
		await expect(page.getByRole('heading', { name: 'Test User' })).toBeVisible();
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
		await page.locator('#edit-name').waitFor({ state: 'visible' });
		await page.locator('#edit-name').fill('Test User Modified');
		await page.locator('#edit-age').waitFor({ state: 'visible' });
		await page.locator('#edit-age').fill('31');
		await page.getByRole('button', { name: 'Save' }).first().click();

		await expectSuccessToast(page, 'updated');

		// Sidebar stays open with updated heading
		await expect(page.getByRole('heading', { name: 'Test User Modified' })).toBeVisible();

		// Close and reopen to verify persistence in database
		await closeDetailsPanelWithButton(page);
		await openParticipantDetails(page, createdUsername);
		await expect(page.getByRole('heading', { name: 'Test User Modified' })).toBeVisible();
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
		await expect(page.getByRole('heading', { name: 'Test User' })).toBeVisible();
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
		// test_participant_1 is already in Test Study Alpha with a membership period
		await openParticipantDetails(page, 'test_participant_1');
		await page.waitForTimeout(300);

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
		// test_participant_4 has NO device assigned — sidebar shows "No devices assigned"
		await openParticipantDetails(page, 'test_participant_4');
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
		// test_participant_1 has Test Sensor Alpha assigned (from seed data)
		await openParticipantDetails(page, 'test_participant_1');
		await page.waitForTimeout(300);

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
		await dialog.locator('#modal-name').fill('Toast User');
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
