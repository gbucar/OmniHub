# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: participants.spec.ts >> Participants >> PRT-08 — "No participants found" ob neobstoječem iskanju
- Location: specs/participants.spec.ts:88:2

# Error details

```
Test timeout of 15000ms exceeded.
```

```
Error: locator.fill: Test timeout of 15000ms exceeded.
Call log:
  - waiting for getByLabel('Search')

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
  1   | /**
  2   |  * Participants E2E tests — search, filter, pagination, details panel,
  3   |  * add participant, add to study, assign device, edit, validation.
  4   |  *
  5   |  * Uses the auth fixture (already logged in as admin_user).
  6   |  * All selectors are semantic (getByRole, getByLabel, getByText, getByPlaceholder).
  7   |  */
  8   | 
  9   | import { test } from '../fixtures/auth';
  10  | import { expect } from '@playwright/test';
  11  | import {
  12  | 	waitForParticipantsTable,
  13  | 	openParticipantDetails,
  14  | 	closeDetailsPanel,
  15  | 	closeDetailsPanelWithButton,
  16  | 	expectSuccessToast,
  17  | 	expectErrorToast
  18  | } from '../helpers/selectors';
  19  | 
  20  | test.describe('Participants', () => {
  21  | 	test.beforeEach(async ({ authenticatedPage: page }) => {
  22  | 		await page.goto('/users');
  23  | 		await page.waitForLoadState('networkidle');
  24  | 	});
  25  | 
  26  | 	// ---------------------------------------------------------------------------
  27  | 	// Read-only tests (no data modification — rely on seeded data)
  28  | 	// ---------------------------------------------------------------------------
  29  | 
  30  | 	test('PRT-01 — Seznam participantov se pravilno naloži', async ({ authenticatedPage: page }) => {
  31  | 		await waitForParticipantsTable(page);
  32  | 		await expect(page.getByText('Ana Test')).toBeVisible();
  33  | 		await expect(page.getByText('test_participant_1')).toBeVisible();
  34  | 		await expect(page.getByText('Bojan Test')).toBeVisible();
  35  | 	});
  36  | 
  37  | 	test('PRT-02 — Iskanje po imenu', async ({ authenticatedPage: page }) => {
  38  | 		await page.getByLabel('Search').fill('Ana');
  39  | 		await page.waitForTimeout(400);
  40  | 		await expect(page.getByText('Ana Test')).toBeVisible();
  41  | 		await expect(page.getByText('Bojan Test')).not.toBeVisible();
  42  | 	});
  43  | 
  44  | 	test('PRT-03 — Iskanje po uporabniškem imenu', async ({ authenticatedPage: page }) => {
  45  | 		await page.getByLabel('Search').fill('test_participant_4');
  46  | 		await page.waitForTimeout(400);
  47  | 		await expect(page.getByText('test_participant_4')).toBeVisible();
  48  | 		await expect(page.getByText('David Test')).toBeVisible();
  49  | 	});
  50  | 
  51  | 	test('PRT-04 — Filter po študiji', async ({ authenticatedPage: page }) => {
  52  | 		await page.getByLabel('Study').selectOption('Test Study Alpha');
  53  | 		await page.waitForTimeout(500);
  54  | 		await expect(page.getByText('Ana Test')).toBeVisible();
  55  | 		await expect(page.getByText('Bojan Test')).toBeVisible();
  56  | 		await expect(page.getByText('Cvetka Test')).toBeVisible();
  57  | 		await expect(page.getByText('David Test')).not.toBeVisible();
  58  | 	});
  59  | 
  60  | 	test('PRT-05 — Paginacija — spreminjanje page size', async ({ authenticatedPage: page }) => {
  61  | 		await page.getByLabel('Records per page').selectOption('10');
  62  | 		await page.waitForTimeout(300);
  63  | 		await expect(page.getByText('Ana Test')).toBeVisible();
  64  | 	});
  65  | 
  66  | 	test('PRT-06 — Paginacija — prev/next gumba', async ({ authenticatedPage: page }) => {
  67  | 		// Select smallest page size (10). With 5 seeded participants all fit on one page.
  68  | 		await page.getByLabel('Records per page').selectOption('10');
  69  | 		await page.waitForTimeout(300);
  70  | 
  71  | 		// Page indicator should show 1 / 1
  72  | 		await expect(page.getByText('Page 1 of 1')).toBeVisible();
  73  | 
  74  | 		// Next button disabled (only one page)
  75  | 		const nextBtn = page.getByRole('button', { name: 'Next page' });
  76  | 		await expect(nextBtn).toBeDisabled();
  77  | 
  78  | 		// Previous button also disabled (already on first page)
  79  | 		const prevBtn = page.getByRole('button', { name: 'Previous page' });
  80  | 		await expect(prevBtn).toBeDisabled();
  81  | 	});
  82  | 
  83  | 	test('PRT-07 — "X of Y records" prikazuje pravilno', async ({ authenticatedPage: page }) => {
  84  | 		await waitForParticipantsTable(page);
  85  | 		await expect(page.getByText(/\d+ of \d+ records/)).toBeVisible();
  86  | 	});
  87  | 
  88  | 	test('PRT-08 — "No participants found" ob neobstoječem iskanju', async ({ authenticatedPage: page }) => {
> 89  | 		await page.getByLabel('Search').fill('ZZZ_NONEXISTENT_ZZZ');
      |                                   ^ Error: locator.fill: Test timeout of 15000ms exceeded.
  90  | 		await page.waitForTimeout(500);
  91  | 		await expect(page.getByText('No participants found')).toBeVisible();
  92  | 	});
  93  | 
  94  | 	// ---------------------------------------------------------------------------
  95  | 	// Add participant / validation
  96  | 	// ---------------------------------------------------------------------------
  97  | 
  98  | 	test('PRT-09 — Dodajanje novega participanta', async ({ authenticatedPage: page }) => {
  99  | 		const uniqueUsername = `e2e_new_user_${Date.now()}`;
  100 | 
  101 | 		await page.getByRole('button', { name: 'Add Participant' }).click();
  102 | 		await page.waitForSelector('dialog[open]');
  103 | 		const dialog = page.locator('dialog[open]');
  104 | 
  105 | 		await dialog.getByLabel('Username').fill(uniqueUsername);
  106 | 		await dialog.getByPlaceholder('Enter password').fill('testpass123');
  107 | 		await dialog.getByLabel('Name').fill('Test User');
  108 | 		await dialog.getByLabel('Age').fill('30');
  109 | 		await dialog.getByLabel('Sex').selectOption('male');
  110 | 
  111 | 		await dialog.getByRole('button', { name: 'Create' }).click();
  112 | 		await expectSuccessToast(page, 'Participant');
  113 | 
  114 | 		// Search for the new user to verify it appears in table
  115 | 		await page.getByLabel('Search').fill(uniqueUsername);
  116 | 		await page.waitForTimeout(400);
  117 | 		await expect(page.getByText(uniqueUsername)).toBeVisible();
  118 | 	});
  119 | 
  120 | 	test('PRT-10 — Validacija — prazen username', async ({ authenticatedPage: page }) => {
  121 | 		await page.getByRole('button', { name: 'Add Participant' }).click();
  122 | 		await page.waitForSelector('dialog[open]');
  123 | 		const dialog = page.locator('dialog[open]');
  124 | 
  125 | 		// Leave username empty, click Create
  126 | 		await dialog.getByRole('button', { name: 'Create' }).click();
  127 | 
  128 | 		// Either HTML5 validation keeps form open or API rejects → error toast
  129 | 		await expectErrorToast(page);
  130 | 		// Dialog stays open after error
  131 | 		await expect(dialog).toBeVisible();
  132 | 		await dialog.getByRole('button', { name: 'Cancel' }).click();
  133 | 	});
  134 | 
  135 | 	// ---------------------------------------------------------------------------
  136 | 	// Details panel (sidebar) — read-only interactions
  137 | 	// ---------------------------------------------------------------------------
  138 | 
  139 | 	test('PRT-11 — Odpiranje detajlov (sidebar)', async ({ authenticatedPage: page }) => {
  140 | 		await openParticipantDetails(page, 'test_participant_1');
  141 | 
  142 | 		// Sidebar heading shows participant name
  143 | 		await expect(page.getByRole('heading', { name: 'Ana Test' })).toBeVisible();
  144 | 		// Username with @ prefix only appears in sidebar
  145 | 		await expect(page.getByText('@test_participant_1')).toBeVisible();
  146 | 	});
  147 | 
  148 | 	test('PRT-19 — Sidebar — zapiranje z X gumbom', async ({ authenticatedPage: page }) => {
  149 | 		await openParticipantDetails(page, 'test_participant_1');
  150 | 		await closeDetailsPanelWithButton(page);
  151 | 
  152 | 		// Sidebar username text should be gone
  153 | 		await expect(page.getByText('@test_participant_1')).not.toBeVisible();
  154 | 	});
  155 | 
  156 | 	test('PRT-20 — Sidebar — zapiranje s klikom na backdrop', async ({ authenticatedPage: page }) => {
  157 | 		await openParticipantDetails(page, 'test_participant_1');
  158 | 		await closeDetailsPanel(page);
  159 | 
  160 | 		// Sidebar username text should be gone
  161 | 		await expect(page.getByText('@test_participant_1')).not.toBeVisible();
  162 | 	});
  163 | 
  164 | 	// ---------------------------------------------------------------------------
  165 | 	// Sidebar — edit personal info / validation
  166 | 	// ---------------------------------------------------------------------------
  167 | 
  168 | 	test('PRT-12 — Sidebar — edit personal info', async ({ authenticatedPage: page }) => {
  169 | 		await openParticipantDetails(page, 'test_participant_1');
  170 | 
  171 | 		// Enter edit mode
  172 | 		await page.getByRole('button', { name: 'Edit' }).click();
  173 | 		await page.getByRole('textbox', { name: 'Name' }).fill('Ana Modified');
  174 | 		await page.getByRole('spinbutton', { name: 'Age' }).fill('26');
  175 | 		await page.getByRole('button', { name: 'Save' }).click();
  176 | 
  177 | 		await expectSuccessToast(page, 'updated');
  178 | 
  179 | 		// Sidebar stays open with updated heading
  180 | 		await expect(page.getByRole('heading', { name: 'Ana Modified' })).toBeVisible();
  181 | 
  182 | 		// Close and reopen to verify persistence in database
  183 | 		await closeDetailsPanelWithButton(page);
  184 | 		await openParticipantDetails(page, 'test_participant_1');
  185 | 		await expect(page.getByRole('heading', { name: 'Ana Modified' })).toBeVisible();
  186 | 	});
  187 | 
  188 | 	test('PRT-13 — Sidebar — validacija imena (samo črke)', async ({ authenticatedPage: page }) => {
  189 | 		await openParticipantDetails(page, 'test_participant_2');
```