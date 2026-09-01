# PLAN: E2E Testiranje Admin Dashboarda

## 1. Povzetek

Implementacija E2E testov za admin dashboard z uporabo **Playwright**. Testi se izvajajo na svežem Docker stacku (ločen od produkcijskega), v katerega se pred testi naložijo deterministični testni podatki.

Cilj: testirati **funkcionalnost**, ne layouta — uporabljamo semantic selectors (`getByRole`, `getByLabel`, `getByText`), ne CSS selektorjev.

---

## 2. Raziskava — Feature Inventory

### 2.1. Strani in njihov status

| Stran | Ruta | Status |
|-------|------|--------|
| Dashboard | `/` | ✅ Welcome card + redirect link |
| Login | `/auth/login` | ✅ Username + geslo, JWT, error toast |
| Participants | `/users` | ✅ Tabela + search/filter/pagination + sidebar s CRUD |
| Devices | `/devices` | ⚠️ Delno (manjkajo `api.*` view-i in GRANT-i) |

### 2.2. ✅ Delujoči featurji (takoj testabilni)

| # | Feature | Stran |
|---|---------|-------|
| 1 | Prijava z veljavnimi credentials → redirect `/` | `/auth/login` |
| 2 | Prijava z napačnim geslom → error toast | `/auth/login` |
| 3 | Odjava → redirect `/auth/login` | Layout |
| 4 | Preusmeritev neprijavljenega na `/auth/login` | Vse |
| 5 | Navbar navigacija (Dashboard/Participants/Devices) | Layout |
| 6 | Hamburger dropdown (Users, Devices, Logout) | Layout |
| 7 | Theme toggle (light ↔ dark) | Layout |
| 8 | Seznam participantov (tabela) | `/users` |
| 9 | Iskanje po imenu/uporabniškem imenu | `/users` |
| 10 | Filter po študiji | `/users` |
| 11 | Paginacija (page size, prev/next) | `/users` |
| 12 | Dodaj participanta (modal) | `/users` |
| 13 | Dodaj študijo (modal) | `/users` |
| 14 | Odpri detajle participanta (sidebar slide-in) | `/users` |
| 15 | Edit personal info (name, age, sex) | Sidebar |
| 16 | Dodaj participanta v študijo | Sidebar |
| 17 | Edit study membership period | Sidebar |
| 18 | Assign napravo participantu | Sidebar |
| 19 | Edit ownership period | Sidebar |
| 20 | Toast obvestila (success/error) | Vse |
| 21 | Seznam naprav (tabela) | `/devices` |
| 22 | Iskanje naprav | `/devices` |
| 23 | Filter po tipu/statusu naprave | `/devices` |
| 24 | Paginacija naprav | `/devices` |

### 2.3. ⚠️ Delno delujoči (potrebujejo `22_views_and_grants.sql`)

| # | Feature | Težava |
|---|---------|--------|
| 25 | Edit device info (sidebar) | 403 — manjka `GRANT` na `api.sensors` |
| 26 | Data Streams prikaz (sidebar) | 404 — `api.data_streams` view ne obstaja |
| 27 | Ownerships prikaz (sidebar) | Username manjka — `api.users` view ne obstaja |
| 28 | Recent Observations prikaz (sidebar) | Embed na `data_streams` ne deluje |

### 2.4. ❌ Naimplementirani (prihodnost)

- Add Device modal (odstranjen iz scope-a trenutne faze)
- Admin password reset za participante
- Bulk operacije (CSV uvoz/izvoz)
- Brisanje senzorja/participanta
- Vizualizacije (grafi)
- Obvestila in pragovi
- Audit log

---

## 3. Arhitektura testiranja

### 3.1. Testni stack

Namesto testiranja na obstoječem development stacku se za vsak testni zagon postavi **svež Docker stack**:

```
docker compose \
  -f docker-compose.yml \
  -f docker-compose.test.yml \
  up -d --wait
```

