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

-- object: admin | type: ROLE --
-- DROP ROLE IF EXISTS admin;
CREATE ROLE admin WITH 
	ROLE postgrest;
-- ddl-end --

-- object: integration | type: ROLE --
-- DROP ROLE IF EXISTS integration;
CREATE ROLE integration WITH 
	ROLE postgrest;
-- ddl-end --


-- ** Database creation must be performed outside a multi lined SQL file. 
-- ** These commands were put in this file only as a convenience.

-- object: postgres | type: DATABASE --
-- DROP DATABASE IF EXISTS postgres;
-- CREATE DATABASE postgres;
-- ddl-end --


SET check_function_bodies = false;
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

-- object: log | type: SCHEMA --
-- DROP SCHEMA IF EXISTS log CASCADE;
CREATE SCHEMA log;
-- ddl-end --
ALTER SCHEMA log OWNER TO postgres;
-- ddl-end --

-- object: config | type: SCHEMA --
-- DROP SCHEMA IF EXISTS config CASCADE;
CREATE SCHEMA config;
-- ddl-end --
ALTER SCHEMA config OWNER TO postgres;
-- ddl-end --

SET search_path TO pg_catalog,public,auth,api,data,log,config;
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
	username text NOT NULL,
	password text NOT NULL,
	role text NOT NULL,
	sys_created_at timestamptz NOT NULL DEFAULT NOW(),
	CONSTRAINT users_pk PRIMARY KEY (id),
	CONSTRAINT users_username_unique UNIQUE (username)
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
	sensor_type text NOT NULL,
	name text,
	description text,
	properties jsonb,
	credential_id bigint,
	sys_created_at timestamptz NOT NULL DEFAULT current_timestamp,
	CONSTRAINT sensors_pk PRIMARY KEY (id)
);
-- ddl-end --
COMMENT ON TABLE data.sensors IS E'Sensors of any kind, this can be a physical sensor, a mobile phone application, a sensor connected to a mobile phone app (fitbit) ... But, it has to be identifiable';
-- ddl-end --
COMMENT ON COLUMN data.sensors.properties IS E'custom properties';
-- ddl-end --
ALTER TABLE data.sensors OWNER TO postgres;
-- ddl-end --
ALTER TABLE data.sensors ENABLE ROW LEVEL SECURITY;
-- ddl-end --

-- object: data.data_stream | type: TABLE --
-- DROP TABLE IF EXISTS data.data_stream CASCADE;
CREATE TABLE data.data_stream (
	id bigserial NOT NULL,
	sensor_id bigint,
	name text,
	description text,
	unit_of_measurement jsonb,
	properties jsonb,
	CONSTRAINT data_stream_pk PRIMARY KEY (id)
);
-- ddl-end --
COMMENT ON TABLE data.data_stream IS E'Something that the sensor measures (temperature, humidity, speed ...)';
-- ddl-end --
ALTER TABLE data.data_stream OWNER TO postgres;
-- ddl-end --
ALTER TABLE data.data_stream ENABLE ROW LEVEL SECURITY;
-- ddl-end --

-- object: data.ownerships | type: TABLE --
-- DROP TABLE IF EXISTS data.ownerships CASCADE;
CREATE TABLE data.ownerships (
	user_id uuid NOT NULL,
	sensor_id bigint NOT NULL,
	start_date timestamptz NOT NULL,
	end_date timestamptz NOT NULL,
	sys_created_at timestamptz NOT NULL DEFAULT current_timestamp,
	CONSTRAINT ownerships_pk PRIMARY KEY (user_id,sensor_id,start_date,end_date)
);
-- ddl-end --
ALTER TABLE data.ownerships OWNER TO postgres;
-- ddl-end --
ALTER TABLE data.ownerships ENABLE ROW LEVEL SECURITY;
-- ddl-end --

-- object: data.locations | type: TABLE --
-- DROP TABLE IF EXISTS data.locations CASCADE;
CREATE TABLE data.locations (
	id bigserial NOT NULL,
	geog geography,
	properties jsonb,
	CONSTRAINT features_of_interest_pk PRIMARY KEY (id)
);
-- ddl-end --
COMMENT ON TABLE data.locations IS E'Geographic location where the observation was made';
-- ddl-end --
ALTER TABLE data.locations OWNER TO postgres;
-- ddl-end --
ALTER TABLE data.locations ENABLE ROW LEVEL SECURITY;
-- ddl-end --

-- object: data.participants | type: TABLE --
-- DROP TABLE IF EXISTS data.participants CASCADE;
CREATE TABLE data.participants (
	user_id uuid NOT NULL,
	properties jsonb,
	sys_created_at timestamptz NOT NULL DEFAULT current_timestamp,
	sys_changed_at timestamptz NOT NULL DEFAULT current_timestamp,
	CONSTRAINT participant_pk PRIMARY KEY (user_id)
);
-- ddl-end --
ALTER TABLE data.participants OWNER TO postgres;
-- ddl-end --
ALTER TABLE data.participants ENABLE ROW LEVEL SECURITY;
-- ddl-end --

