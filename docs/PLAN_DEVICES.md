# PLAN: stran `/devices` — Upravljanje senzorjev

## 1. Povzetek

Nova stran `/devices` v admin dashboardu za pregled senzorjev. Dizajn je paralelen `/users`: glavna tabela z iskanjem/filtriranjem/paginacijo, detajli v desnem slide-in sidebaru (identično `ParticipantDetailsPanel`). **Read-only** — brez urejanja senzorjev, samo prikaz informacij. **Brez sprememb na API/bazi** — vse počnemo s PostgREST direktno (RLS že dovoljuje admin SELECT na `data.sensors`, `data.ownerships`, `data.data_streams`, `data.observations`, `data.locations`).

**Barvna shema:** primarna cyan (identično `/users`) — ohranjamo doslednost z OmniHub dizajnom. Warning/amber barvo obdržimo le na **gumbu za dodeljevanje naprave znotraj sidebara** (paralela z obstoječim `AddDeviceModal`), kjer je vizualno smiselno poudariti "dodeli napravo".

## 2. Obseg 1. faze (todo po prioriteti)

| TODO | 1. faza | Opombe |
|---|---|---|
| Celovit pregled vseh senzorjev z iskanjem in filtriranjem | ✅ | Search + filter po `sensor_type` + filter po `status` (iz `properties.status`) + paginacija |
| Dodajanje novih senzorjev | ❌ | Izven scope-a (prihodnja faza) |
| Razvrščanje po tipu/lokaciji | ⚠️ Delno | Sort po stolpcih v tabeli. "Lokacija" ni atribut senzorja (senzor nima koordinat) — zato samo sort po tipu in zadnji aktivnosti. |
| Urejanje nastavitev (ime, status, metapodatki) | ❌ | Izven scope-a — sidebar je read-only |
| Spremljanje stanja in aktivnosti | ✅ | `last_activity` iz `list_sensors` prikazan kot relativni čas. Uptime izpustimo (manjka sistemska telemetrija). |
| Vizualizacija surovih in agregiranih podatkov | ❌ | Preseženo po dogovoru (prihodnja faza) |
| Nastavitve obvestil in pragov | ❌ | Ni v bazi, zahteva večji feature |
| Skupinske operacije (bulk) | ❌ | Preseženo po dogovoru (prihodnja faza) |
| Brisanje senzorja | ❌ | Preseženo po dogovoru (prihodnja faza) |

## 3. Analiza obstoječega API-ja

### 3.1. Že implementirano (uporabno takoj)
| Funkcionalnost | Lokacija | Status |
|---|---|---|
| `data.sensors` tabela + RLS | `src/db/migrations/20_init.sql:127` | ✅ Admin: SELECT/INSERT/UPDATE |
| `api.list_sensors` view z `last_activity` | `src/db/migrations/20_init.sql:823` | ✅ Vrne vse stolpce + `max(upper(phenomenon_time))` |
| `api.sensors` view | `src/db/migrations/20_init.sql:960` | ✅ SELECT za admin |
| `data.data_streams` + RLS | `src/db/migrations/20_init.sql:298` | ✅ Admin: SELECT/INSERT/UPDATE |
| `data.observations` + `api.observations` view | `src/db/migrations/20_init.sql:390,500` | ✅ SELECT za admin |
| `data.ownerships` + RLS + `api.ownerships` | `src/db/migrations/20_init.sql:162,950` | ✅ Admin: SELECT/INSERT/UPDATE |
| `getSensors()` (TypeScript) | `src/lib/api/sensors.ts:4` | ✅ Bere `list_sensors` |
| `getUserOwnerships()` | `src/lib/api/sensors.ts:9` | ✅ Bere ownerships + join v `list_sensors` |
| `addOwnership()` / `updateOwnership()` / `removeOwnership()` | `src/lib/api/sensors.ts:43,68,104` | ✅ Za dodeljevanje senzorjev participantom |