`docker-compose.test.yml` je **override file**, ki:
- Ohrani vse service iz `docker-compose.yml` (db, postgrest, apidocs, admin-dashboard)
- **Ne** zažene `pipelines` (ni potreben za UI teste)
- Doda `test-seed` service, ki po zagonu DB-ja naloži testne podatke
- Doda `healthcheck` na postgrest, da Playwright ve kdaj je API ready
- Builda `admin-dashboard` iz lokalne source kode (ne uporablja pre-built image-a)

### 3.2. Testni podatki — `tests/e2e/seed.sql`

`seed.sql` je običajna SQL datoteka, ki se izvede v svežo bazo (že z vsemi migracijami). Vsebuje **deterministične podatke** — testi točno vedo, kaj pričakovati.

**Zakaj ločen seed in ne `populate.sql`?**
- `populate.sql` je development tool z naključnimi vrednostmi (`random()`, variabilni timestampi)
- Testni seed mora imeti fiksne, predvidljive vrednosti za assertanje
- Testni seed vsebuje podatke, ki so smiselni za vse teste (participante, študije, senzorje, observations)

**Kako se seed izvede?**

`docker-compose.test.yml` vsebuje enkratni `test-seed` service:

```yaml
# docker-compose.test.yml
services:
  test-seed:
    image: docker.io/postgres:18
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./tests/e2e/seed.sql:/seed.sql:z
    entrypoint:
      - /bin/bash
      - -c
      - |
        echo "⏳ Waiting for DB to be ready..."
        until pg_isready -h db -U postgres -d postgres 2>/dev/null; do
          sleep 1
        done
        echo "🌱 Seeding test data..."
        psql "postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres" -f /seed.sql
        echo "✅ Seed complete"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGPASSWORD: ${POSTGRES_PASSWORD}
```

**Potek zagona:**
1. `docker compose up -d --wait` zažene vse service
2. `db` container se zažene, TimescaleDB entrypoint požene vse migracije iz `docker-entrypoint-initdb.d` (po abecednem vrstnem redu)
3. `test-seed` počaka na `db: service_healthy`, nato izvede `/seed.sql` — **počaka, da so migracije končane**
4. `test-seed` eksitira (exit 0)
5. Playwright začne s testi

**Vsebina `seed.sql`:**