-- object: data.observations | type: TABLE --
-- DROP TABLE IF EXISTS data.observations CASCADE;
CREATE TABLE data.observations (
	id bigserial NOT NULL,
	data_stream_id bigint NOT NULL,
	phenomenon_time tstzrange NOT NULL,
	result numeric NOT NULL,
	properties jsonb,
	location_id bigint,
	CONSTRAINT observation_pk PRIMARY KEY (id),
	CONSTRAINT observations_phenomenon_time_datastream_id_unique UNIQUE (data_stream_id,phenomenon_time)
);
-- ddl-end --
COMMENT ON TABLE data.observations IS E'Measurement of the datastream';
-- ddl-end --
COMMENT ON COLUMN data.observations.phenomenon_time IS E'The time period when the measurement occurred in the real world.';
-- ddl-end --
COMMENT ON COLUMN data.observations.result IS E'The measured value';
-- ddl-end --
ALTER TABLE data.observations OWNER TO postgres;
-- ddl-end --
ALTER TABLE data.observations ENABLE ROW LEVEL SECURITY;
-- ddl-end --

-- object: allow_admin_select_user_data | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_select_user_data ON auth.users CASCADE;
CREATE POLICY allow_admin_select_user_data ON auth.users
	AS PERMISSIVE
	FOR SELECT
	TO admin
	USING (true);
-- ddl-end --

-- object: auth.credentials | type: TABLE --
-- DROP TABLE IF EXISTS auth.credentials CASCADE;
CREATE TABLE auth.credentials (
	id bigserial NOT NULL,
	description text NOT NULL,
	properties jsonb NOT NULL,
	CONSTRAINT credentials_pk PRIMARY KEY (id)
);
-- ddl-end --
COMMENT ON TABLE auth.credentials IS E'Any credentials that need to be saved in the database (api keys, ...)';
-- ddl-end --
ALTER TABLE auth.credentials OWNER TO postgres;
-- ddl-end --
ALTER TABLE auth.credentials ENABLE ROW LEVEL SECURITY;
-- ddl-end --

-- object: auth.encrypt_pass | type: FUNCTION --
-- DROP FUNCTION IF EXISTS auth.encrypt_pass() CASCADE;
CREATE OR REPLACE FUNCTION auth.encrypt_pass ()
	RETURNS trigger
	LANGUAGE plpgsql
	VOLATILE 
	CALLED ON NULL INPUT
	SECURITY DEFINER
	PARALLEL UNSAFE
	COST 1
	AS 
$function$
begin
  if tg_op = 'INSERT' or new.password <> old.password then
    new.password = crypt(new.password, gen_salt('bf'));
  end if;
  return new;
end;

$function$;
-- ddl-end --
ALTER FUNCTION auth.encrypt_pass() OWNER TO postgres;
-- ddl-end --

-- object: encrypt_pass | type: TRIGGER --
-- DROP TRIGGER IF EXISTS encrypt_pass ON auth.users CASCADE;
CREATE OR REPLACE TRIGGER encrypt_pass
	BEFORE INSERT OR UPDATE OF password
	ON auth.users
	FOR EACH ROW
	EXECUTE PROCEDURE auth.encrypt_pass();
-- ddl-end --

-- object: auth.get_user_by_username | type: FUNCTION --
-- DROP FUNCTION IF EXISTS auth.get_user_by_username(text,text) CASCADE;
CREATE OR REPLACE FUNCTION auth.get_user_by_username (IN username text, IN password text)
	RETURNS TABLE (role name, id uuid)
	LANGUAGE sql
	VOLATILE 
	CALLED ON NULL INPUT
	SECURITY DEFINER
	PARALLEL UNSAFE
	COST 1
	AS 
$function$
  select role, id from auth.users
  where users.username = get_user_by_username.username
   and users.password = crypt(get_user_by_username.password, users.password);

$function$;
-- ddl-end --
ALTER FUNCTION auth.get_user_by_username(text,text) OWNER TO postgres;
-- ddl-end --

-- object: api.login | type: FUNCTION --
-- DROP FUNCTION IF EXISTS api.login(text,text) CASCADE;
CREATE OR REPLACE FUNCTION api.login (IN username text, IN password text)
	RETURNS json
	LANGUAGE plpgsql
	VOLATILE 
	CALLED ON NULL INPUT
	SECURITY DEFINER
	PARALLEL UNSAFE
	COST 1
	AS 
$function$
declare
_role name;
_id uuid;
_jwt_secret text;
_jwt_duration_seconds bigint;
_token text;
begin
SELECT role, id INTO _role, _id 
  FROM auth.get_user_by_username(login.username, login.password);

  if _role is null then
    insert into log.login_attempts (username, success, properties) 
      values (login.username, false, '{}');
    perform set_config('response.status', '401', true);
    return  json_build_object('error', 'invalid username or password') ;
  end if;

  select setting_value into _jwt_secret
  from config.app_settings s where s.setting_name = 'POSTGREST_JWT_SECRET';

  select setting_value::bigint into _jwt_duration_seconds
  from config.app_settings s where s.setting_name = 'POSTGREST_JWT_DURATION_SECONDS';

  select sign(
      row_to_json(r), _jwt_secret
    ) as token
    from (
      select _role as role, _id as id,
         extract(epoch from now())::bigint + _jwt_duration_seconds as exp
    ) r
    into _token;

  insert into log.login_attempts (username, success, properties) values (login.username, true, '{}');

  return json_build_object('token', _token);
