# TODO

> **Vse naloge so zaključene.** Ta dokument služi kot zgodovinska referenca.
>
> ~~Admin password reset~~ — **odstranjen iz plana** (izven scope-a trenutne faze).
>
> Spodaj je dokumentiran potek reševanja `/devices` API view-ov.

## `/devices` — `api.*` view-a za Data Streams in Recent Observations ✅ ODPRAVLJENO

### Problem (zgodovinsko)

`/devices` stran in `DeviceDetailsPanel` sta implementirana (read-only), vendar Data Streams in Recent Observations kartici v sidebaru nista delovali, ker `20_init.sql` ni imel 2 potrebnih `api.*` view-ev. PostgREST bere samo iz `PGRST_DB_SCHEMAS=api`, zato je frontend dobival 404/400.

### Rešitev — migracija `23_views_and_grants.sql` ✅

Migracija doda oba manjkajoča view-a in hkrati popravi še tri neskladja iz `20_init.sql`:

```sql
-- 1. api.data_streams — popravi GET /data_streams (404 → 200)
CREATE OR REPLACE VIEW api.data_streams
WITH (security_invoker=true)
AS SELECT id, sensor_id, name, description, unit_of_measurement, properties
   FROM data.data_streams;
GRANT SELECT ON api.data_streams TO admin;
GRANT SELECT ON api.data_streams TO webuser;
GRANT SELECT ON api.data_streams TO researcher;

-- 2. api.locations — popravi embed locations(properties) v observations (400 → 200)
CREATE OR REPLACE VIEW api.locations
WITH (security_invoker=true)
AS SELECT id, properties, geog FROM data.locations;
GRANT SELECT ON api.locations TO admin;
GRANT SELECT ON api.locations TO researcher;
GRANT SELECT ON api.locations TO webuser;

-- 3. api.observations: INNER JOIN → LEFT JOIN na locations,
--    da meritve z location_id = NULL ne izginejo iz view-a
CREATE OR REPLACE VIEW api.observations
WITH (security_invoker=true)
AS select ob.*, l.geog from data.observations ob
   left join data.locations l on l.id = ob.location_id;

-- 4. researcher dobi USAGE na shemi api — brez tega so bili njegovi
--    SELECT grant-i na api.* view-e (observations, data_streams,
--    locations) za PostgREST nepovožljivi
GRANT USAGE ON SCHEMA api TO researcher;
```

Zakaj več grantov, kot je bilo prvotno načrtovano (samo `admin`):
- `webuser` na obeh view-ih je varen — RLS politiki `allow_webuser_select_own_datastream` in `allow_webuser_select_own_locations` (20_init.sql) omejita vrstice na lastne — in ga potrebuje **bodoči dashboard za pregled lastnih meritev**, kjer webuser embeda `locations` v `observations`.
- `researcher` je SELECT grante na baznih tabelah že imel, a brez `USAGE` na shemi `api` jih prek PostgREST ni mogel izkoristiti.

> **Opomba**: `api.sensors` GRANT (za UPDATE) in `api.users` view nista potrebna — urejanje senzorjev je izven scope-a, `getSensorOwnerships` pa že dela prek client-side joina na `list_participants`.

> **Operativno**: `docker-entrypoint-initdb.d` požene migracije samo ob **praznem** DB volume-u. Obstoječo bazo je treba posodobiti ročno:
> `psql -U postgres -d postgres -f src/db/migrations/23_views_and_grants.sql`

### Stanje po migraciji

| `api.*` view       | HTTP status | Opombe                                                              |
| ------------------ | ----------- | ------------------------------------------------------------------- |
| `list_sensors`     | 200 ✅      | Seznam naprav v `/devices`                                          |
| `observations`     | 200 ✅      | SELECT + embedi delujejo; meritve brez lokacije se ohranijo (LEFT JOIN) |
| `ownerships`       | 200 ✅      | Lastništva (client-side join prek `list_participants`)              |
| `data_streams`     | 200 ✅      | Dodan v migraciji 23 (granti: admin, webuser, researcher)           |
| `locations`        | 200 ✅      | Dodan v migraciji 23 (granti: admin, webuser, researcher)           |

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
