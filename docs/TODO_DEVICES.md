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

## `/devices` — Manjkajoča `api.*` view-a (blokira Data Streams in Recent Observations)

### Problem

`/devices` stran in `DeviceDetailsPanel` sta implementirana (read-only), vendar Data Streams in Recent Observations kartici v sidebaru ne delujeta, ker `20_init.sql` nima 2 potrebnih `api.*` view-ev. PostgREST bere samo iz `PGRST_DB_SCHEMAS=api`, zato brez teh objektov frontend dobi 404/400.

### Dejansko stanje — samo 2 view-a manjkata

| `api.*` view       | HTTP status | Vzrok                              | Vpliv v UI                                            |
| ------------------ | ----------- | ---------------------------------- | ----------------------------------------------------- |
| `list_sensors`     | 200 ✅      | Deluje                             | Seznam naprav v `/devices`                            |
| `observations`     | 200 ✅      | Deluje                             | Osnovni SELECT dela, embedi pa ne                     |
| `ownerships`       | 200 ✅      | Deluje                             | Lastništva (client-side join prek `list_participants`) |
| `data_streams`     | **404**     | View ne obstaja                    | Data Streams + Recent Observations kartici prazni     |
| `locations`        | **404**     | View ne obstaja                    | Embed `locations(properties)` v observations → 400    |

> **Opomba**: `api.sensors` GRANT (za UPDATE) in `api.users` view nista potrebna — urejanje senzorjev je izven scope-a, `getSensorOwnerships` pa že dela prek client-side joina na `list_participants`.

### Kaj manjka (2 view-a)

#### 1. Manjkajoč view `api.data_streams`

Povzroča: `GET /data_streams` → 404, `data_streams!inner` embed → 400.

```sql
CREATE OR REPLACE VIEW api.data_streams
WITH (security_invoker=true)
AS SELECT id, sensor_id, name, description, unit_of_measurement, properties
   FROM data.data_streams;
GRANT SELECT ON api.data_streams TO admin;
```

#### 2. Manjkajoč view `api.locations`

Povzroča: `locations(properties)` embed v observations → 400.

```sql
CREATE OR REPLACE VIEW api.locations
WITH (security_invoker=true)
AS SELECT id, properties, geog FROM data.locations;
GRANT SELECT ON api.locations TO admin;
```

### Kje to narediti

Nova migracija `src/db/migrations/23_views_and_grants.sql`.

### Kako verificirati po fixu

```bash
# Data streams — pričakovano 200 (prej 404)
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/data_streams?sensor_id=eq.22&select=id,name"

# Observations z embedi — pričakovano 200 (prej 400)
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/observations?select=id,phenomenon_time,data_streams!inner(name),locations(properties)&data_streams.sensor_id=eq.22&limit=3"
```