end;
$function$;
-- ddl-end --
ALTER FUNCTION api.login(text,text) OWNER TO postgres;
-- ddl-end --

-- object: api.change_password | type: FUNCTION --
-- DROP FUNCTION IF EXISTS api.change_password(text,text,text) CASCADE;
CREATE OR REPLACE FUNCTION api.change_password (IN password text, IN new_password text, IN new_password_confirmation text)
	RETURNS void
	LANGUAGE plpgsql
	VOLATILE 
	CALLED ON NULL INPUT
	SECURITY DEFINER
	PARALLEL UNSAFE
	COST 1
	AS 
$function$
declare
_role name;
_id uuid;
begin
SELECT gu.role, gu.id INTO _role, _id 
  FROM auth.get_user_by_id((current_setting('request.jwt.claims', true)::json->>'id')::uuid, change_password.password) as gu;

  if _role is null then
    raise invalid_password using message = 'invalid username or password';
  end if;

  if not change_password.new_password = change_password.new_password_confirmation then
    raise invalid_password using message = 'passwords should match';
  end if;

  update auth.users 
    set password = change_password.new_password
    where auth.users.id = _id;
end;

$function$;
-- ddl-end --
ALTER FUNCTION api.change_password(text,text,text) OWNER TO postgres;
-- ddl-end --

-- object: auth.get_user_by_id | type: FUNCTION --
-- DROP FUNCTION IF EXISTS auth.get_user_by_id(text,text) CASCADE;
CREATE OR REPLACE FUNCTION auth.get_user_by_id (IN id text, IN password text)
	RETURNS TABLE (role name, id uuid)
	LANGUAGE sql
	VOLATILE 
	CALLED ON NULL INPUT
	SECURITY DEFINER
	PARALLEL UNSAFE
	COST 1
	AS 
$function$
  select role, id from auth.users
  where users.id = get_user_by_id.id::uuid
   and users.password = crypt(get_user_by_id.password, users.password);

$function$;
-- ddl-end --
ALTER FUNCTION auth.get_user_by_id(text,text) OWNER TO postgres;
-- ddl-end --

-- object: data.many_participants_studies | type: TABLE --
-- DROP TABLE IF EXISTS data.many_participants_studies CASCADE;
CREATE TABLE data.many_participants_studies (
	user_id uuid NOT NULL,
	study_id bigint NOT NULL,
	membership_period tstzrange NOT NULL,
	CONSTRAINT many_participants_studies_pk PRIMARY KEY (user_id,study_id)
);
-- ddl-end --
ALTER TABLE data.many_participants_studies OWNER TO postgres;
-- ddl-end --
ALTER TABLE data.many_participants_studies ENABLE ROW LEVEL SECURITY;
-- ddl-end --

-- object: api.list_sensors | type: VIEW --
-- DROP VIEW IF EXISTS api.list_sensors CASCADE;
CREATE OR REPLACE VIEW api.list_sensors
WITH (security_invoker=true)
AS 
select s.*, max(upper(phenomenon_time)) as last_activity from data.sensors s
left join data.data_stream ds on s.id = ds.sensor_id
left join data.observations ob on ob.data_stream_id = ds.id
group by s.id;
-- ddl-end --
ALTER VIEW api.list_sensors OWNER TO postgres;
-- ddl-end --

-- object: allow_webuser_select_own_participant_data | type: POLICY --
-- DROP POLICY IF EXISTS allow_webuser_select_own_participant_data ON data.participants CASCADE;
CREATE POLICY allow_webuser_select_own_participant_data ON data.participants
	AS PERMISSIVE
	FOR SELECT
	TO webuser
	USING (user_id=(current_setting('request.jwt.claims', true)::json->>'id')::uuid);
-- ddl-end --

-- object: allow_webuser_update_own_participant_data | type: POLICY --
-- DROP POLICY IF EXISTS allow_webuser_update_own_participant_data ON data.participants CASCADE;
CREATE POLICY allow_webuser_update_own_participant_data ON data.participants
	AS PERMISSIVE
	FOR UPDATE
	TO webuser
	USING (user_id=(current_setting('request.jwt.claims', true)::json->>'id')::uuid);
-- ddl-end --

-- object: allow_webuser_select_own_ownerships | type: POLICY --
-- DROP POLICY IF EXISTS allow_webuser_select_own_ownerships ON data.ownerships CASCADE;
CREATE POLICY allow_webuser_select_own_ownerships ON data.ownerships
	AS PERMISSIVE
	FOR SELECT
	TO webuser
	USING (user_id=(current_setting('request.jwt.claims', true)::json->>'id')::uuid);
