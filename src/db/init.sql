-- ** Database generated with pgModeler (PostgreSQL Database Modeler).
-- ** pgModeler version: 1.2.2
-- ** PostgreSQL version: 18.0
-- ** Project Site: pgmodeler.io
-- ** Model Author: ---
-- object: postgrest | type: ROLE --
-- DROP ROLE IF EXISTS postgrest;
CREATE ROLE postgrest WITH 
	LOGIN
	 PASSWORD 'postgrest123';
-- ddl-end --

-- object: researcher | type: ROLE --
-- DROP ROLE IF EXISTS researcher;
CREATE ROLE researcher WITH 
	LOGIN;
-- ddl-end --

-- object: webuser | type: ROLE --
-- DROP ROLE IF EXISTS webuser;
CREATE ROLE webuser WITH 
	ROLE postgrest;
-- ddl-end --

-- object: anon | type: ROLE --
-- DROP ROLE IF EXISTS anon;
CREATE ROLE anon WITH 
	ROLE postgrest;
-- ddl-end --


-- ** Database creation must be performed outside a multi lined SQL file. 
-- ** These commands were put in this file only as a convenience.

-- object: postgres | type: DATABASE --
-- DROP DATABASE IF EXISTS postgres;
-- CREATE DATABASE postgres;
-- ddl-end --


-- object: auth | type: SCHEMA --
-- DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA auth;
-- ddl-end --
ALTER SCHEMA auth OWNER TO postgres;
-- ddl-end --

-- object: api | type: SCHEMA --
-- DROP SCHEMA IF EXISTS api CASCADE;
CREATE SCHEMA api;
-- ddl-end --
ALTER SCHEMA api OWNER TO postgres;
-- ddl-end --

-- object: data | type: SCHEMA --
-- DROP SCHEMA IF EXISTS data CASCADE;
CREATE SCHEMA data;
-- ddl-end --
ALTER SCHEMA data OWNER TO postgres;
-- ddl-end --

SET search_path TO pg_catalog,public,auth,api,data;
-- ddl-end --

-- object: postgis | type: EXTENSION --
-- DROP EXTENSION IF EXISTS postgis CASCADE;
CREATE EXTENSION postgis
WITH SCHEMA public;
-- ddl-end --

-- object: auth.users | type: TABLE --
-- DROP TABLE IF EXISTS auth.users CASCADE;
CREATE TABLE auth.users (
	id uuid NOT NULL DEFAULT uuidv7(),
	password text NOT NULL,
	sys_created_at timestamptz NOT NULL DEFAULT NOW(),
	CONSTRAINT users_pk PRIMARY KEY (id)
);
-- ddl-end --
ALTER TABLE auth.users OWNER TO postgres;
-- ddl-end --
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
-- ddl-end --

-- object: data.sensors | type: TABLE --
-- DROP TABLE IF EXISTS data.sensors CASCADE;
CREATE TABLE data.sensors (
	id bigserial NOT NULL,
	name text,
	description text,
	"encodingType" text,
	metadata text,
	properties jsonb,
	CONSTRAINT sensors_pk PRIMARY KEY (id)
);
-- ddl-end --
ALTER TABLE data.sensors OWNER TO postgres;
-- ddl-end --

-- object: data.data_stream | type: TABLE --
-- DROP TABLE IF EXISTS data.data_stream CASCADE;
CREATE TABLE data.data_stream (
	id bigserial NOT NULL,
	sensor_id bigint,
	name text,
	description text,
	unit_of_measurement jsonb,
	observed_area geography,
	phenomenon_time tstzrange,
	properties jsonb,
	result_time tstzrange,
	CONSTRAINT data_stream_pk PRIMARY KEY (id)
);
-- ddl-end --
ALTER TABLE data.data_stream OWNER TO postgres;
-- ddl-end --

