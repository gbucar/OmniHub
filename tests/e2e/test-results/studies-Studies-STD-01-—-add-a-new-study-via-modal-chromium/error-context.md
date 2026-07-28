# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: studies.spec.ts >> Studies >> STD-01 — add a new study via modal
- Location: specs/studies.spec.ts:15:2

# Error details

```
Test timeout of 15000ms exceeded.
```

```
Error: locator.click: Test timeout of 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Add Study' })

```

# Page snapshot

```yaml
- generic [ref=f1e2]:
  - generic [ref=f1e3]:
    - banner [ref=f1e4]:
      - generic [ref=f1e5]:
        - link "Ω OmniHub" [ref=f1e6] [cursor=pointer]:
          - /url: /
          - generic [ref=f1e7]: Ω
          - generic [ref=f1e9]: OmniHub
        - generic [ref=f1e10]:
          - link "◈ Dashboard" [ref=f1e11] [cursor=pointer]:
            - /url: /
            - generic [ref=f1e12]: ◈
            - text: Dashboard
          - link "◉ Participants" [ref=f1e13] [cursor=pointer]:
            - /url: /users
            - generic [ref=f1e14]: ◉
            - text: Participants
          - link "◐ Devices" [ref=f1e15] [cursor=pointer]:
            - /url: /devices
            - generic [ref=f1e16]: ◐
            - text: Devices
      - generic [ref=f1e17]:
        - button "Switch to dark theme" [ref=f1e18] [cursor=pointer]
        - button [ref=f1e22] [cursor=pointer]
    - main [ref=f1e25]:
      - generic [ref=f1e29]:
        - generic [ref=f1e30]:
          - generic [ref=f1e31]: Ω
          - heading "Welcome back" [level=1] [ref=f1e33]
          - paragraph [ref=f1e34]: Sign in to access the dashboard
        - generic [ref=f1e35]:
          - generic [ref=f1e36]:
            - generic [ref=f1e37]: Username
            - textbox "Username" [ref=f1e39]:
              - /placeholder: Enter your username
          - generic [ref=f1e40]:
            - generic [ref=f1e41]: Password
            - generic [ref=f1e43]:
              - textbox "Password" [ref=f1e44]:
                - /placeholder: Enter your password
              - button "Show password" [ref=f1e45] [cursor=pointer]
          - button "Sign In" [ref=f1e49] [cursor=pointer]
        - paragraph [ref=f1e50]: OmniHub Research Platform
  - generic [ref=f1e51]: Sign In — OmniHub
```

# Test source

```ts
  1  | /**
  2  |  * Studies E2E tests — add study, validation.
  3  |  */
  4  | 
  5  | import { test } from '../fixtures/auth';
  6  | import { expect } from '@playwright/test';
  7  | import { expectSuccessToast, expectErrorToast } from '../helpers/selectors';
  8  | 
  9  | test.describe('Studies', () => {
  10 | 	test.beforeEach(async ({ authenticatedPage: page }) => {
  11 | 		await page.goto('/users');
  12 | 		await page.waitForLoadState('networkidle');
  13 | 	});
  14 | 
  15 | 	test('STD-01 — add a new study via modal', async ({ authenticatedPage: page }) => {
  16 | 		// Click "Add Study" button
> 17 | 		await page.getByRole('button', { name: 'Add Study' }).click();
     |                                                         ^ Error: locator.click: Test timeout of 15000ms exceeded.
  18 | 
  19 | 		// Wait for modal
  20 | 		await page.waitForSelector('dialog[open]');
  21 | 		const dialog = page.locator('dialog[open]');
  22 | 
  23 | 		// Fill in study details
  24 | 		const today = new Date();
  25 | 		const startDate = today.toISOString().split('T')[0];
  26 | 		const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  27 | 		const endDate = nextYear.toISOString().split('T')[0];
  28 | 
  29 | 		await dialog.getByLabel('Study Name').fill(`E2E Test Study ${Date.now()}`);
  30 | 		await dialog.getByLabel('Start Date').fill(startDate);
  31 | 		await dialog.getByLabel('End Date').fill(endDate);
  32 | 
  33 | 		// Submit (button text is "Create")
  34 | 		await dialog.getByRole('button', { name: 'Create' }).click();
  35 | 
  36 | 		// Expect success toast
  37 | 		await expectSuccessToast(page, 'Study');
  38 | 	});
  39 | 
  40 | 	test('STD-02 — empty study name shows validation error', async ({ authenticatedPage: page }) => {
  41 | 		await page.getByRole('button', { name: 'Add Study' }).click();
  42 | 		await page.waitForSelector('dialog[open]');
  43 | 		const dialog = page.locator('dialog[open]');
  44 | 
  45 | 		// Leave name empty, fill dates
  46 | 		const today = new Date().toISOString().split('T')[0];
  47 | 		await dialog.getByLabel('Start Date').fill(today);
  48 | 		await dialog.getByLabel('End Date').fill(today);
  49 | 
  50 | 		// Submit (button text is "Create")
  51 | 		await dialog.getByRole('button', { name: 'Create' }).click();
  52 | 
  53 | 		// Should show error toast (from handleAddStudy validation)
  54 | 		await expectErrorToast(page);
  55 | 	});
  56 | 
  57 | 	test('STD-03 — end date before start date shows validation error', async ({ authenticatedPage: page }) => {
  58 | 		await page.getByRole('button', { name: 'Add Study' }).click();
  59 | 		await page.waitForSelector('dialog[open]');
  60 | 		const dialog = page.locator('dialog[open]');
  61 | 
  62 | 		const today = new Date().toISOString().split('T')[0];
  63 | 		const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  64 | 
  65 | 		await dialog.getByLabel('Study Name').fill(`E2E Invalid Study ${Date.now()}`);
  66 | 		await dialog.getByLabel('Start Date').fill(today);
  67 | 		await dialog.getByLabel('End Date').fill(yesterday);
  68 | 
  69 | 		await dialog.getByRole('button', { name: 'Create' }).click();
  70 | 
  71 | 		// Should show error about dates
  72 | 		await expectErrorToast(page);
  73 | 	});
  74 | });
  75 | 
```