-- ddl-end --

-- object: allow_webuser_select_own_sensors | type: POLICY --
-- DROP POLICY IF EXISTS allow_webuser_select_own_sensors ON data.sensors CASCADE;
CREATE POLICY allow_webuser_select_own_sensors ON data.sensors
	AS PERMISSIVE
	FOR ALL
	TO webuser
	USING (exists (
  select 1 from data.ownerships o 
    where o.sensor_id = id 
      and o.user_id=(current_setting('request.jwt.claims', true)::json->>'id')::uuid
));
-- ddl-end --

-- object: allow_webuser_select_own_datastream | type: POLICY --
-- DROP POLICY IF EXISTS allow_webuser_select_own_datastream ON data.data_stream CASCADE;
CREATE POLICY allow_webuser_select_own_datastream ON data.data_stream
	AS PERMISSIVE
	FOR SELECT
	TO webuser
	USING (exists (
  select 1 from data.sensors s 
    join data.ownerships o on o.sensor_id = s.id
    where s.id = sensor_id
      and o.user_id=(current_setting('request.jwt.claims', true)::json->>'id')::uuid
));
-- ddl-end --

-- object: allow_webuser_select_own_observations | type: POLICY --
-- DROP POLICY IF EXISTS allow_webuser_select_own_observations ON data.observations CASCADE;
CREATE POLICY allow_webuser_select_own_observations ON data.observations
	AS PERMISSIVE
	FOR SELECT
	TO webuser
	USING (exists (
  select 1 from data.data_stream ds
    join data.ownerships o on o.sensor_id = ds.sensor_id
    where ds.id = observations.data_stream_id
      and o.user_id=(current_setting('request.jwt.claims', true)::json->>'id')::uuid
      and observations.phenomenon_time && tstzrange(o.start_date, o.end_date)
));
-- ddl-end --

-- object: allow_webuser_select_own_locations | type: POLICY --
-- DROP POLICY IF EXISTS allow_webuser_select_own_locations ON data.locations CASCADE;
CREATE POLICY allow_webuser_select_own_locations ON data.locations
	AS PERMISSIVE
	FOR SELECT
	TO webuser
	USING (exists (
  select 1 from data.observations ob
    join data.data_stream ds on ds.id = ob.data_stream_id
    join data.ownerships o on o.sensor_id = ds.sensor_id
    where ob.location_id = locations.id
      and o.user_id=(current_setting('request.jwt.claims', true)::json->>'id')::uuid
      and ob.phenomenon_time && tstzrange(o.start_date, o.end_date)
));
-- ddl-end --

-- object: api.observations | type: VIEW --
-- DROP VIEW IF EXISTS api.observations CASCADE;
CREATE OR REPLACE VIEW api.observations
WITH (security_invoker=true)
AS 
select ob.*, l.geog from  data.observations ob
join data.locations l on l.id = ob.location_id;
-- ddl-end --
ALTER VIEW api.observations OWNER TO postgres;
-- ddl-end --

ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- object: log.integration_execution | type: TABLE --
-- DROP TABLE IF EXISTS log.integration_execution CASCADE;
CREATE TABLE log.integration_execution (
	name text NOT NULL,
	datetime timestamptz NOT NULL DEFAULT current_timestamp,
	value jsonb,
	CONSTRAINT integration_execution_pk PRIMARY KEY (name,datetime)
);
-- ddl-end --
ALTER TABLE log.integration_execution OWNER TO postgres;
-- ddl-end --
ALTER TABLE log.integration_execution ENABLE ROW LEVEL SECURITY;
-- ddl-end --

-- object: allow_admin_update_user_data_cp | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_update_user_data_cp ON auth.users CASCADE;
CREATE POLICY allow_admin_update_user_data_cp ON auth.users
	AS PERMISSIVE
	FOR UPDATE
	TO admin
	USING (true);
-- ddl-end --

-- object: allow_admin_researcher_select_all_participants | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_researcher_select_all_participants ON data.participants CASCADE;
CREATE POLICY allow_admin_researcher_select_all_participants ON data.participants
	AS PERMISSIVE
	FOR SELECT
	TO admin, researcher
	USING (true);
-- ddl-end --

-- object: allow_admin_update_all_participants_cp | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_update_all_participants_cp ON data.participants CASCADE;
CREATE POLICY allow_admin_update_all_participants_cp ON data.participants
	AS PERMISSIVE
	FOR UPDATE
	TO admin
	USING (true);
-- ddl-end --

-- object: allow_admin_researcher_select_all_ownerships | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_researcher_select_all_ownerships ON data.ownerships CASCADE;
CREATE POLICY allow_admin_researcher_select_all_ownerships ON data.ownerships
	AS PERMISSIVE
	FOR SELECT
	TO admin, researcher
	USING (true);
-- ddl-end --