### 3.2. Manjka v frontendu (treba dodati)
- ✅ Stran `/devices` — implementirano
- ✅ Navigacija v `+layout.svelte` — implementirano
- ✅ Komponenta `DeviceDetailsPanel.svelte` — implementirano (read-only, 4 karte)
- ✅ Komponenta `SensorStatusBadge.svelte` — implementirano
- ✅ API helperji: `getSensorStreams`, `getSensorOwnerships`, `getRecentObservations` — implementirano
- ❌ API helper `addSensor` — izven scope-a te faze
- ❌ `AddSensorModal.svelte` — izven scope-a te faze

### 3.3. Zakaj potrebujemo samo 2 view-a
- `data.sensors` že ima RLS za admin SELECT.
- `data.data_streams` že ima RLS za admin/researcher SELECT.
- `data.ownerships` že ima RLS za admin SELECT.
- `list_sensors` view že vrača `last_activity`.
- **Manjkata samo** `api.data_streams` in `api.locations` view-a — brez njih PostgREST ne more streči data_streams querijev in observation embedov.
- Za frontend ne potrebujemo enrichment view-a — lastnik, število streamov in observationov prikažemo samo v detajlnem sidebaru z dodatnimi query-ji.
- **Urejanje senzorjev je izven scope-a** — `GRANT UPDATE ON api.sensors` ni potreben.

## 4. Nove in spremenjene datoteke

### 4.1. Nove datoteke (frontend)
```
src/admin-dashboard/src/routes/devices/
  +page.svelte                              # glavna tabela
  +page.ts                                  # SSR-safe page loader

src/admin-dashboard/src/lib/components/
  DeviceDetailsPanel.svelte                 # desni slide-in sidebar (read-only, 4 karte)
  SensorStatusBadge.svelte                  # badge za status
```
> **Opomba**: `DeviceMetadataEditor.svelte` in `AddSensorModal.svelte` sta bila odstranjena — urejanje senzorjev in dodajanje novih je izven scope-a te faze.

### 4.2. Spremenjene datoteke
- `src/admin-dashboard/src/routes/+layout.svelte` — dodati `/devices` v `navItems` in dropdown menu.
- `src/admin-dashboard/src/lib/api/sensors.ts` — dodati `addSensor`, `updateSensor`, `getSensorStreams`, `getSensorOwnerships`, `getRecentObservations`.
- `src/admin-dashboard/src/lib/api/types.ts` — razširiti `Sensor` tip; dodati `NewSensor`, `DataStream`, `SensorOwnership`, `RecentObservation`.
- `src/admin-dashboard/src/lib/api/index.ts` — izvoz novih funkcij in tipov.

**Brez** migracij, **brez** `db.dbm` sprememb, **brez** novih RPC-jev.

### 4.3. Referenčne datoteke za dizajn
- `src/admin-dashboard/src/routes/users/+page.svelte` — struktura glavne strani
- `src/admin-dashboard/src/lib/components/ParticipantDetailsPanel.svelte` — struktura desnega sidebara
- `src/admin-dashboard/src/lib/components/modals/AddDeviceModal.svelte` — obstoječi modal za dodeljevanje (priredimo in razširimo za Add Sensor)

## 5. UX zasnova

### 5.1. Glavna stran `/devices/+page.svelte`

**Barvna shema:** primarna cyan (`text-primary`, `bg-primary`, `btn-primary`) — identično `/users`.

**Header:**
- Naslov "Devices" (font-display, 2xl, bold)
- Podnaslov: "X of Y records" z loading spinnerjem
- Gumb "Add Device" (btn-primary, ikona +)

**Filter card** (3 stolpci, responsive):
- Search input (po imenu, description, JSONB vrednostih)
- Sensor type filter (select: All + dinamične vrednosti iz naloženih senzorjev)
- Status filter (select: All / Active / Inactive / Maintenance / Unknown)
- Records per page (10/25/50/100/500)

**Tabela** (4 stolpci):
| Stolpec | Vir | Prikaz |
|---|---|---|
| Name | `sensors.name` | ⚙️ ikona (primary barva) + ime (klik → odpre sidebar) |
| Sensor type | `sensors.sensor_type` | Badge `badge-soft badge-primary` |
| Status | `properties.status` ali "unknown" | `<SensorStatusBadge>` |
| Last activity | `list_sensors.last_activity` | Relativni čas ("2h ago", "3d ago", "Never") |