```sql
-- ============================================================
-- Test data seed for E2E tests
-- All values are DETERMINISTIC — tests rely on exact values.
-- ============================================================

SET search_path TO auth, data, public;

-- ----------------------------------------------------------
-- 1. Admin user (used for login in all tests)
-- ----------------------------------------------------------
INSERT INTO auth.users (username, password, role)
VALUES ('admin_user', 'admin_geslo_123', 'admin');

-- ----------------------------------------------------------
-- 2. Webuser participants (exactly 5, with known names)
-- ----------------------------------------------------------
INSERT INTO auth.users (username, password, role) VALUES
  ('test_participant_1', 'test123', 'webuser'),
  ('test_participant_2', 'test123', 'webuser'),
  ('test_participant_3', 'test123', 'webuser'),
  ('test_participant_4', 'test123', 'webuser'),
  ('test_participant_5', 'test123', 'webuser');

INSERT INTO data.participants (user_id, properties)
SELECT
  id,
  CASE username
    WHEN 'test_participant_1' THEN '{"name":"Ana Test", "age":25, "sex":"female", "type":"citizen_scientist"}'
    WHEN 'test_participant_2' THEN '{"name":"Bojan Test", "age":32, "sex":"male",   "type":"citizen_scientist"}'
    WHEN 'test_participant_3' THEN '{"name":"Cvetka Test","age":45, "sex":"female", "type":"citizen_scientist"}'
    WHEN 'test_participant_4' THEN '{"name":"David Test", "age":28, "sex":"male",   "type":"citizen_scientist"}'
    WHEN 'test_participant_5' THEN '{"name":"Eva Test",   "age":52, "sex":"female", "type":"citizen_scientist"}'
  END::jsonb
FROM auth.users
WHERE role = 'webuser';

-- ----------------------------------------------------------
-- 3. Studies (exactly 2, with known names)
-- ----------------------------------------------------------
INSERT INTO data.studies (name, active_period) VALUES
  ('Test Study Alpha',
   tstzrange('2024-01-01 00:00:00+00', '2025-12-31 23:59:59+00', '[]')),
  ('Test Study Beta',
   tstzrange('2024-06-01 00:00:00+00', '2025-06-30 23:59:59+00', '[]'));

-- Assign participants 1-3 to Study Alpha, 4-5 to Study Beta
INSERT INTO data.many_participants_studies (user_id, study_id)
SELECT
  p.user_id,
  s.id
FROM data.participants p
JOIN auth.users u ON p.user_id = u.id
CROSS JOIN data.studies s
WHERE (u.username IN ('test_participant_1','test_participant_2','test_participant_3')
       AND s.name = 'Test Study Alpha')
   OR (u.username IN ('test_participant_4','test_participant_5')
       AND s.name = 'Test Study Beta');

-- ----------------------------------------------------------
-- 4. Sensors (exactly 2, with known names)
-- ----------------------------------------------------------
INSERT INTO data.sensors (name, description, sensor_type, properties) VALUES
  ('Test Sensor Alpha',
   'Test sensor for E2E testing — type PRO',
   'ATMOTUBE_PRO',
   '{"status":"active","model":"Pro","version":"2.0"}'::jsonb),
  ('Test Sensor Beta',
   'Test sensor for E2E testing — type V2',
   'ATMOAIR_V2',
   '{"status":"inactive","model":"V2","version":"1.5"}'::jsonb);

-- ----------------------------------------------------------
-- 5. Ownerships (assign sensors to participants)
--    Participant 1 & 2 get Sensor Alpha, Participant 3 gets Sensor Beta
-- ----------------------------------------------------------
INSERT INTO data.ownerships (user_id, sensor_id, start_date, end_date)
SELECT
  p.user_id,
  CASE
    WHEN u.username IN ('test_participant_1', 'test_participant_2')
      THEN (SELECT id FROM data.sensors WHERE name = 'Test Sensor Alpha')
    ELSE (SELECT id FROM data.sensors WHERE name = 'Test Sensor Beta')
  END AS sensor_id,
  '2024-03-01 00:00:00+00'::timestamptz,
  '2025-03-01 00:00:00+00'::timestamptz
FROM data.participants p
JOIN auth.users u ON p.user_id = u.id
WHERE u.username IN ('test_participant_1', 'test_participant_2', 'test_participant_3');

-- ----------------------------------------------------------
-- 6. Data streams (for each sensor)
-- ----------------------------------------------------------
INSERT INTO data.data_stream (sensor_id, name, description, unit_of_measurement)
SELECT s.id, t.name, 'Test measurements', t.unit
FROM data.sensors s
CROSS JOIN (
  VALUES
    ('temperature',  '°C'),
    ('humidity',     '%'),
    ('pm25',         'µg/m³'),
    ('pm10',         'µg/m³'),
    ('voc',          'ppb')
) AS t(name, unit);

-- ----------------------------------------------------------
-- 7. Locations
-- ----------------------------------------------------------
INSERT INTO data.locations (geog, properties) VALUES
  (ST_GeogFromText('SRID=4326;POINT(14.5058 46.0569)'),
   '{"city":"Ljubljana","station":"Center"}'::jsonb),
  (ST_GeogFromText('SRID=4326;POINT(15.6459 46.5547)'),
   '{"city":"Maribor","station":"Tezno"}'::jsonb);

-- ----------------------------------------------------------
-- 8. Observations (fixed timestamps for deterministic testing)
-- ----------------------------------------------------------
INSERT INTO data.observations (data_stream_id, phenomenon_time, result, location_id)
SELECT
  ds.id,
  tstzrange('2026-01-15 10:00:00+00'::timestamptz,
            '2026-01-15 10:00:00+00'::timestamptz, '[]'),
  CASE
    WHEN ds.name = 'temperature' THEN 22.5
    WHEN ds.name = 'humidity'    THEN 55.0
    WHEN ds.name = 'pm25'        THEN 12.3
    WHEN ds.name = 'pm10'        THEN 25.7
    ELSE 100.0
  END,
  (SELECT id FROM data.locations WHERE properties->>'city' = 'Ljubljana')
FROM data.data_stream ds
WHERE ds.sensor_id = (SELECT id FROM data.sensors WHERE name = 'Test Sensor Alpha');

INSERT INTO data.observations (data_stream_id, phenomenon_time, result, location_id)
SELECT
  ds.id,
  tstzrange('2026-01-15 11:00:00+00'::timestamptz,
            '2026-01-15 11:00:00+00'::timestamptz, '[]'),
  CASE
    WHEN ds.name = 'temperature' THEN 23.1
    WHEN ds.name = 'humidity'    THEN 52.0
    WHEN ds.name = 'pm25'        THEN 10.8
    WHEN ds.name = 'pm10'        THEN 22.4
    ELSE 95.0
  END,
  (SELECT id FROM data.locations WHERE properties->>'city' = 'Maribor')
FROM data.data_stream ds
WHERE ds.sensor_id = (SELECT id FROM data.sensors WHERE name = 'Test Sensor Alpha');
```