-- object: allow_admin_update_all_ownerships | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_update_all_ownerships ON data.ownerships CASCADE;
CREATE POLICY allow_admin_update_all_ownerships ON data.ownerships
	AS PERMISSIVE
	FOR UPDATE
	TO admin
	USING (true);
-- ddl-end --

-- object: allow_admin_insert_all_ownerships_cp | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_insert_all_ownerships_cp ON data.ownerships CASCADE;
CREATE POLICY allow_admin_insert_all_ownerships_cp ON data.ownerships
	AS PERMISSIVE
	FOR INSERT
	TO admin
	WITH CHECK (true);
-- ddl-end --

-- object: allow_admin_researcher_select_all_sensors | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_researcher_select_all_sensors ON data.sensors CASCADE;
CREATE POLICY allow_admin_researcher_select_all_sensors ON data.sensors
	AS PERMISSIVE
	FOR SELECT
	TO admin, researcher
	USING (true);
-- ddl-end --

-- object: allow_admin_update_all_sensors | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_update_all_sensors ON data.sensors CASCADE;
CREATE POLICY allow_admin_update_all_sensors ON data.sensors
	AS PERMISSIVE
	FOR UPDATE
	TO admin
	USING (true);
-- ddl-end --

-- object: allow_admin_insert_all_sensors | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_insert_all_sensors ON data.sensors CASCADE;
CREATE POLICY allow_admin_insert_all_sensors ON data.sensors
	AS PERMISSIVE
	FOR INSERT
	TO admin
	WITH CHECK (true);
-- ddl-end --

-- object: allow_admin_researcher_select_all_datastream | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_researcher_select_all_datastream ON data.data_stream CASCADE;
CREATE POLICY allow_admin_researcher_select_all_datastream ON data.data_stream
	AS PERMISSIVE
	FOR SELECT
	TO admin, researcher
	USING (true);
-- ddl-end --

-- object: allow_admin_researcher_select_all_observations | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_researcher_select_all_observations ON data.observations CASCADE;
CREATE POLICY allow_admin_researcher_select_all_observations ON data.observations
	AS PERMISSIVE
	FOR SELECT
	TO admin, researcher
	USING (true);
-- ddl-end --

-- object: allow_admin_researcher_select_all_locations | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_researcher_select_all_locations ON data.locations CASCADE;
CREATE POLICY allow_admin_researcher_select_all_locations ON data.locations
	AS PERMISSIVE
	FOR SELECT
	TO admin, researcher
	USING (true);
-- ddl-end --

-- object: allow_integration_select_all_credentials | type: POLICY --
-- DROP POLICY IF EXISTS allow_integration_select_all_credentials ON auth.credentials CASCADE;
CREATE POLICY allow_integration_select_all_credentials ON auth.credentials
	AS PERMISSIVE
	FOR SELECT
	TO integration
	USING (true);
-- ddl-end --

-- object: allow_admin_insert_all_credentials | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_insert_all_credentials ON auth.credentials CASCADE;
CREATE POLICY allow_admin_insert_all_credentials ON auth.credentials
	AS PERMISSIVE
	FOR INSERT
	TO admin
	WITH CHECK (true);
-- ddl-end --

-- object: allow_integration_insert_all_integration_execution | type: POLICY --
-- DROP POLICY IF EXISTS allow_integration_insert_all_integration_execution ON log.integration_execution CASCADE;
CREATE POLICY allow_integration_insert_all_integration_execution ON log.integration_execution
	AS PERMISSIVE
	FOR INSERT
	TO integration
	WITH CHECK (true);
-- ddl-end --

-- object: allow_admin_insert_user_data_cp_cp | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_insert_user_data_cp_cp ON auth.users CASCADE;
CREATE POLICY allow_admin_insert_user_data_cp_cp ON auth.users
	AS PERMISSIVE
	FOR INSERT
	TO admin
	WITH CHECK (true);
-- ddl-end --

-- object: allow_admin_insert_all_participants_cp_cp | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_insert_all_participants_cp_cp ON data.participants CASCADE;
CREATE POLICY allow_admin_insert_all_participants_cp_cp ON data.participants
	AS PERMISSIVE
	FOR INSERT
	TO admin
	WITH CHECK (true);
-- ddl-end --

-- object: allow_admin_update_all_datastream | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_update_all_datastream ON data.data_stream CASCADE;
CREATE POLICY allow_admin_update_all_datastream ON data.data_stream
	AS PERMISSIVE
	FOR UPDATE
	TO admin
	USING (true);
-- ddl-end --

-- object: allow_admin_insert_all_datastream | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_insert_all_datastream ON data.data_stream CASCADE;
CREATE POLICY allow_admin_insert_all_datastream ON data.data_stream
	AS PERMISSIVE
	FOR INSERT
	TO admin
	WITH CHECK (true);
-- ddl-end --

-- object: allow_integration_insert_all_observations | type: POLICY --
-- DROP POLICY IF EXISTS allow_integration_insert_all_observations ON data.observations CASCADE;
CREATE POLICY allow_integration_insert_all_observations ON data.observations
	AS PERMISSIVE
	FOR INSERT
	TO integration
	WITH CHECK (true);
