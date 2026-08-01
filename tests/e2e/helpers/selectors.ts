/**
 * Semantic selector helpers for OmniHub E2E tests.
 *
 * All helpers use Playwright's built-in accessibility-first locators
 * (getByRole, getByLabel, getByText) instead of CSS selectors.
 */

import { type Page, type Locator } from '@playwright/test';

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

	// Wait for the sidebar panel to slide in. The "Information" heading
	// is rendered synchronously from props (no API call needed), so its
	// presence confirms the panel is ready. The other cards (streams,
	// ownerships, observations) load asynchronously — individual tests
	// should wait for their specific content if needed.
	const panel = page.getByRole('complementary');
	await panel.getByText(sensorName).first().waitFor({ state: 'visible', timeout: 5000 });
	await panel.getByText('Information').waitFor({ state: 'visible', timeout: 5000 });

	// Brief pause for API calls (streams, ownerships, observations)
	// to kick off under parallel worker load.
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