**Zakaj deterministični podatki?**

Vsak test ve točno kaj pričakovati:
- `await page.getByText('Ana Test')` — vedno obstaja
- `await page.getByText('Test Sensor Alpha')` — vedno obstaja
- Iskanje po "Bojan" vrne natanko 1 rezultat
- Filter po študiji "Test Study Alpha" vrne 3 participante
- Paginacija s `pageSize=2` da 3 strani za 5 participantov
- Tabela naprav ima 2 vrstici

### 3.3. Lokacija in struktura

```
tests/e2e/
├── playwright.config.ts        # Playwright konfiguracija
├── seed.sql                    # Deterministični testni podatki
├── fixtures/
│   └── auth.ts                # Login helper, authenticated page
├── helpers/
│   └── selectors.ts           # Semantic selector helpers
├── specs/
│   ├── auth.spec.ts           # Login, logout, redirect
│   ├── navigation.spec.ts     # Navbar, hamburger, theme
│   ├── participants.spec.ts   # Vse participant funkcionalnosti
│   ├── devices.spec.ts        # Vse device funkcionalnosti (Faza 2)
│   └── studies.spec.ts        # Študije
└── README.md
```

### 3.4. Selektorska strategija

```
✅ DOBRO (vedno uporabi):
  page.getByRole('button', { name: 'Add Participant' })
  page.getByLabel('Username')
  page.getByText('Ana Test')
  page.getByPlaceholder('Search participants...')
  page.getByRole('heading', { name: 'Participants' })
  page.getByRole('table')
  page.getByRole('row', { name: /test_participant_1/ })

⚠️ SAMO KADAR NI DRUGE MOŽNOSTI:
  page.getByTestId('participants-table')
  page.getByTestId('toast-notification')

❌ NIKOLI:
  page.locator('.btn-primary')        # CSS class
  page.locator('div.card:nth-child(3)')  # krhko DOM drevo
```

**Če gumb nima smiselnega text labela**, naj se doda `aria-label` v komponenti (ne `data-testid`):
```html
<button class="btn btn-circle btn-ghost" aria-label="Close panel">✕</button>
```

---

## 4. Katalog testov

### 4.1. Faza 1 — Retroaktivni testi (že delujoči featurji)

🔴 = kritično, 🟡 = pomembno, 🟢 = nice-to-have

