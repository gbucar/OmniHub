# Načrt: Bulk Upload/Download za `/users`

> Status: v3 (potrjen s strani uporabnika) — pripravljen za implementacijo

## Pregled

Implementacija bulk upload/download funkcionalnosti na obstoječi strani `/users`. Dodan bo nov "Bulk Actions" dropdown gumb, ki ponuja dve operaciji:

1. **Bulk download** — specifičen na **eno izbrano študijo**; admin izbere študijo, nato multi-select uporabnikov v tej študiji, nato se generira flat CSV.
2. **Bulk upload** — 3-stopenjski wizard (Load → Map → Preview/Confirm) za ustvarjanje novih uporabnikov iz CSV-ja.

Glavna tabela `/users` ostane nespremenjena (prikazuje vse participant z obstoječim filter obnašanjem).

## Pojasnilo o `data_streams`

`data_streams` so specifične meritve, ki jih naprava (sensor) proizvaja (npr. ena Atmotube meri temperaturo + vlago + CO2 — to so 3 data streams na 1 senzor). Za bulk operacijo na userjih niso relevantne, ker so vezane na napravo, ne na userja. **Izpuščene iz CSV formata.**

---

## Arhitektura

### Nove datoteke

```
src/admin-dashboard/src/lib/
├── components/
│   ├── modals/
│   │   ├── BulkDownloadModal.svelte      # Izberi študijo → multi-select userjev → CSV
│   │   └── BulkUploadModal.svelte        # 3-stopenjski wizard: Load → Map → Preview/Confirm
│   └── BulkActionsBar.svelte             # Vrstica nad tabelo, ko so userji izbrani
└── utils/
    ├── csv.ts                            # Parse/serialize/download CSV (RFC 4180)
    └── bulk.ts                           # Mapping helpers, validacija, batch executor
```

### Spremenjene datoteke

```
src/admin-dashboard/src/lib/api/participants.ts
  → addParticipant() naj vrne user_id (dodamo 'returning id' ali client-side lookup)

src/admin-dashboard/src/routes/users/+page.svelte
  → Selection state (Set<string>), checkbox stolpec, shift+click logika,
    "Bulk Actions" dropdown gumb, vezava na BulkDownloadModal in BulkUploadModal
```

### Ocenjene vrstice

| Datoteka | Akcija | ~ vrstic |
|----------|--------|----------|
| `src/lib/utils/csv.ts` | nova | 50 |
| `src/lib/utils/bulk.ts` | nova | 130 |
| `src/lib/api/participants.ts` | sprememba (vrne user_id) | +5 |
| `src/lib/components/BulkActionsBar.svelte` | nova | 60 |
| `src/lib/components/modals/BulkDownloadModal.svelte` | nova | 190 |
| `src/lib/components/modals/BulkUploadModal.svelte` | nova | 380 |
| `src/routes/users/+page.svelte` | checkboxi, dropdown, selection | +60 |

**Skupaj:** 5 novih datotek, 2 spremenjeni, ~875 vrstic.

---

## CSV format za download

**Flat CSV brez JSON stolpcev.** Število `device_N_*` stolpcev = **maximum število naprav, ki jih ima katerikoli user v izvoženi skupini** (dinamično).

### Primer (če ima max naprav med userji = 3)

```csv
user_id,username,role,type,name,age,sex,sys_created_at,study_name,study_start_date,study_end_date,device_1_name,device_1_start_date,device_1_end_date,device_2_name,device_2_start_date,device_2_end_date,device_3_name,device_3_start_date,device_3_end_date
"abc","janez","webuser","participant","Janez",35,"male","2024-01-15","Study A","2024-01-01","2024-12-31","Atmotube 1","2024-01-01","2024-12-31","Sensor 2","2024-03-01","2024-06-30","","",""
"def","miha","webuser","participant","Miha",28,"male","2024-02-01","Study A","2024-01-01","2024-12-31","Atmotube 1","2024-02-01","2024-12-31","","","","","",""
```

### Pravila

- Vse vrednosti CSV-quoted po RFC 4180 (varno za vejice v imenih)
- Prazni stolpci za manjkajoče podatke
- Encoding: UTF-8, line ending: CRLF (`\r\n`)
- Delimiter: vejica (`,`)
- Filename: `participants-study-{study.name}-{YYYY-MM-DD}.csv`
- Vrstni red stolpcev je fiksen; novo dodani po potrebi na koncu

