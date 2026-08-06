#!/bin/bash
set -e

if [ -n "$ATMOTUBE_API_KEY" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        UPDATE auth.credentials 
        SET properties = jsonb_set(properties, '{api_key}', '"$ATMOTUBE_API_KEY"')
        WHERE description = 'API_KEY';
EOSQL
    echo "Atmotube API key updated in auth.credentials"
else
    echo "WARNING: ATMOTUBE_API_KEY environment variable not set — credential remains empty"
fi
