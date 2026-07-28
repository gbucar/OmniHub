import { test, expect } from '@playwright/test';

test('sidebar debug', async ({ page }) => {
	// Login
	await page.goto('/auth/login');
	await page.getByLabel('Username').fill('admin_user');
	await page.getByPlaceholder('Enter your password').fill('admin_geslo_123');
	await page.getByRole('button', { name: 'Sign In' }).click();
	await page.waitForURL('/');

	// Navigate to participants via navbar
	await page.getByRole('link', { name: /Participants/ }).first().click();
	await page.waitForURL('/users');
	await page.waitForLoadState('networkidle');
	await expect(page.getByText('Ana Test')).toBeVisible();

	// Click participant row
	console.log('Opening sidebar...');
	await page.getByRole('button', { name: /test_participant_1/ }).click();

	// Wait a bit for sidebar
	await page.waitForTimeout(1000);
	console.log('After wait, URL:', page.url());

	// Screenshot
	await page.screenshot({ path: '/tests/test-results/sidebar-debug.png', fullPage: true });

	// Count ALL buttons visible
	const allButtons = await page.getByRole('button').allTextContents();
	console.log('ALL BUTTONS:', JSON.stringify(allButtons.filter(b => b.trim()).slice(0, 15)));

	// List ALL buttons with name containing "Edit"
	const editButtons = page.getByRole('button').filter({ hasText: /Edit/i });
	const count = await editButtons.count();
	console.log('Buttons with Edit text:', count);
	for (let i = 0; i < count; i++) {
		const btn = editButtons.nth(i);
		const ariaLabel = await btn.getAttribute('aria-label');
		const text = await btn.textContent();
		const classes = await btn.getAttribute('class');
		console.log(`  ${i}: aria="${ariaLabel}" text="${text?.trim()}" class="${classes?.substring(0, 50)}"`);
	}
	
	// Dump all buttons in sidebar area
	const panel = page.locator('aside');
	const panelBtns = await panel.getByRole('button').all();
	console.log('Sidebar buttons:', panelBtns.length);
});