| ID | Test | Prior |
|----|------|-------|
| **specs/auth.spec.ts** (6 testov) | | |
| AUTH-01 | Prijava z veljavnimi credentials → redirect `/` | 🔴 |
| AUTH-02 | Prijava z napačnim geslom → error toast | 🔴 |
| AUTH-03 | Login s praznimi polji → HTML5 validation | 🟡 |
| AUTH-04 | Odjava prek dropdowna → redirect `/auth/login` | 🔴 |
| AUTH-05 | Neprijavljen → avtomatski redirect na login | 🔴 |
| AUTH-06 | Po odjavi `/users` → redirect na login | 🟡 |
| **specs/navigation.spec.ts** (4 testi) | | |
| NAV-01 | Navbar linki: Dashboard, Participants, Devices | 🔴 |
| NAV-02 | Hamburger dropdown: Users, Devices, Logout | 🟡 |
| NAV-03 | Tema se zamenja ob kliku sun/moon | 🟡 |
| NAV-04 | Tema se ohrani po reloadu strani | 🟢 |
| **specs/participants.spec.ts** (22 testov) | | |
| PRT-01 | Seznam participantov se pravilno naloži | 🔴 |
| PRT-02 | Iskanje po imenu (npr. "Ana" → 1 rezultat) | 🔴 |
| PRT-03 | Iskanje po uporabniškem imenu | 🟡 |
| PRT-04 | Filter po študiji ("Test Study Alpha" → 3 rezultati) | 🔴 |
| PRT-05 | Paginacija: spreminjanje page size | 🟡 |
| PRT-06 | Paginacija: prev/next gumba | 🟡 |
| PRT-07 | "X of Y records" prikazuje pravilno | 🟢 |
| PRT-08 | "No participants found" ob neobstoječem iskanju | 🟢 |
| PRT-09 | Dodajanje novega participanta → pojavi se v tabeli | 🔴 |
| PRT-10 | Validacija: prazen username → HTML5 required | 🟡 |
| PRT-11 | Odpiranje detajlov (sidebar slide-in) | 🔴 |
| PRT-12 | Sidebar: edit personal info (name, age, sex) | 🔴 |
| PRT-13 | Sidebar: validacija imena (samo črke) → error toast | 🟡 |
| PRT-14 | Sidebar: Cancel urejanja → stare vrednosti | 🟢 |
| PRT-15 | Sidebar: dodajanje v študijo | 🔴 |
| PRT-16 | Sidebar: edit study membership period | 🟡 |
| PRT-17 | Sidebar: assign naprave | 🔴 |
| PRT-18 | Sidebar: edit ownership period | 🟡 |
| PRT-19 | Sidebar: zapiranje z ✕ gumbom | 🟢 |
| PRT-20 | Sidebar: zapiranje s klikom na backdrop | 🟢 |
| PRT-21 | Success toast po dodajanju participanta | 🟡 |
| PRT-22 | Error toast ob validacijski napaki | 🟡 |
| **specs/studies.spec.ts** (3 testi) | | |
| STD-01 | Dodajanje nove študije | 🔴 |
| STD-02 | Validacija: prazno ime → error toast | 🟡 |
| STD-03 | Validacija: end < start → error toast | 🟡 |

### 4.2. Faza 2 — Devices page (po DB fixu)

Predpogoj: migracija `22_views_and_grants.sql` v `src/db/migrations/`

| ID | Test | Prior |
|----|------|-------|
| **specs/devices.spec.ts** (17 testov) | | |
| DEV-01 | Seznam naprav se pravilno naloži | 🔴 |
| DEV-02 | Iskanje po imenu naprave | 🔴 |
| DEV-03 | Iskanje po opisu naprave | 🟡 |
| DEV-04 | Filter po sensor_type | 🔴 |
| DEV-05 | Filter po statusu (active/inactive/maintenance) | 🔴 |
| DEV-06 | Paginacija naprav | 🟡 |
| DEV-07 | Odpiranje detajlov naprave (sidebar) | 🔴 |
| DEV-08 | Sidebar: edit info (name, type, status, desc) | 🔴 |
| DEV-09 | Sidebar: edit credential ID | 🟡 |
| DEV-10 | Sidebar: edit metadata (key/value) | 🟡 |
| DEV-11 | Sidebar: status badge pravilna barva | 🟡 |
| DEV-12 | Sidebar: Data Streams kartica prikazuje seznam | 🔴 |
| DEV-13 | Sidebar: Ownerships kartica prikazuje dodeljene | 🔴 |
| DEV-14 | Sidebar: Recent Observations prikazuje zadnje | 🔴 |
| DEV-15 | Sidebar: "Last activity" relativni čas | 🟢 |
| DEV-16 | Sidebar: Cancel urejanja info card | 🟢 |
| DEV-17 | Sidebar: zapiranje (✕ + backdrop) | 🟢 |

