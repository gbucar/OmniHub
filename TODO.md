# TODO

## Admin password reset za udeležence

### Namen
V `ParticipantDetailsPanel` (admin dashboard) v razdelku "Account Details" bo dodan gumb "Reset password", ki razširi inline formo z dvema poljema (novo geslo + potrditev) in omogoči adminu, da ponastavi geslo udeležencu, ki ga je pozabil.

### Backend dilema: kako poklicati spremembo gesla
Admin že ima neposredne pravice na `auth.users`:
- `GRANT SELECT, INSERT, UPDATE ON TABLE auth.users TO admin;` (20_init.sql:1272)
- RLS `allow_admin_update_user_data_cp` (20_init.sql:527)
- Trigger `encrypt_pass` avtomatsko zhashira geslo ob UPDATE

Treba se je odločiti med dvema pristopoma:

**Opcija A — nov RPC `api.admin_reset_user_password` (priporočeno)**
- Nova migracija `22_admin_reset_user_password.sql`.
- Funkcija: `api.admin_reset_user_password(target_user_id uuid, new_password text, new_password_confirmation text) RETURNS void`.
- `SECURITY DEFINER`, preveri admin role iz JWT, preveri ujemanje novih gesel.
- `UPDATE auth.users SET password = new_password WHERE id = target_user_id;` (trigger zhashira).
- Dodati objekt v `src/db/db.dbm`.
- Frontend kliče: `pgClient?.schema('api').rpc('admin_reset_user_password', {...})`.
- Prednosti: poslovna logika v bazi, lažji audit, skladno z obstoječimi RPC-ji.

**Opcija B — neposreden PostgREST UPDATE**
- Brez migracije.
- `pgClient.from('users').update({ password }).eq('id', targetUserId)`.
- Validacijo ujemanja in admin role naredi frontend (RLS poskrbi za pravice).
- Slabosti: logika v frontend, `auth.users` izpostavljen, ni centralnega audita.

### Implementacija (treba narediti)
1. Izbrati opcijo (A ali B).
2. **Frontend** (že dogovorjeno): gumb v Account Details kartici → inline forma z dvema `PasswordInput` poljema → handler v `users/+page.svelte` → toast na uspeh/napako.
3. **API plast**: dodati `resetParticipantPassword(userId, newPassword)` v `src/lib/api/participants.ts` in izvoz v `index.ts`. Če Opcija A → kliče RPC; če Opcija B → kliče PostgREST UPDATE.
4. **Spremembe `ParticipantDetailsPanel.svelte`**: nov state za formo, nov dispatch event `resetPassword`, gumb + inline UI.
5. **Spremembe `users/+page.svelte`**: handler `handleResetPassword`, povezava `on:resetPassword`.
6. Po izbiri opcije: napisati migracijo (Opcija A) ali pustiti komentar (Opcija B).

## 🔴 `/devices` — Manjkajoči `api.*` view-i in GRANT-i (blokira funkcionalnost)

### Problem
`/devices` stran in `DeviceDetailsPanel` sta implementirana, a v praksi ne delujeta, ker `20_init.sql` (ki definira vse `api.*` view-e in GRANT-e) nima vseh potrebnih objektov. PostgREST bere samo iz `PGRST_DB_SCHEMAS=api`, zato brez `api.*` view-ev in GRANT-ov frontend dobi 403/404.

### Dejansko stanje (preverjeno 2026-07-03 s curl + admin JWT)

| `api.*` view       | HTTP status pri `GET /<view>?select=*&limit=1` | Vzrok                              | Vpliv v UI                                            |
| ------------------ | --------------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `list_sensors`     | 200                                          | ✅ deluje                          | Seznam naprav v `/devices` deluje                    |
| `list_participants`| 200                                          | ✅ deluje                          | Seznam udeležencev v `/users` deluje                  |
| `observations`     | 200                                          | ✅ deluje                          | A v `DeviceDetailsPanel` se ne uporabi neposredno     |
| `ownerships`       | 200                                          | ✅ deluje                          | Lastništva se vidijo (po nedavnem fixu s client-side join) |
| `participants`     | 200                                          | ✅ deluje                          | Urejanje udeležencev deluje                           |
| `studies`          | 200                                          | ✅ deluje                          | Študije delujejo                                      |
| `many_participants_studies` | 200                                | ✅ deluje                          | Članstva v študijah delujejo                          |
| `sensors`          | **403**                                      | ❌ manjka GRANT adminu             | `PATCH /sensors` (urejanje) ne deluje                 |
| `data_streams`     | **404**                                      | ❌ view sploh ne obstaja           | Data Streams kartica v sidebaru vedno prazna          |
| `users`            | **404**                                      | ❌ view sploh ne obstaja           | Username v Ownerships kartici manjka                  |

### Dodatne ugotovitve iz testiranja

