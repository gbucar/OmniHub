/**
 * Semantic selector helpers for OmniHub E2E tests.
 *
 * All helpers use Playwright's built-in accessibility-first locators
 * (getByRole, getByLabel, getByText) instead of CSS selectors.
 */

import { expect, type Page, type Locator } from '@playwright/test';

/**
 * Wait for the participants table to finish loading.
 * Returns when rows are visible (or empty state is shown).
 */
export async function waitForParticipantsTable(page: Page): Promise<void> {
	// Wait for either the table or the empty state to appear
	await page.waitForFunction(() => {
		const table = document.querySelector('table');
		const loading = document.querySelector('.loading-spinner');
		return table !== null || (loading === null && document.body.innerText.includes('No participants'));
	});
}

/**
 * Wait for the devices table to finish loading.
 */
export async function waitForDevicesTable(page: Page): Promise<void> {
	await page.waitForFunction(() => {
		const table = document.querySelector('table');
		return table !== null || document.body.innerText.includes('No devices');
	});
}

/**
 * Open a participant's details panel by clicking their row.
 * @param username - The participant's username to find in the table
 */
export async function openParticipantDetails(page: Page, username: string): Promise<void> {
	// Table rows use role="button" (explicit) which overrides implicit row role,
	// so we must target them as buttons. Each <tr role="button"> has an accessible
	// name built from all of its cell contents (username, studies, name).
	const row = page.getByRole('button', { name: new RegExp(username) });
	await row.waitFor({ state: 'attached', timeout: 5000 });
	await row.click();

	// Wait for the sidebar panel to slide in and fully render
	// (CSS transition 200ms + reactive state + potential API calls for studies/devices)
	await page.waitForTimeout(800);

	// Confirm the sidebar is actually visible by waiting for its heading or username
	await page.getByText(new RegExp(`@${username}`)).waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Close the details panel (sidebar) by clicking the backdrop.
 */
export async function closeDetailsPanel(page: Page): Promise<void> {
	await page.getByLabel('Close details').click();
	await page.waitForTimeout(250); // transition + setTimeout(200) in the component
}

/**
 * Close the details panel using the X button in the sidebar header.
 */
export async function closeDetailsPanelWithButton(page: Page): Promise<void> {
	await page.getByLabel('Close panel').click();
	await page.waitForTimeout(250);
}

/**
 * Wait for a toast notification to appear, then verify its text.
 * Returns the toast locator so the caller can assert its content.
 */
export async function getToast(page: Page): Promise<Locator> {
	const toast = page.locator('.toast'); // daisyUI uses .toast class
	await toast.waitFor({ state: 'visible', timeout: 5000 });
	return toast;
}

/**
 * Wait for a success toast with specific text.
 */
export async function expectSuccessToast(page: Page, text: string): Promise<void> {
	const toast = await getToast(page);
	const successToast = toast.locator('.alert-success');
	await successToast.waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Wait for an error toast with specific text.
 */
export async function expectErrorToast(page: Page): Promise<void> {
	const toast = await getToast(page);
	const errorToast = toast.locator('.alert-error');
	await errorToast.waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Navigate using the navbar button.
 */
export async function navigateTo(page: Page, label: string): Promise<void> {
	await page.getByRole('link', { name: label, exact: false }).first().click();
	await page.waitForLoadState('networkidle');
}

/**
 * Open a device's details panel by clicking its row in the table.
 * @param sensorName - The sensor name to find in the table (partial match)
 */
export async function openDeviceDetails(page: Page, sensorName: string): Promise<void> {
	const row = page.getByRole('button', { name: new RegExp(sensorName) });
	await row.click();

	// Wait for the sidebar panel to slide in (CSS transition 200ms) and
	// the Information card to render (synchronous from props — no API needed).
	const panel = page.getByRole('complementary');
	await panel.getByText(sensorName).first().waitFor({ state: 'visible', timeout: 5000 });
	await panel.getByText('Information').waitFor({ state: 'visible', timeout: 5000 });

	// Brief pause for API calls (streams, ownerships, observations) to kick off.
	await page.waitForTimeout(500);
}

/**
 * Close the device details panel by clicking the backdrop.
 */
export async function closeDeviceDetailsPanel(page: Page): Promise<void> {
	await page.getByLabel('Close details').click();
	await page.waitForTimeout(250);
}

/**
 * Close the device details panel using the X button in the sidebar header.
 */
export async function closeDeviceDetailsPanelWithButton(page: Page): Promise<void> {
	await page.getByLabel('Close panel').click();
	await page.waitForTimeout(250);
}

// ============================================================================
// Helper functions for creating test data via API
// ============================================================================

/**
 * Create a participant via API and wait for the page to reflect it.
 * @param page - Playwright page
 * @param username - Unique username for the participant
 * @param password - Password for the participant
 * @param name - Display name for the participant
 * @param age - Age of the participant
 * @param sex - Sex of the participant
 */
export async function createParticipant(
	page: Page,
	username: string,
	password: string,
	name: string,
	age: number,
	sex: string
): Promise<void> {
	await page.getByRole('button', { name: 'Add Participant' }).click();

	// Wait for the dialog to fully render
	await expect(page.getByRole('heading', { name: 'Add Participant' })).toBeVisible();
	const dialog = page.getByRole('dialog');

	await dialog.getByLabel('Username').fill(username);
	await dialog.getByPlaceholder('Enter password').fill(password);
	await dialog.locator('#modal-name').fill(name);
	await dialog.locator('#modal-age').fill(age.toString());
	await dialog.locator('#modal-sex').selectOption(sex);

	await dialog.getByRole('button', { name: 'Create' }).click();
	await expectSuccessToast(page, 'Participant');

	// Wait for the new participant to appear in the table
	await page.getByLabel('Search').fill(username);
	await expect(page.getByText(username)).toBeVisible({ timeout: 5000 });
}

/**
 * Create a study via API and wait for the page to reflect it.
 * @param page - Playwright page
 * @param studyName - Unique name for the study
 * @param startDate - Start date of the study (ISO string YYYY-MM-DD)
 * @param endDate - End date of the study (ISO string YYYY-MM-DD)
 */
export async function createStudy(
	page: Page,
	studyName: string,
	startDate: string,
	endDate: string
): Promise<void> {
	await page.getByRole('button', { name: 'Add Study' }).click();

	// Wait for modal
	await page.waitForSelector('dialog[open]');
	const dialog = page.locator('dialog[open]');

	await dialog.getByLabel('Study Name').fill(studyName);
	await dialog.getByLabel('Start Date').fill(startDate);
	await dialog.getByLabel('End Date').fill(endDate);

	// Submit
	await dialog.getByRole('button', { name: 'Create' }).click();

	await expectSuccessToast(page, 'Study');
}

/**
 * Create a sensor via API and wait for the page to reflect it.
 * @param page - Playwright page
 * @param sensorType - Type of sensor (e.g., 'ATMOTUBE_PRO', 'ATMOAIR_V2')
 * @param sensorName - Unique name for the sensor
 * @param description - Description of the sensor
 */
export async function createSensor(
	page: Page,
	sensorType: string,
	sensorName: string,
	description: string
): Promise<void> {
	// Navigate to devices page
	await navigateTo(page, 'Devices');
	await waitForDevicesTable(page);

	// Click "Add Device" (note: this button may need to be identified differently)
	// For now, we'll use a flexible approach that searches for the button
	const addDeviceButton = page.getByRole('button', { name: /add.*device/i });
	if (await addDeviceButton.count() > 0) {
		await addDeviceButton.first().click();
		await page.waitForTimeout(500);
	}

	// Wait for the form to appear
	await expect(page.getByRole('heading', { name: /add.*device/i })).toBeVisible({ timeout: 5000 });

	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Sensor Type').selectOption(sensorType);
	await dialog.getByLabel('Name').fill(sensorName);
	await dialog.getByLabel('Description').fill(description);

	// Submit - note: button text may vary
	await dialog.getByRole('button', { name: /create/i }).click();
	await expectSuccessToast(page, 'Device');

	// Wait for the new sensor to appear in the table
	await page.getByLabel('Search').fill(sensorName);
	await expect(page.getByText(sensorName)).toBeVisible({ timeout: 5000 });
}