-- ddl-end --

-- object: allow_integration_insert_all_locations | type: POLICY --
-- DROP POLICY IF EXISTS allow_integration_insert_all_locations ON data.locations CASCADE;
CREATE POLICY allow_integration_insert_all_locations ON data.locations
	AS PERMISSIVE
	FOR INSERT
	TO integration
	WITH CHECK (true);
-- ddl-end --

-- object: config.app_settings | type: TABLE --
-- DROP TABLE IF EXISTS config.app_settings CASCADE;
CREATE TABLE config.app_settings (
	setting_value text NOT NULL,
	setting_name text NOT NULL,
	CONSTRAINT app_settings_pk PRIMARY KEY (setting_name)
);
-- ddl-end --
ALTER TABLE config.app_settings OWNER TO postgres;
-- ddl-end --

-- object: log.login_attempts | type: TABLE --
-- DROP TABLE IF EXISTS log.login_attempts CASCADE;
CREATE TABLE log.login_attempts (
	username text NOT NULL,
	sys_created_at timestamptz NOT NULL DEFAULT current_timestamp,
	success boolean NOT NULL,
	properties jsonb,
	CONSTRAINT login_attempts_pk PRIMARY KEY (username,sys_created_at)
);
-- ddl-end --
ALTER TABLE log.login_attempts OWNER TO postgres;
-- ddl-end --

-- object: api.add_participant | type: FUNCTION --
-- DROP FUNCTION IF EXISTS api.add_participant(text,text,jsonb) CASCADE;
CREATE OR REPLACE FUNCTION api.add_participant (IN username text, IN password text, IN properties jsonb)
	RETURNS void
	LANGUAGE plpgsql
	VOLATILE 
	CALLED ON NULL INPUT
	SECURITY INVOKER
	PARALLEL UNSAFE
	COST 1
	AS 
$function$
declare
	_user_id uuid;
begin

	insert into auth.users (username, password, role)
	values (add_participant.username, add_participant.password, 'webuser')
	returning auth.users.id into _user_id;
	
	insert into data.participants (user_id, properties)
	values (_user_id, add_participant.properties);

end;

$function$;
-- ddl-end --
ALTER FUNCTION api.add_participant(text,text,jsonb) OWNER TO postgres;
-- ddl-end --

-- object: data.studies_id_seq | type: SEQUENCE --
-- DROP SEQUENCE IF EXISTS data.studies_id_seq CASCADE;
CREATE SEQUENCE data.studies_id_seq
	INCREMENT BY 1
	MINVALUE -9223372036854775808
	MAXVALUE 9223372036854775807
	START WITH 1
	CACHE 1
	NO CYCLE
	OWNED BY NONE;

-- ddl-end --

-- object: data.studies | type: TABLE --
-- DROP TABLE IF EXISTS data.studies CASCADE;
CREATE TABLE data.studies (
	id bigint NOT NULL DEFAULT nextval('data.studies_id_seq'::regclass),
	name text NOT NULL,
	active_period tstzrange NOT NULL,
	CONSTRAINT study_pk PRIMARY KEY (id)
);
-- ddl-end --
ALTER TABLE data.studies OWNER TO postgres;
-- ddl-end --
ALTER TABLE data.studies ENABLE ROW LEVEL SECURITY;
-- ddl-end --

-- object: api.list_participants | type: VIEW --
-- DROP VIEW IF EXISTS api.list_participants CASCADE;
CREATE OR REPLACE VIEW api.list_participants
WITH (security_invoker=true)
AS 
SELECT p.user_id,
    p.properties,
    p.sys_created_at,
    p.sys_changed_at,
    u.username,
    u.role,
    s.name AS study_name,
    s.id as study_id
   FROM data.participants p
     JOIN auth.users u ON u.id = p.user_id
     JOIN data.many_participants_studies mps ON p.user_id = mps.user_id
     JOIN data.studies s ON s.id = mps.study_id;
-- ddl-end --
ALTER VIEW api.list_participants OWNER TO postgres;
-- ddl-end --

-- object: allow_admin_all_studies | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_all_studies ON data.studies CASCADE;
CREATE POLICY allow_admin_all_studies ON data.studies
	AS PERMISSIVE
	FOR ALL
	TO admin
	USING (true)
	WITH CHECK (true);
-- ddl-end --

-- object: allow_admin_all_many_participants_studies | type: POLICY --
-- DROP POLICY IF EXISTS allow_admin_all_many_participants_studies ON data.many_participants_studies CASCADE;
CREATE POLICY allow_admin_all_many_participants_studies ON data.many_participants_studies
	AS PERMISSIVE
	FOR ALL
	TO admin
	USING (true)
	WITH CHECK (true);
-- ddl-end --

-- object: api.studies | type: VIEW --
-- DROP VIEW IF EXISTS api.studies CASCADE;
CREATE OR REPLACE VIEW api.studies
WITH (security_invoker=true)
AS 
select * from data.studies;
-- ddl-end --
ALTER VIEW api.studies OWNER TO postgres;
-- ddl-end --