### Vrstni red stolpcev (fiksen)

1. `user_id`
2. `username`
3. `role`
4. `type`
5. `name`
6. `age`
7. `sex`
8. `sys_created_at`
9. `study_name`
10. `study_start_date`
11. `study_end_date`
12. `device_1_name`
13. `device_1_start_date`
14. `device_1_end_date`
15. `device_2_name`
16. `device_2_start_date`
17. `device_2_end_date`
18. `device_3_name`
19. `device_3_start_date`
20. `device_3_end_date`
21. `device_4_name`
22. `device_4_start_date`
23. `device_4_end_date`
24. `device_5_name`
25. `device_5_start_date`
26. `device_5_end_date`

---

## CSV format za upload

Isti stolpci kot download. **Minimalni requirement:** `username` (vse ostalo je opcionalno).

### Auto-detect mapping (Korak 2)

```ts
const aliases: Record<string, string[]> = {
  username: ['username', 'user', 'uporabnik', 'login', 'email'],
  password: ['password', 'pass', 'geslo', 'pwd'],
  name: ['name', 'ime', 'full_name', 'fullname', 'full name'],
  age: ['age', 'starost', 'years'],
  sex: ['sex', 'spol', 'gender'],
  type: ['type', 'tip', 'role', 'category'],
  sys_created_at: ['sys_created_at', 'created', 'created_at'],
  study_name: ['study', 'study_name', 'raziskava', 'study name'],
  study_start_date: ['study_start', 'study_start_date', 'start', 'start_date'],
  study_end_date: ['study_end', 'study_end_date', 'end', 'end_date'],
  device_1_name: ['device_1', 'device_1_name', 'sensor_1', 'naprava_1', 'device1'],
  device_1_start_date: ['device_1_start', 'device_1_start_date'],
  device_1_end_date: ['device_1_end', 'device_1_end_date'],
  // device_2 do device_5: enaki aliasi z ustreznim indexom
};
```

---

## UI komponente (daisyUI 5)

### 1. Bulk Actions dropdown gumb

V obstoječi header vrstici (`+page.svelte` vrstice 457-482) med "Add Study" in "Add Participant":

```svelte
<div class="dropdown dropdown-end">
  <div tabindex="0" role="button" class="btn btn-ghost font-mono">
    <svg ...>⬆</svg>
    Bulk Actions
    <svg ...>▼</svg>
  </div>
  <ul tabindex="-1" class="dropdown-content menu bg-base-100 rounded-box border border-neutral/20 p-2 shadow-lg w-52">
    <li><button onclick={() => showBulkDownload = true}>
      <svg>📥</svg> Bulk Download
    </button></li>
    <li><button onclick={() => showBulkUpload = true}>
      <svg>📤</svg> Bulk Upload
    </button></li>
  </ul>
</div>
```

### 2. Checkbox stolpec v tabeli (s shift+click)

Nova prva `<th>`:

```svelte
<th class="w-10">
  <input type="checkbox" class="checkbox checkbox-sm"
         checked={isAllVisibleSelected}
         onchange={toggleSelectAllVisible} />
</th>
```

Nova prva `<td>` v vsaki vrstici (z `stopPropagation`, da se ne odpre details panel):

```svelte
<td onclick={(e) => e.stopPropagation()}>
  <input type="checkbox" class="checkbox checkbox-sm"
         checked={selectedIds.has(participant.user_id)}
         onchange={(e) => handleRowCheckboxClick(e, index)}
         onclick={(e) => e.stopPropagation()} />
</td>
```

### 3. Selection logika (shift+click)

```ts
let selectedIds = $state(new Set<string>());
let lastClickedIndex = $state<number | null>(null);

function handleRowCheckboxClick(event: MouseEvent, index: number) {
  const userId = participants[index].user_id;
  const newSet = new Set(selectedIds); // clone za reactivity (Set ni reactive sam)

  if (event.shiftKey && lastClickedIndex !== null) {
    const [start, end] = [
      Math.min(lastClickedIndex, index),
      Math.max(lastClickedIndex, index)
    ];
    for (let i = start; i <= end; i++) {
      newSet.add(participants[i].user_id);
    }
  } else if (newSet.has(userId)) {
    newSet.delete(userId);
  } else {
    newSet.add(userId);
  }

  selectedIds = newSet;
  lastClickedIndex = index;
}
```

