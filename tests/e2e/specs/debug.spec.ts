import { test, expect } from '@playwright/test';

test('api debug', async ({ page }) => {
	// Check if PostgREST is reachable directly
	const resp = await page.request.post('http://localhost:3000/rpc/login', {
		data: { username: 'admin_user', password: 'admin_geslo_123' }
	});
	console.log('API STATUS:', resp.status());
	const body = await resp.json();
	console.log('API TOKEN:', body.token ? 'YES' : 'NO');
	
	// Now try login through the UI
	await page.goto('/auth/login');
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(3000);
	
	await page.getByLabel('Username').fill('admin_user');
	await page.getByPlaceholder('Enter your password').fill('admin_geslo_123');
	await page.getByRole('button', { name: 'Sign In' }).click();
	
	await page.waitForTimeout(3000);
	console.log('AFTER LOGIN URL:', page.url());
});