-- object: data.ownerships | type: TABLE --
-- DROP TABLE IF EXISTS data.ownerships CASCADE;
CREATE TABLE data.ownerships (
	user_id uuid NOT NULL,
	sensor_id bigint NOT NULL,
	start_date timestamptz NOT NULL,
	end_date timestamptz NOT NULL,
	CONSTRAINT ownerships_pk PRIMARY KEY (user_id,sensor_id,start_date,end_date)
);
-- ddl-end --
ALTER TABLE data.ownerships OWNER TO postgres;
-- ddl-end --

-- object: data.features_of_interest | type: TABLE --
-- DROP TABLE IF EXISTS data.features_of_interest CASCADE;
CREATE TABLE data.features_of_interest (
	id bigserial NOT NULL,
	name text,
	description text,
	encoding_type text,
	feature geography,
	properties jsonb,
	CONSTRAINT feature_of_interest_pk PRIMARY KEY (id)
);
-- ddl-end --
ALTER TABLE data.features_of_interest OWNER TO postgres;
-- ddl-end --

-- object: data.participants | type: TABLE --
-- DROP TABLE IF EXISTS data.participants CASCADE;
CREATE TABLE data.participants (
	user_id uuid NOT NULL,
	CONSTRAINT participant_pk PRIMARY KEY (user_id)
);
-- ddl-end --
ALTER TABLE data.participants OWNER TO postgres;
-- ddl-end --

-- object: data.observations | type: TABLE --
-- DROP TABLE IF EXISTS data.observations CASCADE;
CREATE TABLE data.observations (
	id bigserial NOT NULL,
	data_stream_id bigint NOT NULL,
	phenomenon_time tstzrange,
	result_time timestamptz,
	valid_time tstzrange,
	result numeric NOT NULL,
	properties jsonb,
	features_of_interest_id bigint,
	CONSTRAINT observation_pk PRIMARY KEY (id)
);
-- ddl-end --
COMMENT ON COLUMN data.observations.phenomenon_time IS E'The actual time or period when the measurement occurred in the real world (e.g., when the user''s heart actually beat)';
-- ddl-end --
COMMENT ON COLUMN data.observations.result_time IS E'The specific moment when the measurement result was generated or made available by the device.';
-- ddl-end --
COMMENT ON COLUMN data.observations.valid_time IS E'The time period during which the observation result is considered accurate or applicable for use.';
-- ddl-end --
ALTER TABLE data.observations OWNER TO postgres;
-- ddl-end --

-- object: api.users | type: VIEW --
-- DROP VIEW IF EXISTS api.users CASCADE;
CREATE OR REPLACE VIEW api.users
WITH (check_option=cascaded, security_invoker=true)
AS 
select * from data.participants;
-- ddl-end --
ALTER VIEW api.users OWNER TO postgres;
-- ddl-end --

-- object: allow_users_to_update_their_details | type: POLICY --
-- DROP POLICY IF EXISTS allow_users_to_update_their_details ON auth.users CASCADE;
CREATE POLICY allow_users_to_update_their_details ON auth.users
	AS PERMISSIVE
	FOR ALL
	TO webuser
	USING ((current_setting('request.jwt.claims', true)::json->>'id')::uuid = "id")
	WITH CHECK ((current_setting('request.jwt.claims', true)::json->>'id')::uuid = "id");
-- ddl-end --

-- object: api.participant_observations | type: VIEW --
-- DROP VIEW IF EXISTS api.participant_observations CASCADE;
CREATE OR REPLACE VIEW api.participant_observations
AS 
select 
	* 
from 
	data.participants p
left join data.ownerships o on p.user_id = o.user_id
left join data.sensors s on s.id = o.sensor_id
left join data.data_stream d on d.sensor_id = s.id
left join data.observations ob on ob.data_stream_id = d.id
left join data.features_of_interest f on f.id = ob.features_of_interest_id;
-- ddl-end --
ALTER VIEW api.participant_observations OWNER TO postgres;
-- ddl-end --