### 4. BulkActionsBar (vidna samo ko `selectedIds.size > 0`)

Pojavi se med search filter kartico in tabelo:

```svelte
{#if selectedIds.size > 0}
  <div class="alert alert-info bg-primary/10 border border-primary/20">
    <span class="font-mono text-sm">{selectedIds.size} selected</span>
    <div class="flex gap-2 ml-auto">
      <button class="btn btn-sm btn-primary" onclick={openBulkDownloadForSelected}>
        📥 Download Selected
      </button>
      <button class="btn btn-sm btn-ghost" onclick={clearSelection}>✕ Clear</button>
    </div>
  </div>
{/if}
```

### 5. BulkDownloadModal

`<dialog class="modal"><div class="modal-box bg-base-200 max-w-3xl">`:

**Sekcija A: Study selector**

- daisyUI `select` z `getStudies()`
- Na `onchange`: kliče `getParticipants({study: id, limit: 1000})` (vse v študiji, brez pagination)
- Brez študije: download gumb onemogočen

**Sekcija B: Participant multi-select**

- max-height 400px, `overflow-y-auto`
- "Select all (N)" gumb na vrhu
- Vsaka vrstica: checkbox + avatar inicialka + username + name + type

**Sekcija C: Download gumb**

- "Download CSV (N participants)" — onemogočen če `selectedForDownload.size === 0`
- Helper text: "Export includes user_id, username, role, type, properties, studies, devices"

**Generiranje CSV (dinamični device stolpci):**

```ts
const maxDevices = Math.max(0, ...selectedParticipants.map(p => devicesByUser[p.user_id]?.length ?? 0));
const deviceHeaders = Array.from({ length: maxDevices }, (_, i) => {
  const n = i + 1;
  return [`device_${n}_name`, `device_${n}_start_date`, `device_${n}_end_date`];
}).flat();

const baseHeaders = [
  'user_id', 'username', 'role', 'type', 'name', 'age', 'sex', 'sys_created_at',
  'study_name', 'study_start_date', 'study_end_date'
];
const allHeaders = [...baseHeaders, ...deviceHeaders];

const rows = selectedParticipants.map(p => {
  const devices = devicesByUser[p.user_id] ?? [];
  const deviceValues = Array.from({ length: maxDevices }, (_, i) => {
    const d = devices[i];
    return d ? [d.name, d.start, d.end] : ['', '', ''];
  }).flat();

  return [
    p.user_id, p.username, p.role, p.type,
    p.properties?.name ?? '', p.properties?.age ?? '', p.properties?.sex ?? '',
    p.sys_created_at ?? '',
    p.studies[0]?.name ?? '',
    /* study_start_date, study_end_date */ '',
    '',
    ...deviceValues
  ];
});

const csv = serializeCSV(allHeaders, rows);
downloadCSV(`participants-study-${selectedStudy.name}-${new Date().toISOString().split('T')[0]}.csv`, csv);
```

### 6. BulkUploadModal — 3-stopenjski wizard

**Korak 1: Load**

- dva podnačina (tabs):
  - File input: `<input type="file" accept=".csv" class="file-input file-input-bordered">`
  - Paste textarea: `<textarea class="textarea textarea-bordered" rows="8">`
- Oba kličeta `parseCSV()` in prikažeta prvih 5 vrstic v `<table class="table table-sm">` kot preview
- "Next" gumb → shrani parsed CSV v state, preide na Korak 2

**Korak 2: Map columns**

- Za vsako sistemsko polje: `<select class="select select-bordered select-sm">` z opcijami iz CSV headerjev + "(skip)"
- Polja: `username*`, `password*`, `name`, `age`, `sex`, `type`, `sys_created_at`, `study_name`, `study_start_date`, `study_end_date`, `device_1_name`, `device_1_start_date`, `device_1_end_date`, `device_2_*`, ..., do 5 naprav
- "Auto-detect" gumb (kliče `autoDetectMapping(headers)`)
- "Next" gumb — onemogočen če `username` ni mapiran

