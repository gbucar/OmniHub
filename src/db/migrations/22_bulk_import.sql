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
