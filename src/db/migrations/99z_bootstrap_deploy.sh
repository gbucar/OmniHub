#!/bin/bash
set -euo pipefail

# Deploy bootstrap — runs once on the first database initialisation.
# Configures env-driven secrets, creates the initial admin user, and
# injects the Atmotube API key used by the pipeline.

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"

# Required environment variables
: "${ADMIN_USERNAME:?ADMIN_USERNAME is not set}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD is not set}"
: "${PGRST_JWT_SECRET:?PGRST_JWT_SECRET is not set}"
: "${POSTGREST_DB_PASSWORD:?POSTGREST_DB_PASSWORD is not set}"
: "${PIPELINE_DB_PASSWORD:?PIPELINE_DB_PASSWORD is not set}"
: "${RESEARCHER_DB_PASSWORD:?RESEARCHER_DB_PASSWORD is not set}"

JWT_DURATION_SECONDS="${POSTGREST_JWT_DURATION_SECONDS:-3600}"
ATMOTUBE_API_KEY="${ATMOTUBE_API_KEY:-}"

psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    -v admin_user="$ADMIN_USERNAME" \
    -v admin_pass="$ADMIN_PASSWORD" \
    -v jwt_secret="$PGRST_JWT_SECRET" \
    -v jwt_duration="$JWT_DURATION_SECONDS" \
    -v postgrest_db_password="$POSTGREST_DB_PASSWORD" \
    -v pipeline_db_password="$PIPELINE_DB_PASSWORD" \
    -v researcher_db_password="$RESEARCHER_DB_PASSWORD" \
    -v api_key="$ATMOTUBE_API_KEY" \
<<'EOSQL'
SET search_path TO auth, data, config, public;

-- Role passwords must match the connection strings used by PostgREST / pipelines.
ALTER ROLE postgrest WITH PASSWORD :'postgrest_db_password';
ALTER ROLE pipeline  WITH PASSWORD :'pipeline_db_password';
ALTER ROLE researcher WITH PASSWORD :'researcher_db_password';

-- JWT config used by api.login() to sign tokens.
INSERT INTO config.app_settings (setting_value, setting_name) VALUES
    (:'jwt_secret',   'POSTGREST_JWT_SECRET'),
    (:'jwt_duration', 'POSTGREST_JWT_DURATION_SECONDS')
ON CONFLICT (setting_name) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- Initial admin user. The encrypt_pass trigger hashes the password automatically.
INSERT INTO auth.users (username, password, role)
VALUES (:'admin_user', :'admin_pass', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Inject the Atmotube API key used by the pipeline.
UPDATE auth.credentials
SET properties = jsonb_build_object('api_key', :'api_key')
WHERE id = 1;
EOSQL