- **AtmoTube #22 obstaja** v `data.sensors` (`id=22, name='Atmotube 22', sensor_type=ATMOTUBE_PRO`).
- **Podatki so v bazi**: 7 data stream-ov (`voc, pm1, pm25, pm10, t, h, p`) in 7 observations, vstavljeni s psql — a se v UI **ne prikažejo**, ker `api.data_streams` manjka.
- **Frontend query za opazovanja** (`getRecentObservations`) uporablja `data_streams!inner (...)` embed, ki prav tako ne deluje, ker `api.data_streams` manjka. PostgREST vrne `PGRST108: 'data_streams' is not an embedded resource in this request`.
- **Frontend klici prizadetih API-jev** (v `src/lib/api/sensors.ts`):
  - `getSensorStreams(sensorId)` → `from('data_streams')` (vrstice 187–193) — fail, ker `api.data_streams` manjka.
  - `getRecentObservations(sensorId)` → `from('observations').select('..., data_streams!inner(...)')` (vrstice 284–304) — fail, ker `api.data_streams` manjka.
  - `updateSensor(id, changes)` → `from('sensors').update(...)` (vrstica 171) — fail, ker admin nima GRANT na `api.sensors`.

### Vzorec (kako deluje pri drugih entitetah)
Vsak `api.*` view, ki ga frontend piše, ima GRANT na **obeh** nivojih — `data.*` in `api.*`:
- `api.participants` — `data.participants` GRANT + `api.participants` GRANT ✅
- `api.many_participants_studies` — `data.many_participants_studies` GRANT + `api.many_participants_studies` GRANT ✅
- `api.ownerships` — `data.ownerships` GRANT + `api.ownerships` GRANT ✅
- `api.studies` — `data.studies` GRANT + `api.studies` GRANT ✅
- **`api.sensors`** — `data.sensors` GRANT ✅, **`api.sensors` GRANT ❌ manjka** ✗
- **`api.data_streams`** — `data.data_streams` GRANT ✅, **`api.data_streams` view ❌ manjka** ✗
- **`api.users`** — `auth.users` GRANT ✅, **`api.users` view ❌ manjka** ✗

### Kaj manjka (3 stvari)

#### 1. Manjkajoči GRANT na `api.sensors`
Povzroča: `403 Forbidden` pri `PATCH /sensors?id=eq.<id>` (urejanje senzorja v `DeviceDetailsPanel` ne deluje).
```sql
GRANT SELECT, INSERT, UPDATE ON TABLE api.sensors TO admin;
```

#### 2. Manjkajoč view `api.data_streams`
Povzroča: `getSensorStreams(sensorId)` fail (Data Streams card v `DeviceDetailsPanel` vedno prazen) in `getRecentObservations` fail (Recent Observations card vedno prazen — embed ne deluje).
`data_streams` obstaja samo kot tabela, brez view-a v `api` shemi. PostgREST ga zato ne najde.
```sql
CREATE OR REPLACE VIEW api.data_streams
WITH (security_invoker=true)
AS SELECT id, sensor_id, name, description, unit_of_measurement, properties
   FROM data.data_streams;

GRANT SELECT, INSERT, UPDATE ON TABLE api.data_streams TO admin;
```

#### 3. Manjkajoč view `api.users`
Povzroča: `getSensorOwnerships(sensorId)` fail (Ownerships card v `DeviceDetailsPanel` nima username, ker ne najde `users ( username )` embeda). AtmoTube 22 sicer nima ownership-ov, zato ta napaka trenutno ni vidna v UI — a bo, ko bodo ownership-i dodani.
`auth.users` obstaja samo kot tabela, brez view-a v `api` shemi. RLS `allow_admin_select_user_data` velja za `admin` na `auth.users`, vendar PostgREST tega ne doseže, ker ne ve za `auth` shemo.
```sql
CREATE OR REPLACE VIEW api.users
WITH (security_invoker=true)
AS SELECT id, username, role FROM auth.users;

GRANT SELECT ON TABLE api.users TO admin;
```

### Kje to narediti
Nova migracija `src/db/migrations/22_views_and_grants.sql` (ali poljubno ime). Vse tri stvari so idempotentne (`CREATE OR REPLACE VIEW` + `GRANT`).

### Zakaj `WITH (security_invoker=true)`
Da se RLS politike na osnovnih tabelah (`data.data_streams`, `auth.users`) pravilno uveljavijo za vlogo klicatelja (admin), ne za lastnika view-a (postgres). Enako kot pri vseh drugih `api.*` view-ih v `20_init.sql`.

### Kako verificirati po fixu
Po dodajanju migracije in `docker-compose restart` poženi naslednje ukaze (z admin JWT):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/data_streams?sensor_id=eq.22&select=id,name"
# Pričakovano: 200 (prej 404)

curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/users?select=id,username&limit=1"
# Pričakovano: 200 (prej 404)

curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"description":"test"}' "http://localhost:3000/sensors?id=eq.22"
# Pričakovano: 200 ali 204 (prej 403)
```
Če se vse tri vrnitve ujemajo s pričakovanimi, je fix pravilen.
