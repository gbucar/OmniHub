# OmniHub E2E Tests

End-to-end testi za OmniHub Admin Dashboard z uporabo [Playwright](https://playwright.dev).

## Hitri začetek

### 1. Postavi testni Docker stack

```bash
# Root repozitorija
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --wait
```

To zažene:
- **db** (TimescaleDB + migracije)
- **test-seed** (naloži `seed.sql` testne podatke)
- **postgrest** (API na `http://localhost:3000`)
- **admin-dashboard** (build iz source kode na `http://localhost:3001`)
- **apidocs** (Swagger na `http://localhost:8080`)

### 2. Namesti Playwright

```bash
cd tests/e2e
npm install
npx playwright install chromium
```

### 3. Poženi teste

```bash
npm test               # vsi testi (headless)
npm run test:headed    # z brskalnikom
npm run test:ui        # interaktivni UI mode
```

### 4. Počisti

```bash
# Iz root repozitorija
docker compose -f docker-compose.yml -f docker-compose.test.yml down -v
```

## Struktura

```
tests/e2e/
├── playwright.config.ts       # Playwright konfiguracija
├── seed.sql                   # Deterministični testni podatki
├── package.json               # Playwright dependency
├── fixtures/
│   └── auth.ts               # Authenticated page fixture
├── helpers/
│   └── selectors.ts          # Semantic selector helperji
├── specs/
│   ├── auth.spec.ts          # Login, logout, redirect (6 testov)
│   ├── navigation.spec.ts    # Navbar, hamburger, theme (4 testi)
│   ├── participants.spec.ts  # CRUD, search, filter, pagination (22 testov)
│   ├── studies.spec.ts       # Add study, validation (3 testi)
│   └── devices.spec.ts       # Tabela, filtri, paginacija, sidebar detajli (25 testov)
└── README.md
```

## Testni podatki

`seed.sql` (`98_seed_test_data.sql` v migracijah) vsebuje deterministične testne podatke v sveži bazo:

| Entiteta | Število | Detajli |
|----------|---------|---------|
| Admin uporabnik | 1 | `admin_user` / `admin_geslo_123` |
| Webuser participantje | 5 | `test_participant_1`..`_5` (geslo: `test123`) |
| Študije | 2 | "Test Study Alpha", "Test Study Beta" |
| Senzorji | 2 | "Test Sensor Alpha" (ATMOTUBE_PRO), "Test Sensor Beta" (ATMOAIR_V2) |
| Data streams | 10 | 5 na senzor (temperature, humidity, pm25, pm10, voc) |
| Lokacije | 2 | Ljubljana, Maribor |
| Observations | 10 | 5 streams × 2 časovni točki za Sensor Alpha |

**Test izolacija**: Vsak test spec file ustvari svoje dodatne podatke preko API-ja (`api.add_participant`, `api.bulk_import_participants`, POST na `/sensors`, itd.). To zagotavlja:
- **Izolacijo testov**: vsak test poveže na svoje podatke, brez interference med testi
- **Paralelni zagon**: več workerjev lahko teče brez težav
- **Determinizem**: vsak test poteka v svežem kontekstu z lastnimi podatki

**CI poganjanje**: GitHub Action pred zagonom baze zamenja migracije 98_atmotubes.sql in 99_*.sql z seed.sql (`rm -f src/db/migrations/9[89]_*.sql && cp tests/e2e/seed.sql src/db/migrations/98_seed_test_data.sql`), tako da baza vsebuje deterministične testne podatke že od začetka.

## CI

Za GitHub Actions uporabi `docker compose up --wait`:

```yaml
- name: Start test stack
  run: |
    cp .env.example .env
    docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --wait

- name: Run E2E tests
  working-directory: tests/e2e
  run: |
    npm ci
    npx playwright install chromium
    npm test

- name: Cleanup
  if: always()
  run: docker compose -f docker-compose.yml -f docker-compose.test.yml down -v
```

## Selektorska strategija

Testi uporabljajo **samo semantic selectors**:

| ✅ DOBRO | ❌ SLABO |
|----------|---------|
| `getByRole('button', { name: 'Add Participant' })` | `page.locator('.btn-primary')` |
| `getByLabel('Username')` | `page.locator('#modal-username')` |
| `getByText('Ana Test')` | `page.locator('td:nth-child(3)')` |
| `getByPlaceholder('Search participants...')` | `page.locator('[class*="input"]')` |

## Dodajanje novih testov

1. Ustvari novo datoteko v `specs/`
2. Uporabi `import { test } from '../fixtures/auth'` za avtenticirane teste
3. Uporabi `import { test } from '@playwright/test'` za neavtenticirane teste
4. Uporabljaj semantic selectors (nikoli CSS razredov)
5. Vsak test, ki ustvarja podatke, naj uporabi unikaten identifikator (`Date.now()`)

## Znane omejitve

- **Brisanje podatkov**: testi ne brišejo ustvarjenih podatkov (vsak uporabi unikaten username)
- **Serial execution**: testi se izvajajo zaporedno (`workers: 1`)
