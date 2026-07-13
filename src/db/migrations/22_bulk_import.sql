-- Migration 22: Bulk import participants RPC
--
-- Adds api.bulk_import_participants(jsonb) — imports N users, study
-- memberships, and device ownerships in a single PostgreSQL transaction.
-- Replaces the client-side N+1 loop (1 HTTP per row → 1 HTTP for all rows).
--
-- SECURITY INVOKER: uses the caller's RLS policies (admin has INSERT on
-- auth.users, data.participants, data.many_participants_studies,
-- data.ownerships). The calling role is 'admin', which has CHECK(true)
-- on all relevant tables.

-- object: api.bulk_import_participants | type: FUNCTION --
-- DROP FUNCTION IF EXISTS api.bulk_import_participants(jsonb) CASCADE;
CREATE OR REPLACE FUNCTION api.bulk_import_participants (
	IN payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
CALLED ON NULL INPUT
SECURITY INVOKER
PARALLEL UNSAFE
COST 1
AS $function$
declare
	_row jsonb;
	_user_id uuid;
	_study_id int;
	_sensor_id bigint;
	_device jsonb;
	_created int = 0;
	_skipped_usernames jsonb = '[]'::jsonb;
	_errors jsonb = '[]'::jsonb;
	_dup_username text;
	_default_password text;
	_default_study_id int;
begin
	_default_password := coalesce(payload->>'default_password', 'changeme');
	_default_study_id := (payload->>'default_study_id')::int;

	for _row in select * from jsonb_array_elements(payload->'rows') loop
		begin
			-- Pre-check: does the username already exist?
			-- We do this before INSERT because the encrypt_pass trigger
			-- runs bcrypt on every insert — no point hashing a password
			-- that will be rejected by the unique constraint.
			select u.username into _dup_username
			from auth.users u
			where u.username = _row->>'username';

			if found then
				_skipped_usernames := _skipped_usernames || to_jsonb(_dup_username);
				continue;
			end if;

			-- 1. Create auth.user + data.participant (like add_participant
			--    but returns the id so we can use it below).
			insert into auth.users (username, password, role)
			values (
				_row->>'username',
				-- nullif: treat empty string same as missing → use default
				coalesce(nullif(_row->>'password', ''), _default_password),
				'webuser'
			)
			returning id into _user_id;

			insert into data.participants (user_id, properties)
			values (_user_id, coalesce(_row->'properties', '{}'::jsonb));

			-- 2. Attach to study.
			_study_id := coalesce(
				(_row->>'study_id')::int,
				_default_study_id
			);
			if _study_id is not null then
				insert into data.many_participants_studies (user_id, study_id, membership_period)
				values (
					_user_id,
					_study_id,
					-- If the row has an explicit membership_period use it;
					-- otherwise default to the study's active_period so
					-- the NOT NULL constraint is satisfied.
					coalesce(
						(_row->>'membership_period')::tstzrange,
						(select active_period from data.studies where id = _study_id)
					)
				);
			end if;

			-- 3. Assign device ownerships.
			for _device in select * from jsonb_array_elements(coalesce(_row->'devices', '[]'::jsonb)) loop
				select s.id into _sensor_id
				from data.sensors s
				where s.name = _device->>'name';

				if _sensor_id is not null then
					insert into data.ownerships (user_id, sensor_id, start_date, end_date)
					values (
						_user_id,
						_sensor_id,
						(_device->>'start_date')::timestamptz,
						(_device->>'end_date')::timestamptz
					);
				end if;
			end loop;

			_created := _created + 1;

		exception
			when unique_violation then
				-- Race condition: pre-check passed but another session
				-- inserted the same username concurrently. Treat as skip.
				_skipped_usernames := _skipped_usernames || to_jsonb(_row->>'username');
			when others then
				_errors := _errors || jsonb_build_object(
					'username', _row->>'username',
					'message', left(sqlerrm, 200)
				);
		end;
	end loop;

	return jsonb_build_object(
		'created', _created,
		'skipped', _skipped_usernames,
		'errors', _errors
	);
end;
$function$;

ALTER FUNCTION api.bulk_import_participants(jsonb) OWNER TO postgres;

-- Only admin needs EXECUTE — bulk import creates users, assigns study
-- memberships and device ownerships, which requires admin-level INSERT
-- policies. `ANON` and `webuser` must not be able to call this.
-- `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`
-- in 20_init.sql means new functions are not executable by default.
GRANT EXECUTE ON FUNCTION api.bulk_import_participants(jsonb) TO admin;

-- =========================================================================
-- Bulk download
-- =========================================================================
--
-- Returns all participants in a study (or a filtered subset by user_ids)
-- with their membership period and device assignments in a single query.
-- Replaces the client-side N+1 pattern (2N HTTP calls → 1 HTTP call).

-- object: api.bulk_download_participants | type: FUNCTION --
-- DROP FUNCTION IF EXISTS api.bulk_download_participants(int, uuid[]) CASCADE;
CREATE OR REPLACE FUNCTION api.bulk_download_participants (
	IN study_id int,
	IN user_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
CALLED ON NULL INPUT
SECURITY INVOKER
PARALLEL SAFE
COST 1
AS $function$
declare
	_result jsonb;
begin
	with
	selected as (
		select p.user_id, u.username, u.role, p.properties, p.sys_created_at
		from data.participants p
		join auth.users u on u.id = p.user_id
		join data.many_participants_studies mps on mps.user_id = p.user_id
		where mps.study_id = bulk_download_participants.study_id
		  and (bulk_download_participants.user_ids is null
			   or p.user_id = any(bulk_download_participants.user_ids))
	),
	study_info as (
		select name as study_name, active_period
		from data.studies
		where id = bulk_download_participants.study_id
	),
	periods as (
		select user_id, membership_period
		from data.many_participants_studies mps
		where mps.study_id = bulk_download_participants.study_id
	),
	ownerships as (
		select o.user_id, s.name as sensor_name, o.start_date, o.end_date
		from data.ownerships o
		join data.sensors s on s.id = o.sensor_id
		where o.user_id in (select user_id from selected)
	),
	with_devices as (
		select
			s.user_id, s.username, s.role, s.properties, s.sys_created_at,
			p.membership_period,
			coalesce(
				jsonb_agg(
					jsonb_build_object(
						'name', o.sensor_name,
						'start', o.start_date,
						'end', o.end_date
					) order by o.start_date
				) filter (where o.sensor_name is not null),
				'[]'::jsonb
			) as devices
		from selected s
		left join periods p on p.user_id = s.user_id
		left join ownerships o on o.user_id = s.user_id
		group by s.user_id, s.username, s.role, s.properties, s.sys_created_at, p.membership_period
	),
	stats as (
		select coalesce(max(jsonb_array_length(devices)), 0) as max_devices
		from with_devices
	)
	select jsonb_build_object(
		'study_name', si.study_name,
		'study_start', lower(si.active_period),
		'study_end', upper(si.active_period),
		'max_devices', (select max_devices from stats),
		'rows', (select jsonb_agg(
			jsonb_build_object(
				'user_id', d.user_id,
				'username', d.username,
				'role', d.role,
				'type', d.properties->>'type',
				'name', d.properties->>'name',
				'age', d.properties->>'age',
				'sex', d.properties->>'sex',
				'sys_created_at', d.sys_created_at,
				'study_name', si.study_name,
				'study_start_date', lower(d.membership_period),
				'study_end_date', upper(d.membership_period),
				'devices', d.devices
			) order by d.username
		) from with_devices d)
	)
	into _result
	from study_info si;

	return _result;
end;
$function$;

GRANT EXECUTE ON FUNCTION api.bulk_download_participants(int, uuid[]) TO admin;
