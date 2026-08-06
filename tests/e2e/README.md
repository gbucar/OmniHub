# OmniHub E2E Tests

End-to-end testi za OmniHub Admin Dashboard z uporabo [Playwright](https://playwright.dev).

## Hitri začetek

### Način A: Vse v Dockerju (nič lokalnega)

```bash
# Iz korenskega direktorija repozitorija
cp .env.example .env
podman compose -f docker-compose.yml -f docker-compose.test.yml up -d
podman compose -f docker-compose.yml -f docker-compose.test.yml run --rm playwright-tests
podman compose -f docker-compose.yml -f docker-compose.test.yml down -v
```

> Potrebuješ samo `podman` ali `docker`. Node.js, npm, in Playwright **niso**
> potrebni lokalno — vse teče v kontejnerjih.

### Način B: API v Dockerju, testi lokalno (hitrejši razvoj)

```bash
# 1. Postavi infrastrukturo
cp .env.example .env
podman compose -f docker-compose.yml -f docker-compose.test.yml up -d

# 2. Namesti odvisnosti (samo prvič)
cd tests/e2e
npm ci

# 3. Poženi teste
npm test                     # vsi testi (headless)
npm run test:headed          # z vidnim brskalnikom
npm run test:ui              # interaktivni UI mode

# 4. Počisti
podman compose -f docker-compose.yml -f docker-compose.test.yml down -v
```

### Način C: Brez kontejnerjev (barebones)

```bash
# 1. Seed (opcijsko)
PGPASSWORD=postgres psql -h localhost -U postgres -f tests/e2e/seed.sql

# 2. Zaženi admin-dashboard (Vite dev server)
cd src/admin-dashboard && npm run dev

# 3. Poženi teste (v ločenem terminalu)
cd tests/e2e && TEST_BASE_URL=http://localhost:5173 npm test
```

## Poganjanje samo določenih testov

Vsi ukazi delujejo tako lokalno (Način B/C) kot v Dockerju (Način A —
samo dodaš `podman compose run --rm playwright-tests` pred ukazom).

```bash
# Samo en spec file
npx playwright test specs/devices.spec.ts

# En specifičen test po ID-ju
npx playwright test -g "DEV-01"

# Skupina testov po patternu (regex)
npx playwright test -g "PRT-0[1-8]"      # Participants table basics
npx playwright test -g "DEV-1[5-9]"       # Device details panel

# Z vidnim brskalnikom (debugging, samo Način B/C)
npx playwright test specs/devices.spec.ts --headed

# Interaktivni UI (samo Način B/C)
npm run test:ui

# Samo avtentikacijski testi
npx playwright test -g "AUTH-"
```

### V Dockerju (Način A)

```bash
# Samo en spec file v Dockerju
podman compose -f docker-compose.yml -f docker-compose.test.yml \
  run --rm playwright-tests specs/devices.spec.ts

# Specifičen test v Dockerju
podman compose -f docker-compose.yml -f docker-compose.test.yml \
  run --rm playwright-tests -g "PRT-12"
```

## Struktura

```
tests/e2e/
├── playwright.config.ts       # Playwright konfiguracija (Chromium, timeout 15s)
├── seed.sql                   # Deterministični testni podatki
├── package.json               # @playwright/test dependency
├── fixtures/
│   └── auth.ts               # Authenticated page fixture (admin_user)
├── helpers/
│   └── selectors.ts          # Semantic selector helperji
├── specs/
│   ├── auth.spec.ts          # Login, logout, redirect (6 testov)
│   ├── navigation.spec.ts    # Navbar, hamburger, theme (4 testi)
│   ├── participants.spec.ts  # Tabela, search, filter, paginacija, sidebar, CRUD (22 testov)
│   ├── studies.spec.ts       # Add study, validation (3 testi)
│   └── devices.spec.ts       # Tabela, filtri, paginacija, sidebar detajli (25 testov)
└── README.md
```

## Testni podatki

`seed.sql` vsebuje deterministične testne podatke:

| Entiteta | Število | Detajli |
|----------|---------|---------|
| Admin uporabnik | 1 | `admin_user` / `admin_geslo_123` |
| Webuser participantje | 5 | `test_participant_1..5` (geslo: `test123`) |
| Študije | 2 | Test Study Alpha, Test Study Beta |
| Senzorji | 2 | Test Sensor Alpha (ATMOTUBE_PRO), Test Sensor Beta (ATMOAIR_V2) |
| Data streams | 10 | 5 na senzor (temperature, humidity, pm25, pm10, voc) |
| Lokacije | 2 | Ljubljana, Maribor |
| Observations | 10 | 5 streams × 2 časovni točki za Sensor Alpha |

Vsak test spec file ustvari dodatne podatke z unikatnimi identifikatorji
(`Date.now()`), kar zagotavlja izolacijo med testi.

## CI

Testi se avtomatsko poženejo ob vsakem PR-ju na `dev`/`master`.
CI workflow (`.github/workflows/pr-dev.yml`) uporablja Docker stack —
enako kot Način A.

## Selektorska strategija

Testi uporabljajo **samo semantic selectors**:

| ✅ DOBRO | ❌ SLABO |
|----------|---------|
| `getByRole('button', { name: 'Add Participant' })` | `page.locator('.btn-primary')` |
| `getByLabel('Username')` | `page.locator('#modal-username')` |
| `getByText('Ana Test')` | `page.locator('td:nth-child(3)')` |
| `getByPlaceholder('Search participants...')` | `page.locator('[class*="input"]')` |

Dokumentirane CSS izjeme: `.toast`, `.alert-success`, `.alert-error`,
`#type-filter`, `#status-filter`.

## Dodajanje novih testov

1. Ustvari novo datoteko v `specs/`
2. Za avtenticirane teste: `import { test } from '../fixtures/auth'`
3. Za neavtenticirane: `import { test } from '@playwright/test'`
4. Uporabljaj semantic selectors (glej tabelo zgoraj)
5. Testni ID-ji: `XXX-NN` format (npr. `DEV-01`, `PRT-12`)
6. Vsak test naj uporablja unikaten identifikator (`Date.now()`)

## Znane omejitve

- **Brisanje podatkov**: testi ne brišejo ustvarjenih podatkov
- **Serial execution**: `workers: 1` lokalno (deljena baza), `workers: 3` v CI
