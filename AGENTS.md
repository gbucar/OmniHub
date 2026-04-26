# AGENTS.md

## Architecture
- Monorepo: root (docker-compose), `src/admin-dashboard` (SvelteKit frontend), `src/db` (TimescaleDB migrations)
- API: PostgREST (localhost:3000) with JWT auth, schemas `auth`/`api`/`data`/`log`/`config`
- Database: TimescaleDB with PostGIS, Row Level Security (RLS) enforced
- Roles: `webuser` (own data), `researcher` (read data), `admin` (manage), `integration` (write), `anon` (login)

## Development Setup
- Copy `.env.example` to `.env` for database passwords
- Run `docker-compose up` to start db, API, and Swagger docs (localhost:8080)
- Admin dashboard: `cd src/admin-dashboard && npm install && npm run dev`
- Use only daisyUI and TailwindCSS for styling
- Always use context7 to load daisyUI documentation
- Always load Svelte documentation before fixing/creating Svelte components

## API Usage
- Login: POST to `/api/rpc/login` with username/password, returns JWT
- Use JWT in Authorization header for authenticated requests
- Views: `api.sensors`, `api.observations`, `api.list_participants`, etc.
- Functions: `api.add_participant`, `api.change_password`

## Data Model
- Participants linked to users (`auth.users`) and studies (`data.many_participants_studies`)
- Sensors owned by participants (`data.ownerships`), measure datastreams (`data.data_stream`)
- Observations (`data.observations`) with timestamps, locations (`data.locations`), results

## Commands
- Typecheck admin dashboard: `npm run check`
- Lint admin dashboard: `npm run lint`
- Format admin dashboard: `npm run format`
- Build admin dashboard: `npm run build`
- Populate db with sample data: run `src/db/populate.sql` after migrations</content>
<parameter name="filePath">/app/omnihub/AGENTS.md