### 4.3. Faza 3 — Prihodnji featurji

| ID | Feature | Ko bo implementirano |
|----|---------|---------------------|
| FUT-01 | Admin password reset za participante | `TODO.md` → RPC + UI |
| FUT-02 | Add Device modal | Ko se doda nazaj v `/devices` |
| FUT-03 | Bulk CSV uvoz | Bulk operacije |
| FUT-04 | Brisanje senzorja/participanta | Soft/hard delete |
| FUT-05 | Vizualizacije (grafi) | Dashboard grafi |
| FUT-06 | API key management | API ključi |

---

## 5. Testni podatki — `seed.sql`

### 5.1. Alternativni pristopi (primerjava)

| Pristop | ✅ Prednosti | ❌ Slabosti |
|---------|-------------|------------|
| **A) Dedicated compose service** (izbran) | Izolacija od migracij, ekspliciten ordering, enostaven CI | Dodaten container |
| B) Mount v initdb (kot `98_seed.sql`) | Brez dodatnega containerja | Fragile ordering z obstoječimi migracijami, težko debugirati |
| C) API-based seed (HTTP klici) | Realistično, testira isti API kot UI | Počasno, odvisno od API stanja |

### 5.2. Zakaj `test-seed` service in ne mount v init?

Obstoječe migracije se izvedejo avtomatsko ob prvem zagonu DB containerja (TimescaleDB entrypoint sortira datoteke v `/docker-entrypoint-initdb.d/`). Če bi dodali seed tja, bi moral imeti pravilno ime (npr. `99_test_seed.sql`), a dev seed datoteke so zdaj v `src/db/dev/` in se ne izvajajo avtomatsko. Namesto tega uporabimo **ločen enkratni service**, ki:

1. Počaka na `db: service_healthy` (migracije so že končane)
2. Izvede `psql -f seed.sql` — transakcijsko, deterministično
3. Eksitira — Playwright lahko začne

### 5.3. Kako se seed poveže na DB?

Service uporablja **isti `POSTGRES_PASSWORD`** iz `.env` datoteke. Connection string se sestavi v `entrypoint` ukazu:

```bash
psql "postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres" -f /seed.sql
```

`PGPASSWORD` environment spremenljivka omogoča `pg_isready` brez interaktivnega vnosa gesla.

### 5.4. Kaj če se podatki spremenijo med testi?

Vsak test, ki **ustvarja** podatke (npr. PRT-09 — dodajanje participanta), mora:

1. Uporabiti **unikaten username** (npr. `e2e_test_user_${Date.now()}`) da ne kolidira z drugimi testi
2. Po testu **počistiti** ustvarjene podatke prek API-ja (DELETE klic)

Ali pa — enostavneje — vsak test uporabi **drugačen username** z uporabo `test.info().title` ali timestampa.

---

## 6. Implementacija — koraki

### 6.1. Faza 0: Infrastruktura

| Korak | Datoteka | Opis |
|-------|---------|------|
| 0.1 | `tests/e2e/seed.sql` | Deterministični testni podatki (glej poglavje 3.2) |
| 0.2 | `docker-compose.test.yml` | Override za testni stack + `test-seed` service |
| 0.3 | `tests/e2e/playwright.config.ts` | Playwright config z `baseURL` in `webServer` |
| 0.4 | `tests/e2e/.env.test` | TEST_BASE_URL in druge testne spremenljivke |
| 0.5 | `package.json` (root) | `"test:e2e"` script |
| 0.6 | `tests/e2e/fixtures/auth.ts` | Authenticated page fixture |
| 0.7 | `tests/e2e/helpers/selectors.ts` | Pomožni semantic selectorji |

### 6.2. Faza 1: Retroaktivni testi (po prioriteti)

| Vrstni red | Spec datoteka | Št. testov |
|-----------|--------------|-----------|
| 1. | `specs/auth.spec.ts` | 6 |
| 2. | `specs/navigation.spec.ts` | 4 |
| 3. | `specs/studies.spec.ts` | 3 |
| 4. | `specs/participants.spec.ts` | 22 |

