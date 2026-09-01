# AGENTS.md

## Architecture
- Monorepo: root (docker-compose), `src/admin-dashboard` (SvelteKit frontend), `src/db` (TimescaleDB migrations)
- API: PostgREST (localhost:3000) with JWT auth, schemas `auth`/`api`/`data`/`log`/`config`
- Database: TimescaleDB with PostGIS, Row Level Security (RLS) enforced
- Roles: `webuser` (own data), `researcher` (read data), `admin` (manage), `integration` (write), `anon` (login)

## Development Setup
- Generate a secure `.env`: `bash scripts/generate-env.sh` (or copy `.env.example` and fill it in)
- Run `docker compose up --build` to start db, API, Swagger docs (localhost:8080), admin dashboard, and pipelines
- Admin dashboard dev server: `cd src/admin-dashboard && npm install && npm run dev`

## Design System

### OmniHub Theme (daisyUI custom - light/dark)
Two themes are defined: `omnihub` (light) and `omnihub-dark` (dark). The app respects system preference and can be toggled.

**Light Theme Colors:**
- `base-100`: #f8f8fc (light gray background)
- `base-200`: #eeeef3 (elevated surfaces)
- `base-300`: #e0e0e8 (inputs, borders)
- `primary`: #00c8e6 (cyan - main actions)
- `accent`: #00c48c (emerald - success, studies)
- `warning`: #ffb020 (amber - devices)
- `error`: #ff4d6a (rose - errors)

**Dark Theme Colors:**
- `base-100`: #0a0d12 (obsidian background)
- `base-200`: #12171e (elevated surfaces)
- `base-300`: #1a2230 (inputs, borders)
- `primary`: #00d4ff (cyan glow - primary actions)
- `accent`: #00c48c (emerald - success/studies)
- `warning`: #ffb020 (amber - devices)
- `error`: #ff4d6a (rose - errors)

**Typography:**
- Display: **Sora** (Google Font)
- Mono: **JetBrains Mono** (Google Font)

**Border Radius:**
- Box: 0.75rem (cards, modals)
- Field: 0.5rem (inputs, buttons)
- Selector: 0.5rem (badges, checkboxes)

### Agent Instructions

**CRITICAL: Always follow these rules when working on the frontend:**

1. **ALWAYS load daisyUI documentation** using `context7` before editing/creating components:
   ```
   Use context7_resolve-library-id for "daisyUI" library
   Then use context7_query-docs with queries like:
   - "navbar component daisyUI 5"
   - "modal dialog daisyUI 5"
   - "table styling daisyUI 5"
   ```

2. **ALWAYS load the daisyUI skill** at `.agents/skills/daisyui/SKILL.md` for:
   - Complete component class names
   - daisyUI color semantics (primary, secondary, accent, etc.)
   - Best practices for using daisyUI with Tailwind CSS 4

3. **ONLY use daisyUI classes + Tailwind utilities:**
   - Use daisyUI component classes: `btn`, `card`, `input`, `select`, `table`, `navbar`, `dropdown`, `modal`, `alert`, `badge`, `drawer`, etc.
   - Use daisyUI color classes: `bg-primary`, `text-primary`, `btn-primary`, `alert-success`, etc.
   - Use Tailwind for spacing, layout, and responsive utilities
   - **NEVER write custom CSS variables outside the theme definition**

4. **Theme application:**
   - Theme is defined in `app.css` using `@plugin "daisyui/theme"`
   - Themes: `omnihub` (light) and `omnihub-dark` (dark)
   - Theme switching is handled in `+layout.svelte` via `data-theme` attribute on `<html>`
   - System preference is respected by default; user can override via dropdown
   - Use `document.documentElement.setAttribute('data-theme', 'omnihub' | 'omnihub-dark')` to change theme

5. **Custom CSS is only for:**
   - Animations (keyframes)
   - Google Fonts import
   - Scrollbar styling
   - Anything not achievable with daisyUI + Tailwind

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
- Populate db with sample data: run `src/db/dev/populate.sql` after migrations

## Testing
- OmniHub has an extensive E2E test suite (Playwright) covering all major features: auth,
  navigation, participants, studies, and devices. See `tests/README_TESTS.md` for an overview
  and instructions on running specific test subsets.
- Run all E2E tests (containerized): `podman compose -f docker-compose.yml -f docker-compose.test.yml up -d --wait && cd tests/e2e && npm ci && npm test`
- Run a single test file: `npx playwright test specs/devices.spec.ts`
- Run tests matching a pattern: `npx playwright test -g "DEV-01"`
- Run only devices tests headed (debugging): `npx playwright test specs/devices.spec.ts --headed`
- Barebones mode (no containers): seed DB via `psql -f tests/e2e/seed.sql`, start `npm run dev` in admin-dashboard, then `npx playwright test`