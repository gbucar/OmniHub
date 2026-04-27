#!/bin/bash
set -e
echo "Setting passwords..."

psql -v ON_ERROR_STOP=1 --username postgres <<-EOSQL
    ALTER ROLE postgrest WITH PASSWORD '${POSTGREST_DB_PASSWORD}';
    ALTER ROLE pipeline WITH PASSWORD '${PIPELINE_DB_PASSWORD}';
EOSQL