### 6.3. Faza 2: Devices testi

Predpogoj: `22_views_and_grants.sql` migracija

| Vrstni red | Spec datoteka | Št. testov |
|-----------|--------------|-----------|
| 1. | `specs/devices.spec.ts` | 17 |

---

## 7. `docker-compose.test.yml` — celoten načrt

```yaml
# docker-compose.test.yml
# Override za E2E testni stack. Uporabi skupaj z docker-compose.yml:
#   docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --wait

services:
  # --- Override: admin-dashboard se builda iz source, ne uporablja image ---
  admin-dashboard:
    build:
      context: ./src/admin-dashboard
    # image odstranimo — vedno build iz source
    environment:
      - PUBLIC_POSTGREST_URL=${POSTGREST_URL:-http://localhost:3000}
    ports:
      - "3001:5173"
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:5173"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  # --- Override: postgrest healthcheck ---
  postgrest:
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3000"]
      interval: 3s
      timeout: 2s
      retries: 10
      start_period: 5s

  # --- NOVO: Enkratni seed service ---
  test-seed:
    image: docker.io/postgres:18
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./tests/e2e/seed.sql:/seed.sql:z
    entrypoint:
      - /bin/bash
      - -c
      - |
        set -e
        echo "⏳ Waiting for database to accept connections..."
        until pg_isready -h db -U postgres -d postgres 2>/dev/null; do
          sleep 1
        done
        echo "🌱 Seeding test data from /seed.sql..."
        psql "postgres://postgres:$${POSTGRES_PASSWORD}@db:5432/postgres" -f /seed.sql
        echo "✅ Seed complete."
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGPASSWORD: ${POSTGRES_PASSWORD}

  # --- NE zaženemo pipelines v testnem stacku ---
  pipelines:
    profiles:
      - production
```

---

## 8. Potencialni `data-testid` atributi

Samo za primere, kjer semantic selektorji res ne zadoščajo. **Dodaj jih v komponente, ne v testno kodo**:

```svelte
<!-- V tabeli — za čakanje na konec nalaganja -->
<table data-testid="participants-table">...</table>

<!-- Toast — ni role/accessible name -->
<div data-testid="toast-notification" class="toast">...</div>

<!-- Loading stanje -->
<span data-testid="loading-spinner" class="loading loading-spinner"></span>
```

**Pravilo**: pred dodajanjem `data-testid` se vprašaj: "ali lahko to selektiram z `getByRole`/`getByLabel`/`getByText`?"

---

## 9. CI integracija (GitHub Actions)

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on:
  pull_request:
    branches: [master, dev]
  push:
    branches: [master, dev]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup test environment
        run: cp .env.example .env

      - name: Start test stack
        run: |
          docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --wait
          docker compose ps

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run tests
        run: npx playwright test --config tests/e2e/playwright.config.ts
        env:
          TEST_BASE_URL: http://localhost:3001

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

      - name: Cleanup
        if: always()
        run: docker compose -f docker-compose.yml -f docker-compose.test.yml down -v
```

---

## 10. Kriteriji sprejetja

- [ ] `tests/e2e/seed.sql` doda deterministične podatke v svežo DB
- [ ] `docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --wait` uspešno zažene vse service + seed
- [ ] Vsi testi iz **Faze 1** (auth, navigation, participants, studies) prehajajo
- [ ] Vsi testi uporabljajo **semantic selectors** (ne CSS razredov)
- [ ] Po testih `docker compose down -v` počisti vse volumne
- [ ] Testi se lahko poženejo lokalno z enim ukazom
- [ ] CI workflow prehaja na PR-jih
- [ ] Test report se generira (HTML) ob neuspehu

### Dodano kasneje (Faza 2):
- [ ] `22_views_and_grants.sql` migracija je v repozitoriju
- [ ] Vsi testi iz **Faze 2** (devices) prehajajo

### Dodano kasneje (Faza 3):
- [ ] Testi za nove featurje ko bodo implementirani