-- object: api.participants | type: VIEW --
-- DROP VIEW IF EXISTS api.participants CASCADE;
CREATE OR REPLACE VIEW api.participants
WITH (security_invoker=true)
AS 
select * from data.participants;
-- ddl-end --
ALTER VIEW api.participants OWNER TO postgres;
-- ddl-end --

-- object: api.many_participants_studies | type: VIEW --
-- DROP VIEW IF EXISTS api.many_participants_studies CASCADE;
CREATE OR REPLACE VIEW api.many_participants_studies
WITH (security_invoker=true)
AS 
select * from data.many_participants_studies;
-- ddl-end --
ALTER VIEW api.many_participants_studies OWNER TO postgres;
-- ddl-end --

-- object: api.ownerships | type: VIEW --
-- DROP VIEW IF EXISTS api.ownerships CASCADE;
CREATE OR REPLACE VIEW api.ownerships
WITH (security_invoker=true)
AS 
select * from data.ownerships;
-- ddl-end --
ALTER VIEW api.ownerships OWNER TO postgres;
-- ddl-end --

-- object: api.sensors | type: VIEW --
-- DROP VIEW IF EXISTS api.sensors CASCADE;
CREATE OR REPLACE VIEW api.sensors
WITH (security_invoker=true)
AS 
select * from data.sensors;
-- ddl-end --
ALTER VIEW api.sensors OWNER TO postgres;
-- ddl-end --

-- object: fk_sensors_credentials_credential_id | type: CONSTRAINT --
-- ALTER TABLE data.sensors DROP CONSTRAINT IF EXISTS fk_sensors_credentials_credential_id CASCADE;
ALTER TABLE data.sensors ADD CONSTRAINT fk_sensors_credentials_credential_id FOREIGN KEY (credential_id)
REFERENCES auth.credentials (id) MATCH SIMPLE
ON DELETE NO ACTION ON UPDATE NO ACTION;
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

-- object: participants_users_fk | type: CONSTRAINT --
-- ALTER TABLE data.participants DROP CONSTRAINT IF EXISTS participants_users_fk CASCADE;
ALTER TABLE data.participants ADD CONSTRAINT participants_users_fk FOREIGN KEY (user_id)
REFERENCES auth.users (id) MATCH SIMPLE
ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ddl-end --

-- object: observations_datastreams_fk | type: CONSTRAINT --
-- ALTER TABLE data.observations DROP CONSTRAINT IF EXISTS observations_datastreams_fk CASCADE;
ALTER TABLE data.observations ADD CONSTRAINT observations_datastreams_fk FOREIGN KEY (data_stream_id)
REFERENCES data.data_stream (id) MATCH SIMPLE
ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ddl-end --

-- object: observation_location_fk | type: CONSTRAINT --
-- ALTER TABLE data.observations DROP CONSTRAINT IF EXISTS observation_location_fk CASCADE;
ALTER TABLE data.observations ADD CONSTRAINT observation_location_fk FOREIGN KEY (location_id)
REFERENCES data.locations (id) MATCH SIMPLE
ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ddl-end --

-- object: many_participnts_studies_participants_fk | type: CONSTRAINT --
-- ALTER TABLE data.many_participants_studies DROP CONSTRAINT IF EXISTS many_participnts_studies_participants_fk CASCADE;
ALTER TABLE data.many_participants_studies ADD CONSTRAINT many_participnts_studies_participants_fk FOREIGN KEY (user_id)
REFERENCES data.participants (user_id) MATCH SIMPLE
ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ddl-end --

-- object: many_participants_studies_studies_fk | type: CONSTRAINT --
-- ALTER TABLE data.many_participants_studies DROP CONSTRAINT IF EXISTS many_participants_studies_studies_fk CASCADE;
ALTER TABLE data.many_participants_studies ADD CONSTRAINT many_participants_studies_studies_fk FOREIGN KEY (study_id)
REFERENCES data.studies (id) MATCH SIMPLE
ON DELETE NO ACTION ON UPDATE NO ACTION;
-- ddl-end --

-- object: "grant_U_f6731eb835" | type: PERMISSION --
GRANT USAGE
   ON SCHEMA data
   TO webuser,researcher,admin;

-- ddl-end --


-- object: grant_r_87ad18c88a | type: PERMISSION --
GRANT SELECT
   ON TABLE data.ownerships
   TO webuser;

-- ddl-end --


-- object: grant_r_9c47979853 | type: PERMISSION --
GRANT SELECT
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


-- object: "grant_U_094f5b4733" | type: PERMISSION --
GRANT USAGE
   ON SCHEMA api
   TO anon,webuser,admin;

-- ddl-end --


-- object: "grant_X_9ba64264f6" | type: PERMISSION --
GRANT EXECUTE
   ON FUNCTION api.login(text,text)
   TO anon;

-- ddl-end --


-- object: grant_rw_715d4e8a64 | type: PERMISSION --
GRANT SELECT,UPDATE
   ON TABLE data.participants
   TO webuser;

