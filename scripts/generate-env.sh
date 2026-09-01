#!/bin/bash
set -euo pipefail

# Generate a secure .env file for an OmniHub test deploy.
# Run this from the repository root.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

# Restrict permissions on the generated file.
umask 077

# URL-safe random string generator (alphanumeric, no special chars).
generate_password() {
    local length="${1:-32}"
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$length"
}

generate_hex() {
    local length="${1:-64}"
    tr -dc 'a-f0-9' </dev/urandom | head -c "$length"
}

POSTGRES_PASSWORD="$(generate_password 32)"
POSTGREST_DB_PASSWORD="$(generate_password 32)"
PIPELINE_DB_PASSWORD="$(generate_password 32)"
AUTH_DB_PASSWORD="$(generate_password 32)"
RESEARCHER_DB_PASSWORD="$(generate_password 32)"
PGRST_JWT_SECRET="$(generate_hex 64)"
ADMIN_PASSWORD="$(generate_password 24)"

cat > "$ENV_FILE" <<EOF
# Database role passwords (auto-generated)
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGREST_DB_PASSWORD=$POSTGREST_DB_PASSWORD
PIPELINE_DB_PASSWORD=$PIPELINE_DB_PASSWORD
AUTH_DB_PASSWORD=$AUTH_DB_PASSWORD
RESEARCHER_DB_PASSWORD=$RESEARCHER_DB_PASSWORD

# Ports
DB_PORT=5432
PGRST_PORT=3000

# Publicly reachable PostgREST URL (update this for your remote server)
POSTGREST_URL=http://localhost:3000

# Connection strings used by PostgREST and the pipeline
PGRST_DB_URI=postgres://postgrest:${POSTGREST_DB_PASSWORD}@db:5432/postgres
PIPELINE_CONNECTION_STRING=postgres://pipeline:${PIPELINE_DB_PASSWORD}@db:5432/postgres

# JWT configuration used by PostgREST and api.login()
PGRST_JWT_SECRET=$PGRST_JWT_SECRET
POSTGREST_JWT_DURATION_SECONDS=3600

# Initial admin user created on first DB initialisation
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Atmotube API key (required for the pipeline)
ATMOTUBE_API_KEY=
EOF

chmod 600 "$ENV_FILE"
echo "Generated $ENV_FILE"
echo "IMPORTANT: update POSTGREST_URL and ATMOTUBE_API_KEY before deploying."