**Paginacija** na dnu (identično `/users`).

**Empty state** — ikona ⚙️ + "No devices found".

**Hover/Click:** cela vrstica je klikabilna (cursor-pointer, hover bg-primary/5) — odpre `DeviceDetailsPanel`.

### 5.2. Detajlni sidebar `DeviceDetailsPanel.svelte`

**Struktura** (paralelna s `ParticipantDetailsPanel`):
- Backdrop (fixed inset-0, bg-black/50, backdrop-blur, klik → zapri)
- Aside (fixed top-0 right-0, max-w-md, h-full, overflow-y-auto, slide-in animacija)

**Header (sticky):** ikona ⚙️ + ime senzorja + sensor_type badge + close gumb.

**Vsebina (scrollable):**

**Card: Information** (read-only)
- Name
- Sensor type (badge)
- Status (`<SensorStatusBadge>`)
- Last activity (relativni čas)
- Credential ID
- Description (če obstaja)
- Metadata (key/value pari, brez ključa `status`)

**Card: Data Streams** (read-only list)
- Vsaka vrstica: ime, opis, unit_of_measurement
- Read-only v 1. fazi

**Card: Ownerships** (read-only list)
- Vsaka vrstica: username, participant name, period badge
- Read-only v 1. fazi — dodeljevanje se upravlja na `/users` strani

**Card: Recent Observations** (mini-tabela)
- Zadnjih 20 observationov: phenomenon_time, stream ime, result, lokacija (city iz `locations.properties`)
- Read-only v 1. fazi

**Barvna shema:**
- Header ikona: primary/10 background
- Card-i: bg-base-300
- Ownership avatarji: primary/10 background

### 5.3. Navigacija (`+layout.svelte`)

Dodati v `navItems` array:
```ts
{ href: '/devices', label: 'Devices', icon: '◐' }
```

Ikona `◐` (half-filled circle) za doslednost z `◈` (Dashboard) in `◉` (Participants).

Dodati tudi v dropdown menu (vrstica pod "Users" v obstoječem meniju):
```svelte
<li><a href="/devices" class="font-mono"><span class="opacity-50">◐</span> Devices</a></li>
```

## 6. API funkcije (TypeScript) — vse implementirane

V `src/lib/api/sensors.ts`:

```ts
/** Fetch all sensors with last_activity. Uses api.list_sensors. */
export const getSensors = async (): Promise<Sensor[]>

/** Fetch data streams for a sensor. Uses api.data_streams (⚠️ potrebuje view). */
export const getSensorStreams = async (sensorId: number): Promise<DataStream[]>

/** Fetch ownerships, joined client-side with list_participants. */
export const getSensorOwnerships = async (sensorId: number): Promise<SensorOwnership[]>

/** Fetch recent observations with embedded data_streams + locations (⚠️ potrebuje view-a). */
export const getRecentObservations = async (
  sensorId: number,
  limit?: number
): Promise<RecentObservation[]>
```

> **⚠️ `getSensorStreams` in `getRecentObservations` ne delujeta** brez `api.data_streams` in `api.locations` view-ov. Glej §10.1.

V `src/lib/api/types.ts` dodati:

```ts
export type NewSensor = {
  name: string;
  sensor_type: string;
  description?: string;
  properties?: Record<string, unknown>;
  credential_id?: number;
};

export type DataStream = {
  id: number;
  sensor_id: number;
  name: string;
  description?: string | null;
  unit_of_measurement?: string | null;
  properties?: Record<string, unknown> | null;
};

export type SensorOwnership = Ownership & {
  username: string | null;
  participant_name: string | null;
};

export type RecentObservation = {
  id: number;
  data_stream_id: number;
  data_stream_name: string;
  phenomenon_time: string;
  result: number;
  location: string | null;
};
```

