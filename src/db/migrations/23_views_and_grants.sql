-- Migration 23: Add missing api.* views for /devices page
--
-- PostgREST reads only from the `api` schema (PGRST_DB_SCHEMAS=api).
-- Two views are missing that the devices page needs:
--   1. api.data_streams — used by getSensorStreams() and embedded in observations
--   2. api.locations   — used by observations embed locations(properties)
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
