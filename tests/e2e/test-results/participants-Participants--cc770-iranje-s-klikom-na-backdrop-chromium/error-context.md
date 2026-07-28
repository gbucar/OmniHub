# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: participants.spec.ts >> Participants >> PRT-20 — Sidebar — zapiranje s klikom na backdrop
- Location: specs/participants.spec.ts:156:2

# Error details

```
Test timeout of 15000ms exceeded.
```

```
Error: locator.click: Test timeout of 15000ms exceeded.
Call log:
  - waiting for getByRole('row', { name: /test_participant_1/ })

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
  2  |  * Semantic selector helpers for OmniHub E2E tests.
  3  |  *
  4  |  * All helpers use Playwright's built-in accessibility-first locators
  5  |  * (getByRole, getByLabel, getByText) instead of CSS selectors.
  6  |  */
  7  | 
  8  | import { type Page, type Locator } from '@playwright/test';
  9  | 
  10 | /**
  11 |  * Wait for the participants table to finish loading.
  12 |  * Returns when rows are visible (or empty state is shown).
  13 |  */
  14 | export async function waitForParticipantsTable(page: Page): Promise<void> {
  15 | 	// Wait for either the table or the empty state to appear
  16 | 	await page.waitForFunction(() => {
  17 | 		const table = document.querySelector('table');
  18 | 		const loading = document.querySelector('.loading-spinner');
  19 | 		return table !== null || (loading === null && document.body.innerText.includes('No participants'));
  20 | 	});
  21 | }
  22 | 
  23 | /**
  24 |  * Wait for the devices table to finish loading.
  25 |  */
  26 | export async function waitForDevicesTable(page: Page): Promise<void> {
  27 | 	await page.waitForFunction(() => {
  28 | 		const table = document.querySelector('table');
  29 | 		return table !== null || document.body.innerText.includes('No devices');
  30 | 	});
  31 | }
  32 | 
  33 | /**
  34 |  * Open a participant's details panel by clicking their row.
  35 |  * @param username - The participant's username to find in the table
  36 |  */
  37 | export async function openParticipantDetails(page: Page, username: string): Promise<void> {
  38 | 	const row = page.getByRole('row', { name: new RegExp(username) });
> 39 | 	await row.click();
     |            ^ Error: locator.click: Test timeout of 15000ms exceeded.
  40 | 	// Wait for the slide-in panel to be visible
  41 | 	await page.waitForTimeout(300); // CSS transition is 200ms
  42 | }
  43 | 
  44 | /**
  45 |  * Close the details panel (sidebar) by clicking the backdrop.
  46 |  */
  47 | export async function closeDetailsPanel(page: Page): Promise<void> {
  48 | 	await page.getByLabel('Close details').click();
  49 | 	await page.waitForTimeout(250); // transition + setTimeout(200) in the component
  50 | }
  51 | 
  52 | /**
  53 |  * Close the details panel using the X button in the sidebar header.
  54 |  */
  55 | export async function closeDetailsPanelWithButton(page: Page): Promise<void> {
  56 | 	await page.getByLabel('Close panel').click();
  57 | 	await page.waitForTimeout(250);
  58 | }
  59 | 
  60 | /**
  61 |  * Wait for a toast notification to appear, then verify its text.
  62 |  * Returns the toast locator so the caller can assert its content.
  63 |  */
  64 | export async function getToast(page: Page): Promise<Locator> {
  65 | 	const toast = page.locator('.toast'); // daisyUI uses .toast class
  66 | 	await toast.waitFor({ state: 'visible', timeout: 5000 });
  67 | 	return toast;
  68 | }
  69 | 
  70 | /**
  71 |  * Wait for a success toast with specific text.
  72 |  */
  73 | export async function expectSuccessToast(page: Page, text: string): Promise<void> {
  74 | 	const toast = await getToast(page);
  75 | 	const successToast = toast.locator('.alert-success');
  76 | 	await successToast.waitFor({ state: 'visible', timeout: 5000 });
  77 | }
  78 | 
  79 | /**
  80 |  * Wait for an error toast with specific text.
  81 |  */
  82 | export async function expectErrorToast(page: Page): Promise<void> {
  83 | 	const toast = await getToast(page);
  84 | 	const errorToast = toast.locator('.alert-error');
  85 | 	await errorToast.waitFor({ state: 'visible', timeout: 5000 });
  86 | }
  87 | 
  88 | /**
  89 |  * Navigate using the navbar button.
  90 |  */
  91 | export async function navigateTo(page: Page, label: string): Promise<void> {
  92 | 	await page.getByRole('link', { name: label, exact: false }).first().click();
  93 | 	await page.waitForLoadState('networkidle');
  94 | }
  95 | 
```