-- object: data_stream_sensor_fk | type: CONSTRAINT --
-- ALTER TABLE data.data_stream DROP CONSTRAINT IF EXISTS data_stream_sensor_fk CASCADE;
ALTER TABLE data.data_stream ADD CONSTRAINT data_stream_sensor_fk FOREIGN KEY (sensor_id)
REFERENCES data.sensors (id) MATCH SIMPLE
ON DELETE RESTRICT ON UPDATE CASCADE;
-- ddl-end --

-- object: ownerships_users_fk | type: CONSTRAINT --
-- ALTER TABLE data.ownerships DROP CONSTRAINT IF EXISTS ownerships_users_fk CASCADE;
ALTER TABLE data.ownerships ADD CONSTRAINT ownerships_users_fk FOREIGN KEY (user_id)
REFERENCES data.participants (user_id) MATCH SIMPLE
ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ddl-end --

-- object: ownerships_sensors_fk | type: CONSTRAINT --
-- ALTER TABLE data.ownerships DROP CONSTRAINT IF EXISTS ownerships_sensors_fk CASCADE;
ALTER TABLE data.ownerships ADD CONSTRAINT ownerships_sensors_fk FOREIGN KEY (sensor_id)
REFERENCES data.sensors (id) MATCH SIMPLE
ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ddl-end --

-- object: observations_datastreams_fk | type: CONSTRAINT --
-- ALTER TABLE data.observations DROP CONSTRAINT IF EXISTS observations_datastreams_fk CASCADE;
ALTER TABLE data.observations ADD CONSTRAINT observations_datastreams_fk FOREIGN KEY (data_stream_id)
REFERENCES data.data_stream (id) MATCH SIMPLE
ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ddl-end --

-- object: observations_features_of_interest_fk | type: CONSTRAINT --
-- ALTER TABLE data.observations DROP CONSTRAINT IF EXISTS observations_features_of_interest_fk CASCADE;
ALTER TABLE data.observations ADD CONSTRAINT observations_features_of_interest_fk FOREIGN KEY (features_of_interest_id)
REFERENCES data.features_of_interest (id) MATCH SIMPLE
ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ddl-end --

-- object: participants_users_fk | type: CONSTRAINT --
-- ALTER TABLE data.participants DROP CONSTRAINT IF EXISTS participants_users_fk CASCADE;
ALTER TABLE data.participants ADD CONSTRAINT participants_users_fk FOREIGN KEY (user_id)
REFERENCES auth.users (id) MATCH SIMPLE
ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ddl-end --

-- object: "grant_U_72fefecc16" | type: PERMISSION --
GRANT USAGE
   ON SCHEMA data
   TO webuser,anon;

-- ddl-end --


-- object: grant_rawd_87ad18c88a | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE,DELETE
   ON TABLE data.ownerships
   TO webuser;

-- ddl-end --


-- object: grant_rawd_9c47979853 | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE,DELETE
   ON TABLE data.sensors
   TO webuser;

-- ddl-end --


-- object: grant_r_35bae7d3cf | type: PERMISSION --
GRANT SELECT
   ON TABLE data.data_stream
   TO webuser;

-- ddl-end --


-- object: grant_r_d1632fdea1 | type: PERMISSION --
GRANT SELECT
   ON TABLE data.observations
   TO webuser;

-- ddl-end --


-- object: grant_r_a6107bdbdb | type: PERMISSION --
GRANT SELECT
   ON TABLE data.features_of_interest
   TO webuser;

-- ddl-end --


-- object: grant_r_4fa48971dc | type: PERMISSION --
GRANT SELECT
   ON TABLE api.participant_observations
   TO webuser;

-- ddl-end --


-- object: "grant_U_dae521e4e3" | type: PERMISSION --
GRANT USAGE
   ON SCHEMA api
   TO webuser;

-- ddl-end --


-- object: grant_rw_afd8703543 | type: PERMISSION --
GRANT SELECT,UPDATE
   ON TABLE api.users
   TO webuser;

-- ddl-end --


-- object: grant_r_fe0574898d | type: PERMISSION --
GRANT SELECT
   ON TABLE api.participant_observations
   TO researcher;

-- ddl-end --



