# OmniHub Testna infrastruktura

## Pregled

OmniHub ima extensive end-to-end (E2E) testno zbirko napisano v
[Playwright](https://playwright.dev)-u. Testi pokrivajo vse glavne
funkcionalnosti admin dashboard-a: avtentikacijo, navigacijo,
upravljanje participantov, študij in naprav.

Skupno število testov: **60** (6 auth + 4 nav + 22 participants + 3 studies + 25 devices).

## Struktura

```
tests/e2e/
├── playwright.config.ts       # Playwright konfiguracija (Chromium, timeout 15s)
├── seed.sql                   # Deterministični testni podatki
├── package.json               # @playwright/test dependency
├── fixtures/
│   └── auth.ts                # Authenticated page fixture (admin_user)
├── helpers/
│   └── selectors.ts           # Semantic selector helper funkcije
├── specs/
│   ├── auth.spec.ts           # 6 testov: login, logout, redirect
│   ├── navigation.spec.ts     # 4 testi: navbar, hamburger, theme toggle
│   ├── participants.spec.ts   # 22 testov: tabela, search, filter, paginacija, sidebar, CRUD
│   ├── studies.spec.ts        # 3 testi: add study, validation
│   └── devices.spec.ts        # 25 testov: tabela, filtri, paginacija, sidebar detajli
└── README.md
```

## Poganjanje testov

Obstajajo **trije načini** poganjanja testov, odvisno od tega, kaj že
imaš nameščeno lokalno.

---

### Način 1: Vse v Dockerju (priporočeno za CI in zanesljivost)

Celoten stack (DB, API, admin dashboard, Playwright) teče v Docker
kontejnerjih. Ne potrebuješ lokalnega Node.js, npm, ali Playwright-a —
samo `podman` ali `docker`.

```bash
# Iz korenskega direktorija repozitorija
cp .env.example .env
podman compose -f docker-compose.yml -f docker-compose.test.yml up -d
podman compose -f docker-compose.yml -f docker-compose.test.yml run --rm playwright-tests
podman compose -f docker-compose.yml -f docker-compose.test.yml down -v
```

> **Opomba**: `podman compose` lahko nadomestiš z `docker compose` —
> ukazi so identični.

#### Poganjanje samo določenih testov znotraj Dockerja

Playwright runner v Dockerju sprejema vse standardne Playwright argumente:

```bash
# Samo en spec file
podman compose -f docker-compose.yml -f docker-compose.test.yml \
  run --rm playwright-tests specs/devices.spec.ts

# En specifičen test po ID-ju
podman compose -f docker-compose.yml -f docker-compose.test.yml \
  run --rm playwright-tests -g "DEV-01"

# Skupina testov po patternu (regex)
podman compose -f docker-compose.yml -f docker-compose.test.yml \
  run --rm playwright-tests -g "PRT-0[1-8]"

# Z --headed flagom (ni podprto v headless Dockerju, uporabi Način 2)
```

---

### Način 2: API/DB v Dockerju, testi lokalno (priporočeno za hiter razvoj)

API in baza tečeta v Dockerju, Playwright teste pa poženeš lokalno.
Potrebuješ lokalni Node.js in Playwright.

```bash
# 1. Zaženi samo infrastrukturo (brez playwright-tests)
cp .env.example .env
podman compose -f docker-compose.yml -f docker-compose.test.yml up -d

# 2. Namesti testne odvisnosti (samo prvič)
cd tests/e2e && npm ci

# 3. Poženi teste lokalno (proti http://localhost:3001)
cd tests/e2e && npm test

# 4. Počisti
podman compose -f docker-compose.yml -f docker-compose.test.yml down -v
```

#### Poganjanje samo določenih testov (lokalno)

```bash
# Samo en spec file (npr. devices)
npx playwright test specs/devices.spec.ts

# En specifičen test po ID-ju
npx playwright test -g "DEV-01"

# Skupina testov po patternu (regex)
npx playwright test -g "DEV-0[1-5]"     # Group 1 only
npx playwright test -g "PRT-1[5-9]"     # Group 4

# Interaktivni UI mode — omogoča ročno izbiranje testov
npm run test:ui

# Z vidnim brskalnikom (debugging)
npm run test:headed

# Samo avtentikacijski testi
npx playwright test -g "AUTH-"

# Samo navigacijski testi
npx playwright test -g "NAV-"

# Samo participants tabela testi (PRT-01 do PRT-08)
npx playwright test -g "PRT-0[1-8]"

# Samo participants CRUD testi (PRT-09 do PRT-22)
npx playwright test -g "PRT-(09|1[0-9]|2[0-2])"
```

---

### Način 3: Bearbones (brez kontejnerjev)

Če že imaš lokalno bazo (TimescaleDB) in PostgREST na `localhost:3000`:

```bash
# 1. Poženi seed (opcijsko — če rabiš sveže podatke)
PGPASSWORD=postgres psql -h localhost -U postgres -f tests/e2e/seed.sql

# 2. Zaženi admin-dashboard (Vite dev server na localhost:5173)
cd src/admin-dashboard && npm run dev

# 3. Poženi teste (v ločenem terminalu)
#    Privzeta baseURL (3001) je za Docker — za barebones nastavi 5173:
cd tests/e2e && TEST_BASE_URL=http://localhost:5173 npx playwright test
```

Admin dashboard mora biti dostopen na `http://localhost:5173` (privzeti
Vite port). Če uporabljaš drug port, ustrezno nastavi `TEST_BASE_URL`:

```bash
TEST_BASE_URL=http://localhost:3001 npx playwright test   # če uporabljaš port 3001
TEST_BASE_URL=http://localhost:5173 npx playwright test   # privzeti Vite port
```

Vsi ukazi za selektivno poganjanje testov (spec file, `-g` pattern,
`--headed`, `test:ui`) delujejo enako kot v Načinu 2.

## CI/CD

Testi se avtomatsko poženejo ob vsakem pull requestu na `dev` ali
`master` branch. CI workflow je definiran v
`.github/workflows/pr-dev.yml`:

- **Job 1 (`lint-and-build`)**: typecheck + lint + production build (~2 min)
- **Job 2 (`e2e-tests`)**: Docker stack + seed + Playwright tests (~5 min)

Oba joba morata uspeti predno se PR lahko merga.

## Testni podatki (seed.sql)

`seed.sql` vstavi deterministične podatke v svežo bazo. Vse vrednosti
so fiksne (UUID-ji, timestampi) — brez `NOW()` ali `random()`.

| Entiteta | Število | Detajli |
|----------|---------|---------|
| Admin | 1 | `admin_user` / `admin_geslo_123` |
| Webuser participantje | 5 | `test_participant_1..5` (geslo: `test123`) |
| Študije | 2 | Test Study Alpha, Test Study Beta |
| Senzorji | 2 | Test Sensor Alpha (ATMOTUBE_PRO, active), Test Sensor Beta (ATMOAIR_V2, inactive) |
| Ownerships | 3 | 2 participant-a na Alpha, 1 na Beta |
| Data streams | 10 | 5 na senzor (temperature, humidity, pm25, pm10, voc) |
| Lokacije | 2 | Ljubljana, Maribor |
| Observations | 10 | Samo za Sensor Alpha (5 streams × 2 časovni točki) |

## Selektorska strategija

Vsi testi uporabljajo **semantične selektorje** (Playwright accessibility-first API):

| ✅ DOBRO | ❌ SLABO |
|----------|---------|
| `getByRole('button', { name: 'Add Participant' })` | `page.locator('.btn-primary')` |
| `getByLabel('Username')` | `page.locator('#modal-username')` |
| `getByText('Ana Test')` | `page.locator('td:nth-child(3)')` |
| `getByPlaceholder('Search participants...')` | `page.locator('[class*="input"]')` |

Izjeme (kjer je CSS dovoljen):
- `.toast` — zaznavanje toast kontejnerja
- `.alert-success` / `.alert-error` — znotraj toasta
- `#type-filter`, `#status-filter` — ID-ji na filter dropdownih brez label

## Dodajanje novih testov

1. Ustvari `.spec.ts` datoteko v `tests/e2e/specs/`
2. Za avtenticirane teste: `import { test } from '../fixtures/auth'`
3. Za neavtenticirane teste: `import { test } from '@playwright/test'`
4. Uporabljaj izključno semantic selectors (glej tabelo zgoraj)
5. Testni ID-ji: format `XXX-NN` (npr. `DEV-01`, `AUTH-03`)
6. Vsak test naj bo neodvisen — za unikatne podatke uporabi `Date.now()`
7. Pri dodajanju sidebara: scopaj na `<aside>` element z `page.getByRole('complementary')`

## Znane omejitve

- **Paginacija z več stranmi**: Seed ima samo 2 senzorja in 5 participantov, zato
  testi za multi-page paginacijo uporabljajo največji page size (500) za združevanje
  vseh zapisov na eno stran.
- **Paralelizem**: `workers: 1` lokalno, `workers: 3` v CI — testi znotraj
  posameznega spec file-a se izvajajo zaporedno.
- **Brisanje podatkov**: Testi ne brišejo ustvarjenih podatkov (vsak
  uporabi unikaten identifikator).
