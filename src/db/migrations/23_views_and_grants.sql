-- Migration 23: Add missing api.* views for /devices page + grant fixes
--
-- PostgREST reads only from the `api` schema (PGRST_DB_SCHEMAS=api).
-- Two views are missing that the devices page needs:
--   1. api.data_streams — used by getSensorStreams() and embedded in observations
--   2. api.locations   — used by observations embed locations(properties)
--
-- It also fixes two inconsistencies from 20_init.sql:
--   3. api.observations used an INNER JOIN on locations, which silently
--      dropped observations with NULL location_id. Now a LEFT JOIN.
--   4. Role `researcher` had SELECT grants on api.* views but no USAGE
--      on schema api, so the grants could never be exercised via PostgREST.
--
-- webuser gets SELECT on api.locations as well: it is safe because the
-- RLS policy allow_webuser_select_own_locations (20_init.sql) limits
-- rows to locations of the caller's own observations. It is needed for
-- the future "my measurements" dashboard, where webusers embed
-- locations in api.observations the same way the devices page does.
--
-- After this migration, Data Streams and Recent Observations cards
-- in the DeviceDetailsPanel sidebar will work correctly.

-- 1. api.data_streams view
CREATE OR REPLACE VIEW api.data_streams
WITH (security_invoker=true)
AS SELECT id, sensor_id, name, description, unit_of_measurement, properties
   FROM data.data_streams;

ALTER VIEW api.data_streams OWNER TO postgres;
GRANT SELECT ON api.data_streams TO admin;
GRANT SELECT ON api.data_streams TO webuser;
GRANT SELECT ON api.data_streams TO researcher;

-- 2. api.locations view
CREATE OR REPLACE VIEW api.locations
WITH (security_invoker=true)
AS SELECT id, properties, geog FROM data.locations;

ALTER VIEW api.locations OWNER TO postgres;
GRANT SELECT ON api.locations TO admin;
GRANT SELECT ON api.locations TO researcher;
GRANT SELECT ON api.locations TO webuser;

-- 3. api.observations: LEFT JOIN so observations without a location are
--    no longer dropped from the view (was INNER JOIN in 20_init.sql).
--    Column list is unchanged, so CREATE OR REPLACE applies cleanly and
--    the existing grants (webuser, admin, researcher) are preserved.
CREATE OR REPLACE VIEW api.observations
WITH (security_invoker=true)
AS
select ob.*, l.geog from data.observations ob
left join data.locations l on l.id = ob.location_id;

ALTER VIEW api.observations OWNER TO postgres;

-- 4. researcher needs USAGE on schema api — without it the SELECT grants
--    on api.* views (observations, data_streams, locations) are dead
--    grants for requests coming through PostgREST.
GRANT USAGE ON SCHEMA api TO researcher;