**`Sensor` tip** ostane nespremenjen — že ima `id`, `name`, `description`, `properties`, `credential_id`, `sys_created_at`, `last_activity`. Status beremo iz `sensor.properties?.status ?? 'unknown'`.

## 7. Komponente — podrobnosti

### 7.1. `SensorStatusBadge.svelte`

Props: `status: string | null | undefined`

Barvna logika:
- `'active'` → `badge-success` (emerald)
- `'inactive'` → `badge-neutral` (siva)
- `'maintenance'` → `badge-warning` (amber)
- ostalo / null / undefined → `badge-ghost` (unknown)

```svelte
<span class="badge badge-soft {variant}">{displayText}</span>
```

### 7.2. `DeviceMetadataEditor.svelte`

Komponenta za urejanje `properties` JSONB.

Props:
- `metadata: Record<string, unknown>` (bindable)
- `disabled?: boolean`

Vmesnik:
- Seznam key/value parov
- Gumb "+ Add field" doda nov par
- Gumb "🗑" ob vsakem paru izbriše
- `status` ključ je onemogočen (ureja se v Information kartici)
- Na blur ali "Save" sproži posodobitev parent stanja

### 7.3. `AddSensorModal.svelte`

HTML `<dialog class="modal">` (paralelno AddStudyModal).

State:
```ts
let newSensor = $state<NewSensor>({
  name: '',
  sensor_type: 'ATMOTUBE_PRO',
  description: '',
  properties: {},
  credential_id: undefined,
});
```

Submit handler:
```ts
const handleAdd = async () => {
  const properties = { ...newSensor.properties, status: newSensor.status };
  await addSensor({ ...newSensor, properties });
  // reload list
};
```

### 7.4. `DeviceDetailsPanel.svelte`

Struktura paralelna `ParticipantDetailsPanel`:

Props:
```ts
interface Props {
  show: boolean;
  selectedSensor: Sensor | null;
  ownerships: SensorOwnership[];
  streams: DataStream[];
  recentObservations: RecentObservation[];
}
```

Events (dispatched):
- `close`
- `updateSensor` (po shranjevanju editov)

State:
- `isEditing` (za Information card)
- `editedProperties` (delovna kopija)
- Vsi ostali state-i so read-only ali delegated

**Pomembno:** `selectedSensor` je deklariran z `$state.raw` (paralelno s `selectedParticipant` v `ParticipantDetailsPanel`). Po update-u je treba narediti fresh reference — bodisi z refetch iz parent bodisi z local merge.

## 8. Vrstni red implementacije

1. **Tipi** (`types.ts`): dodati `NewSensor`, `DataStream`, `SensorOwnership`, `RecentObservation`.
2. **API helperji** (`sensors.ts`): `addSensor`, `updateSensor`, `getSensorStreams`, `getSensorOwnerships`, `getRecentObservations`.
3. **Izvoz** (`index.ts`): dodati nove funkcije in tipe.
4. **Navigacija** (`+layout.svelte`): dodati "Devices" v `navItems` in dropdown.
5. **`SensorStatusBadge.svelte`**.
6. **`DeviceMetadataEditor.svelte`**.
7. **`AddSensorModal.svelte`**.
8. **`/devices/+page.svelte`**: glavna tabela + search/filter/pagination + open sidebar.
9. **`DeviceDetailsPanel.svelte`**: sidebar s 4 card-i (Information, Data Streams, Ownerships, Recent Observations).
10. **Preverjanje**: `npm run check`, `npm run lint`, `npm run build`.

## 9. Tveganja in odprta vprašanja

- **N+1 query problem** v `getSensorOwnerships`: za vsako ownership naredimo join z `auth.users` in `data.participants`. PostgREST to naredi efficient z eno query. Sprejemljivo.
- **Inline editing kompleksnosti**: izogibajmo se "Save" gumbu na vsakem polju — raje "Edit / Save / Cancel" vzorec kot v `ParticipantDetailsPanel`.
- **Status in properties.status**: paziti, da ne shranjujemo `status` dvakrat (v formi in v metadata editor). Rešitev: `status` je vedno v `properties.status`, metadata editor preskoči ta ključ.
- **Prazna `properties` ob novem senzorju**: privzeto nastavimo na `{ status: 'active' }`, da je takoj smiselno.
- **Sortiranje po stolpcih**: v 1. fazi samo client-side sort (enako kot pri users). Za velike nabore (1000+ senzorjev) bi potrebovali server-side sort, ampak to ni v scope-u.
- **Location string**: v `RecentObservation` prikažemo `location.properties?.city` ali kratko koordinato. V 1. fazi samo eno polje, format: "City, Station" ali pa fallback na koordinate.