**Korak 3: Preview & Confirm**

**Header:**

- **Study selector** (daisyUI `select` z `getStudies()`) — uporabi se za vrstice brez `study_name` v CSV
- **Default password input** (`<input type="text">`, vidno — admin vidi kaj je vnesel) — za vrstice brez `password` v CSV

**Tri ločene `<table class="table table-sm">` sekcije z badge-i:**

1. **✅ Valid (5)** — vrstice, ki bodo uvožene
2. **⚠️ Problematic (1)** — vrstice, ki **ne bodo uvožene** (npr. manjkajoča naprava)
3. **❌ Rejected (2)** — vrstice, ki **ne bodo uvožene** (npr. manjkajoč username, neveljaven datum)

Vsaka rejected/problematic vrstica ima **X gumb** za odstranitev iz seznama (če se admin odloči, da je ne želi uvoziti).

**Footer:**

- Statistika: "5 valid, 1 problematic, 2 rejected"
- "Cancel" in "Confirm & Import (5 users)" gumba — slednji uvozi samo valid vrstice

**Wizard navigacija:**

- daisyUI `steps` komponenta na vrhu (3 koraki z aktivnim stanjem)
- "Back" gumb za vrnitev na prejšnji korak

---

## Validacijska pravila (Korak 3)

| Pravilo | Status v Koraku 3 | Ali se uvozi? |
|---------|------------------|---------------|
| Prazna CSV | Toast ob load: "CSV is empty" | — |
| Manjka header vrstica | Toast: "CSV must have a header row" | — |
| Username stolpec ni mapiran | Onemogočen "Next" gumb v Koraku 2 | — |
| Password stolpec ni mapiran | Uporabi `defaultPassword` (vnese admin v Koraku 3) | da |
| Vrstica z manjkajočim username | ❌ Rejected | ne |
| Neveljaven datum (start/end) | ❌ Rejected | ne |
| `end < start` (study ali device) | ❌ Rejected | ne |
| **Naprava v CSV ne obstaja v bazi** | ⚠️ **Problematic** | **ne** |
| Manjkajoč `study_name` + Korak 3 brez selected study | ⚠️ Problematic | ne |
| `study_name` v CSV ne obstaja v bazi | ⚠️ Problematic | ne |
| Manjkajoč `password` v vrstici | ✅ Valid (uporabi default) | da |
| Vse ostalo OK | ✅ Valid | da |

**Vse vrstice (valid + problematic + rejected) se prikažejo v Koraku 3** — admin lahko vidi in razume zakaj katera vrstica ne bo uvožena.

---

## Validacijska logika (kodiranje)

```ts
type ValidationStatus = 'valid' | 'rejected' | 'problematic';

type ValidationResult = {
  status: ValidationStatus;
  row: ParsedRow;
  reason?: string;
  actions?: string[]; // za valid vrstice
};

function validateRow(
  row: ParsedRow,
  sensors: Sensor[],
  studies: Study[],
  selectedStudy: Study | null
): ValidationResult {
  // 1. Required: username
  if (!row.username || row.username.trim() === '') {
    return { status: 'rejected', row, reason: 'Missing username' };
  }

  // 2. Validate study dates
  if (row.study_start_date && !isValidDate(row.study_start_date)) {
    return { status: 'rejected', row, reason: `Invalid study_start_date: ${row.study_start_date}` };
  }
  if (row.study_end_date && !isValidDate(row.study_end_date)) {
    return { status: 'rejected', row, reason: `Invalid study_end_date: ${row.study_end_date}` };
  }
  if (row.study_start_date && row.study_end_date && row.study_end_date < row.study_start_date) {
    return { status: 'rejected', row, reason: 'study_end_date is before study_start_date' };
  }

  // 3. Validate devices
  for (const device of row.devices) {
    if (!isValidDate(device.start)) {
      return { status: 'rejected', row, reason: `Invalid start_date for device '${device.name}'` };
    }
    if (!isValidDate(device.end)) {
      return { status: 'rejected', row, reason: `Invalid end_date for device '${device.name}'` };
    }
    if (device.end < device.start) {
      return { status: 'rejected', row, reason: `Device '${device.name}': end before start` };
    }
    if (device.name && !sensors.find(s => s.name === device.name)) {
      return {
        status: 'problematic',
        row,
        reason: `Device '${device.name}' not found in database`
      };
    }
  }

  // 4. Study name resolution
  if (row.study_name && !studies.find(s => s.name === row.study_name)) {
    return {
      status: 'problematic',
      row,
      reason: `Study '${row.study_name}' not found in database`
    };
  }
  if (!row.study_name && !selectedStudy) {
    return {
      status: 'problematic',
      row,
      reason: 'No study_name in CSV and no default study selected in step 3'
    };
  }

  return {
    status: 'valid',
    row,
    actions: buildActionsList(row, sensors, studies, selectedStudy)
  };
}

function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function buildActionsList(
  row: ParsedRow,
  sensors: Sensor[],
  studies: Study[],
  selectedStudy: Study | null
): string[] {
  const actions: string[] = [];

  const study = row.study_name
    ? studies.find(s => s.name === row.study_name)
    : selectedStudy;
  if (study) actions.push(`+ ${study.name}`);

  for (const device of row.devices) {
    const sensor = sensors.find(s => s.name === device.name);
    if (sensor) actions.push(`+ ${sensor.name}`);
  }

  return actions;
}
```

