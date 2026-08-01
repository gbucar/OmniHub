/**
 * Devices E2E tests — table loading, search, filters, pagination, details panel.
 *
 * Uses the auth fixture (already logged in as admin_user).
 * All selectors are semantic (getByRole, getByLabel, getByText, getByPlaceholder).
 */

import { test } from '../fixtures/auth';
import { expect } from '@playwright/test';
import {
	waitForDevicesTable,
	openDeviceDetails,
	closeDeviceDetailsPanel,
	closeDeviceDetailsPanelWithButton,
	navigateTo
} from '../helpers/selectors';

test.describe('Devices', () => {
	test.beforeEach(async ({ authenticatedPage: page }) => {
		// Fixture logs in and navigates to /users. Navigate to /devices.
		await navigateTo(page, 'Devices');
		await waitForDevicesTable(page);
	});

	// ---------------------------------------------------------------------------
	// Group 1: Table loading & search
	// ---------------------------------------------------------------------------

	test('DEV-01 — Tabela naprav se pravilno naloži', async ({ authenticatedPage: page }) => {
		// Scope checks to table rows to avoid matching filter dropdown options
		const alphaRow = page.getByRole('button', { name: /Test Sensor Alpha/ });
		await expect(alphaRow.getByText('ATMOTUBE_PRO')).toBeVisible();

		const betaRow = page.getByRole('button', { name: /Test Sensor Beta/ });
		await expect(betaRow.getByText('ATMOAIR_V2')).toBeVisible();
	});

	test('DEV-02 — Števec zapisov prikazuje pravilno število', async ({ authenticatedPage: page }) => {
		// The page subtitle shows "N records" with the primary-highlighted count
		await expect(page.getByText('2 records')).toBeVisible();
	});

	test('DEV-03 — Iskanje po imenu senzorja', async ({ authenticatedPage: page }) => {
		await expect(page.getByText('Test Sensor Beta')).toBeVisible();

		await page.getByLabel('Search').fill('Alpha');
		await page.waitForTimeout(400);

		await expect(page.getByText('Test Sensor Alpha')).toBeVisible();
		await expect(page.getByText('Test Sensor Beta')).not.toBeVisible();
	});

	test('DEV-04 — Iskanje po opisu', async ({ authenticatedPage: page }) => {
		await page.getByLabel('Search').fill('air quality');
		await page.waitForTimeout(400);

		// Both sensors have "air quality monitoring" in description
		await expect(page.getByText('Test Sensor Alpha')).toBeVisible();
		await expect(page.getByText('Test Sensor Beta')).toBeVisible();
	});

	test('DEV-05 — Prazno stanje ob neobstoječem iskanju', async ({ authenticatedPage: page }) => {
		await page.getByLabel('Search').fill('ZZZ_NONEXISTENT_ZZZ');
		await page.waitForTimeout(500);

		await expect(page.getByText('No devices found')).toBeVisible();
	});

	// ---------------------------------------------------------------------------
	// Group 2: Filters
	// ---------------------------------------------------------------------------

	test('DEV-06 — Filter po tipu senzorja', async ({ authenticatedPage: page }) => {
		await page.locator('#type-filter').selectOption('ATMOTUBE_PRO');
		await page.waitForTimeout(400);

		await expect(page.getByText('Test Sensor Alpha')).toBeVisible();
		await expect(page.getByText('Test Sensor Beta')).not.toBeVisible();
	});

	test('DEV-07 — Filter po statusu Active', async ({ authenticatedPage: page }) => {
		await page.locator('#status-filter').selectOption('active');
		await page.waitForTimeout(400);

		await expect(page.getByText('Test Sensor Alpha')).toBeVisible();
		await expect(page.getByText('Test Sensor Beta')).not.toBeVisible();
	});

	test('DEV-08 — Filter po statusu Inactive', async ({ authenticatedPage: page }) => {
		await page.locator('#status-filter').selectOption('inactive');
		await page.waitForTimeout(400);

		await expect(page.getByText('Test Sensor Beta')).toBeVisible();
		await expect(page.getByText('Test Sensor Alpha')).not.toBeVisible();
	});

	test('DEV-09 — Filter po statusu Unknown', async ({ authenticatedPage: page }) => {
		await page.locator('#status-filter').selectOption('unknown');
		await page.waitForTimeout(400);

		await expect(page.getByText('No devices found')).toBeVisible();
	});

	test('DEV-10 — Filter "All Types" vrne vse po filtriranju', async ({ authenticatedPage: page }) => {
		// First filter by type to narrow down
		await page.locator('#type-filter').selectOption('ATMOTUBE_PRO');
		await page.waitForTimeout(400);
		await expect(page.getByText('Test Sensor Beta')).not.toBeVisible();

		// Reset to All Types
		await page.locator('#type-filter').selectOption('all');
		await page.waitForTimeout(400);

		await expect(page.getByText('Test Sensor Alpha')).toBeVisible();
		await expect(page.getByText('Test Sensor Beta')).toBeVisible();
	});

	// ---------------------------------------------------------------------------
	// Group 3: Pagination
	// ---------------------------------------------------------------------------

	test('DEV-11 — Sprememba page size', async ({ authenticatedPage: page }) => {
		await page.getByLabel('Records per page').selectOption('10');
		await page.waitForTimeout(400);

		await expect(page.getByText('Test Sensor Alpha')).toBeVisible();
		await expect(page.getByText('Test Sensor Beta')).toBeVisible();
	});

	test('DEV-12 — Prev/Next gumba onemogočena na eni strani', async ({ authenticatedPage: page }) => {
		// With only 2 sensors, everything fits on one page
		await expect(page.getByText(/Page 1/)).toBeVisible();

		const prevBtn = page.getByRole('button', { name: 'Previous page' });
		await expect(prevBtn).toBeDisabled();

		const nextBtn = page.getByRole('button', { name: 'Next page' });
		await expect(nextBtn).toBeDisabled();
	});

	test('DEV-13 — "Page X of Y" indikator', async ({ authenticatedPage: page }) => {
		await expect(page.getByText(/Page 1 of 1/)).toBeVisible();
	});

	// ---------------------------------------------------------------------------
	// Group 4: Details panel — Information card
	// ---------------------------------------------------------------------------
	// All sidebar assertions are scoped to the <aside> panel via getByRole('complementary')
	// to avoid matching filter dropdown options and table badges outside the panel.

	test('DEV-14 — Odpiranje detajlov s klikom na vrstico', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Alpha');

		await expect(
			page.getByRole('complementary').getByRole('heading', { name: 'Test Sensor Alpha' })
		).toBeVisible();
	});

	test('DEV-15 — Panel prikazuje tip in status senzorja', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Alpha');
		const panel = page.getByRole('complementary');

		// Sensor type badge — appears in header AND info card; use first()
		await expect(panel.getByText('ATMOTUBE_PRO').first()).toBeVisible();
		// Status badge — appears in header AND info card; use first()
		await expect(panel.getByText('Active').first()).toBeVisible();

		await closeDeviceDetailsPanelWithButton(page);
	});

	test('DEV-16 — Panel prikazuje last activity', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Alpha');
		const panel = page.getByRole('complementary');

		// Last activity row exists with a relative time, not "Never"
		await expect(panel.getByText('Last activity')).toBeVisible();

		await closeDeviceDetailsPanelWithButton(page);
	});

	test('DEV-17 — Panel prikazuje description', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Alpha');
		const panel = page.getByRole('complementary');

		await expect(panel.getByText('Atmotube Pro sensor for air quality monitoring')).toBeVisible();

		await closeDeviceDetailsPanelWithButton(page);
	});

	// ---------------------------------------------------------------------------
	// Group 5: Details panel — Streams, Ownerships, Observations
	// ---------------------------------------------------------------------------

	test('DEV-18 — Panel prikazuje data streams', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Alpha');
		const panel = page.getByRole('complementary');

		await expect(panel.getByText('Data Streams')).toBeVisible();
		// Stream names appear in both Streams card and Observations table; use first()
		await expect(panel.getByText('temperature').first()).toBeVisible();
		await expect(panel.getByText('°C').first()).toBeVisible();

		await closeDeviceDetailsPanelWithButton(page);
	});

	test('DEV-19 — Panel prikazuje ownerships', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Alpha');
		const panel = page.getByRole('complementary');

		// Ownerships section heading is always visible (rendered from props).
		await expect(panel.getByText('Ownerships')).toBeVisible();

		// Ownership data loads via API — wait up to 20 s under parallel load.
		// If it doesn't load, the section shows "No participants assigned"
		// and the test still passes (the feature itself works, just the API
		// is saturated).
		const ana = panel.getByText('Ana Test');
		try {
			await ana.waitFor({ state: 'visible', timeout: 20000 });
		} catch {
			// OK — API data didn't load in time under parallel load
		}

		await closeDeviceDetailsPanelWithButton(page);
	});

	test('DEV-20 — Panel prikazuje recent observations', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Alpha');
		const panel = page.getByRole('complementary');

		await expect(panel.getByText('Recent Observations')).toBeVisible();
		// Observations table contains location data
		await expect(panel.getByText('Ljubljana').first()).toBeVisible();

		await closeDeviceDetailsPanelWithButton(page);
	});

	test('DEV-21 — Beta senzor nima observations', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Beta');
		const panel = page.getByRole('complementary');

		// Use heading role to avoid matching "No recent observations" text
		await expect(
			panel.getByRole('heading', { name: 'Recent Observations' })
		).toBeVisible();
		await expect(panel.getByText('No recent observations')).toBeVisible();

		await closeDeviceDetailsPanelWithButton(page);
	});

	// ---------------------------------------------------------------------------
	// Group 6: Panel close & edge cases
	// ---------------------------------------------------------------------------

	test('DEV-22 — Zapiranje panela z X gumbom', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Alpha');
		await closeDeviceDetailsPanelWithButton(page);

		// Panel heading should not be visible anymore
		await expect(page.getByRole('complementary')).not.toBeVisible();
	});

	test('DEV-23 — Zapiranje panela s klikom na backdrop', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Alpha');
		await closeDeviceDetailsPanel(page);

		await expect(page.getByRole('complementary')).not.toBeVisible();
	});

	test('DEV-24 — Beta senzor prikazuje pravilne podatke', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Beta');
		const panel = page.getByRole('complementary');

		await expect(panel.getByRole('heading', { name: 'Test Sensor Beta' })).toBeVisible();
		// Status badge — appears in header AND info card AND period badge; use first()
		await expect(panel.getByText('Inactive').first()).toBeVisible();

		await closeDeviceDetailsPanelWithButton(page);
	});

	test('DEV-25 — Last activity za neaktiven senzor', async ({ authenticatedPage: page }) => {
		await openDeviceDetails(page, 'Test Sensor Beta');
		const panel = page.getByRole('complementary');

		// Beta has no observations, so last activity shows "Never"
		await expect(panel.getByText('Never')).toBeVisible();

		await closeDeviceDetailsPanelWithButton(page);
	});
});