-- ddl-end --


-- object: grant_raw_52fc004c22 | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE
   ON TABLE data.participants
   TO admin;

-- ddl-end --


-- object: grant_r_3728460ac5 | type: PERMISSION --
GRANT SELECT
   ON TABLE data.locations
   TO webuser,admin,researcher;

-- ddl-end --


-- object: grant_r_565cc0b08e | type: PERMISSION --
GRANT SELECT
   ON TABLE api.list_sensors
   TO webuser,admin;

-- ddl-end --


-- object: grant_r_9a5345b4e0 | type: PERMISSION --
GRANT SELECT
   ON TABLE api.list_participants
   TO admin;

-- ddl-end --


-- object: "grant_X_5fa93200eb" | type: PERMISSION --
GRANT EXECUTE
   ON FUNCTION api.change_password(text,text,text)
   TO webuser,admin;

-- ddl-end --


-- object: grant_raw_29af6adbbf | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE
   ON TABLE data.ownerships
   TO admin;

-- ddl-end --


-- object: grant_r_d898ee389c | type: PERMISSION --
GRANT SELECT
   ON TABLE data.ownerships
   TO researcher;

-- ddl-end --


-- object: grant_r_cf6c6c895e | type: PERMISSION --
GRANT SELECT
   ON TABLE data.sensors
   TO researcher;

-- ddl-end --


-- object: grant_raw_029a32f070 | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE
   ON TABLE data.sensors
   TO admin;

-- ddl-end --


-- object: grant_raw_e91b25ded6 | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE
   ON TABLE data.data_stream
   TO admin;

-- ddl-end --


-- object: grant_r_fc29f6b8c5 | type: PERMISSION --
GRANT SELECT
   ON TABLE data.data_stream
   TO researcher;

-- ddl-end --


-- object: grant_r_0345a2f336 | type: PERMISSION --
GRANT SELECT
   ON TABLE data.observations
   TO researcher;

-- ddl-end --


-- object: grant_r_0a9c031f01 | type: PERMISSION --
GRANT SELECT
   ON TABLE data.observations
   TO admin;

-- ddl-end --


-- object: grant_a_c3b08acce4 | type: PERMISSION --
GRANT INSERT
   ON TABLE data.locations
   TO integration;

-- ddl-end --


-- object: grant_a_309b87cbf9 | type: PERMISSION --
GRANT INSERT
   ON TABLE data.observations
   TO integration;

-- ddl-end --


-- object: grant_r_92cf247050 | type: PERMISSION --
GRANT SELECT
   ON TABLE api.observations
   TO webuser,admin,researcher;

-- ddl-end --


-- object: "grant_U_6ded8013fd" | type: PERMISSION --
GRANT USAGE
   ON SCHEMA log
   TO integration;

-- ddl-end --


-- object: grant_a_fdee9c6f99 | type: PERMISSION --
GRANT INSERT
   ON TABLE log.integration_execution
   TO integration;

-- ddl-end --


-- object: grant_raw_965d347b4e | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE
   ON TABLE auth.users
   TO admin;

-- ddl-end --


-- object: "grant_U_b018caa252" | type: PERMISSION --
GRANT USAGE
   ON SCHEMA auth
   TO admin;

-- ddl-end --


-- object: "grant_U_8b750cb7c9" | type: PERMISSION --
GRANT USAGE
   ON SCHEMA auth
   TO integration;

-- ddl-end --


-- object: grant_r_cbb9c942e9 | type: PERMISSION --
GRANT SELECT
   ON TABLE auth.credentials
   TO integration;

-- ddl-end --


-- object: grant_r_a12a1b4b17 | type: PERMISSION --
GRANT SELECT
   ON TABLE data.sensors
   TO integration;

-- ddl-end --


-- object: "grant_X_b534e6b3c9" | type: PERMISSION --
GRANT EXECUTE
   ON FUNCTION api.add_participant(text,text,jsonb)
   TO admin;

-- ddl-end --


-- object: grant_raw_f3fae798e0 | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE
   ON TABLE data.many_participants_studies
   TO admin;

-- ddl-end --


-- object: grant_raw_6e613e74b7 | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE
   ON TABLE data.studies
   TO admin;

-- ddl-end --


-- object: grant_rawd_03588a704e | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE,DELETE
   ON TABLE api.studies
   TO admin;

-- ddl-end --


-- object: "grant_rU_c3838f7b39" | type: PERMISSION --
GRANT SELECT,USAGE
   ON SEQUENCE data.studies_id_seq
   TO admin;

-- ddl-end --


-- object: grant_raw_9a5345b4e0 | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE
   ON TABLE api.participants
   TO admin;

-- ddl-end --


-- object: grant_raw_d67fe7aced | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE
   ON TABLE api.many_participants_studies
   TO admin;

-- ddl-end --


-- object: grant_raw_60c50142b6 | type: PERMISSION --
GRANT SELECT,INSERT,UPDATE
   ON TABLE api.ownerships
   TO admin;

-- ddl-end --