---

## Upload execution (Korak 3 submit)

```ts
async function executeBulkUpload(
  validRows: ParsedRow[],
  defaultPassword: string,
  selectedStudy: Study | null,
  sensors: Sensor[],
  studies: Study[]
): Promise<{ created: number; skipped: number; errors: number }> {
  let created = 0, skipped = 0, errors = 0;

  for (const row of validRows) {
    try {
      // 1. Resolve study
      const study = row.study_name
        ? studies.find(s => s.name === row.study_name)
        : selectedStudy;
      if (!study) { skipped++; continue; }

      // 2. Create user (existing API, spremenjen da vrne user_id)
      const userId = await addParticipant({
        username: row.username,
        password: row.password || defaultPassword,
        properties: {
          name: row.name ?? null,
          age: row.age ? parseInt(row.age) : null,
          sex: row.sex ?? null,
          type: row.type ?? null
        }
      });

      // 3. Add to study with period
      const period = row.study_start_date && row.study_end_date
        ? `[${row.study_start_date} 00:00:00, ${row.study_end_date} 23:59:59.99999999)`
        : null;
      await addParticipantToStudy(userId, study.id, period);

      // 4. Add device ownerships
      for (const device of row.devices) {
        const sensor = sensors.find(s => s.name === device.name);
        if (!sensor) continue; // safety; validation že rejectala take vrstice
        if (device.start && device.end) {
          await addOwnership({
            user_id: userId,
            sensor_id: sensor.id,
            start_date: device.start,
            end_date: device.end
          });
        }
      }

      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('unique') || msg.includes('duplicate')) {
        skipped++;
      } else {
        errors++;
      }
    }
  }

  return { created, skipped, errors };
}
```

**Toast ob zaključku:** `"Import complete: X created, Y skipped, Z errors"` (success če `errors === 0`, error sicer).

---

## Sprememba `addParticipant` API

Trenutno `api.add_participant` vrača `void`. Za bulk upload potrebujemo `user_id` nazaj.

**Sprememba v `src/lib/api/participants.ts`:**

```ts
export const addParticipant = async (participant: {
  username: string;
  password: string;
  properties: Record<string, unknown>;
}): Promise<string> => {
  const data = await pgClient?.schema('api').rpc('add_participant', {
    username: participant.username,
    password: participant.password,
    properties: participant.properties
  });
  if (data?.error) {
    throw new Error(data.error.message);
  }
  return data?.data as string; // RPC mora vračati user_id
};
```

**Potrebna sprememba v `src/db/migrations/20_init.sql`** ali v novi migraciji (npr. `22_bulk_upload.sql`):