## 10. Izven scope-a (za sledenje v prihodnjih iteracijah)

- Vizualizacija (sparkline, časovni graf)
- Bulk operacije (CSV uvoz, multi-edit)
- Obvestila in pragovi (alerting)
- Brisanje senzorja (soft/hard delete)
- Uptime tracking (potrebna sistemska telemetrija)
- Upravljanje data_streams (dodajanje, brisanje, urejanje)
- Upravljanje credentials (posebna stran)
- Sort po lokaciji (lokacija je na observation, ne na senzor)

## 10.1. 🔴 Manjkajoča `api.*` view-a (blokira Data Streams in Recent Observations)

Frontend in API helperji za `/devices` so implementirani, vendar Data Streams in Recent Observations kartici v sidebaru ne delujeta, ker `20_init.sql` nima 2 potrebnih `api.*` view-ev. PostgREST bere samo iz `api` sheme (`PGRST_DB_SCHEMAS=api`), zato brez teh objektov frontend dobi 404/400.

**Manjkajoči SQL** (migracija `23_views_and_grants.sql`):

```sql
-- 1. api.data_streams — popravi GET /data_streams (404 → 200)
CREATE OR REPLACE VIEW api.data_streams
WITH (security_invoker=true)
AS SELECT id, sensor_id, name, description, unit_of_measurement, properties
   FROM data.data_streams;
GRANT SELECT ON api.data_streams TO admin;

-- 2. api.locations — popravi embed locations(properties) v observations (400 → 200)
CREATE OR REPLACE VIEW api.locations
WITH (security_invoker=true)
AS SELECT id, properties, geog FROM data.locations;
GRANT SELECT ON api.locations TO admin;
```

> **Opomba**: `api.users` view in `GRANT UPDATE ON api.sensors` **nista potrebna** — `getSensorOwnerships` že dela prek client-side joina na `list_participants`, urejanje senzorjev pa je izven scope-a te faze.

## 11. Kriteriji sprejetja

- [x] Stran `/devices` prikazuje vse senzorje iz baze v tabeli s 4 stolpci
- [x] Iskanje deluje po imenu, description in JSONB vrednostih
- [x] Filter po `sensor_type` in `status` deluje
- [x] Paginacija deluje s 5 velikostmi (10/25/50/100/500)
- [ ] ~~Gumb "Add Device" odpre modal, ki uspešno doda nov senzor~~ (izven scope-a)
- [x] Klik na vrstico odpre desni sidebar z detajli
- [ ] ~~V sidebaru je mogoče urediti ime, tip, opis, status, credential_id, metadata~~ (izven scope-a — sidebar je read-only)
- [x] V sidebaru so prikazani vsi metadata key/value pari (brez `status` ključa)
- [ ] V sidebaru so prikazani vsi data_streams (⚠️ potrebuje `api.data_streams` view)
- [x] V sidebaru so prikazani vsi ownerships (deluje prek client-side joina)
- [ ] V sidebaru je prikazanih zadnjih 20 observationov (⚠️ potrebuje `api.data_streams` + `api.locations` view-a)
- [x] Status badge prikazuje pravilno barvo glede na vrednost
- [x] Navigacija v `+layout.svelte` vsebuje "Devices" povezavo
- [x] `npm run check` in `npm run lint` brez napak
- [x] `npm run build` uspešno zaključi
- [x] Responsive dizajn (tabela, filter, sidebar delujejo na manjših zaslonih)
- [x] Light/dark tema deluje (omnihub in omnihub-dark)