```sql
CREATE OR REPLACE FUNCTION api.add_participant (
  IN username text,
  IN password text,
  IN properties jsonb
)
RETURNS uuid  -- sprememba: void → uuid
LANGUAGE plpgsql
VOLATILE
CALLED ON NULL INPUT
SECURITY INVOKER
PARALLEL UNSAFE
COST 1
AS $function$
declare
  _user_id uuid;
begin
  insert into auth.users (username, password, role)
  values (add_participant.username, add_participant.password, 'webuser')
  returning auth.users.id into _user_id;

  insert into data.participants (user_id, properties)
  values (_user_id, add_participant.properties);

  return _user_id;  -- sprememba: dodan return
end;
$function$;
```

**Alternativa:** Če nočemo spreminjati RPC, lahko po insertu naredimo `pgClient?.from('participants').select('user_id').eq('user_id', ...)` lookup. Ampak RPC sprememba je čistejša.

---

## CSV utility (`src/lib/utils/csv.ts`)

~50 vrstic, brez zunanjih knjižnic:

```ts
// RFC 4180 parser
export function parseCSV(text: string, delimiter = ','): {
  headers: string[];
  rows: string[][];
} {
  // Handle quoted fields with embedded delimiters/newlines, escaped quotes
  // Returns { headers: ['col1', 'col2'], rows: [['v1', 'v2'], ...] }
}

// RFC 4180 serializer
export function serializeCSV(headers: string[], rows: string[][]): string {
  // Quote fields containing delimiter/newline/quote, escape quotes by doubling
  // Returns string with \r\n line endings (Excel-compatible)
}

// Browser download trigger
export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## Bulk utility (`src/lib/utils/bulk.ts`)

~130 vrstic:

- `autoDetectMapping(headers: string[]): Record<string, string>` — vrne mapping iz header aliasov
- `parseDevicesFromRow(row: Record<string, string>, mapping: Record<string, string>): Device[]` — razdeli device_N_* stolpce v array
- `validateRow(row, sensors, studies, selectedStudy): ValidationResult` — glej zgoraj
- `validateAllRows(rows, sensors, studies, selectedStudy): { valid, problematic, rejected }` — bulk validacija
- `buildActionsList(row, sensors, studies, selectedStudy): string[]` — za prikaz akcij
- Type definitions: `ParsedRow`, `Device`, `ValidationResult`, `ValidationStatus`

---

## Datoteka za shranjevanje (informativno)

> Ta datoteka bo shranjena v `BULK_UPLOAD.md` v korenu projekta.

---

## Povzetek potrjenih odločitev

| Odločitev | Vrednost |
|-----------|----------|
| Download format | Flat CSV brez JSON; dinamično število device stolpcev glede na max |
| Download scope | Specifično na **eno izbrano študijo** |
| Upload scope | Vezan na študijo (Korak 3) — fallback če manjka v CSV |
| Upload wizard | 3-stopenjski: **Load → Map → Preview/Confirm** |
| Tabela /users | Nespremenjena (checkbox stolpec dodan, ostalo enako) |
| Manjkajoča naprava | ⚠️ **Problematic vrstica v Koraku 3, NE bo uvožena** |
| Manjkajoč password | **Uporabi isto geslo za vse** (admin ga vnese v Koraku 3) |
| Validacija v Koraku 3 | Vse vrstice prikazane (valid/problematic/rejected) z barvnimi badge-i |
| Admin lahko odstrani vrstico | Da, X gumb na vsaki problematic/rejected vrstici |
| Encoding | UTF-8, CRLF line endings, comma delimiter |
| Quote style | RFC 4180 (vse vrednosti quoted za varnost) |
| Max device stolpcev | 5 (dinamično glede na max med userji) |

---

## Naslednji koraki

1. Ustvari `BULK_UPLOAD.md` s tem načrtom (shranjeno v korenu projekta)
2. Implementacija po vrstnem redu:
   1. `src/lib/utils/csv.ts`
   2. `src/lib/utils/bulk.ts`
   3. `src/lib/api/participants.ts` (vrne user_id)
   4. Migracija `src/db/migrations/22_add_participant_returns_user_id.sql` (opcijsko)
   5. `src/lib/components/BulkActionsBar.svelte`
   6. `src/lib/components/modals/BulkDownloadModal.svelte`
   7. `src/lib/components/modals/BulkUploadModal.svelte`
   8. `src/routes/users/+page.svelte` (checkboxi, dropdown, selection state)
   9. `npm run check` za typecheck
   10. Ročni test v development okolju
