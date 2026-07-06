# AGENTS.md

## Cursor Cloud specific instructions

This is a pnpm workspace monorepo. The primary product is **Leave Tracker** (an
Express API + React/Vite SPA backed by PostgreSQL and Clerk auth). Standard
commands live in [`README.md`](README.md); the notes below only cover
non-obvious, environment-specific caveats.

### Services & ports
- API server (`@workspace/api-server`, Express) → `http://localhost:8080`, routes under `/api/*`.
- Frontend SPA (`@workspace/leave-tracker`, Vite) → `http://localhost:5173`, proxies `/api` to the API.
- Both start together with `pnpm run dev` (or `pnpm run dev:api` / `pnpm run dev:web`).
- `@workspace/mockup-sandbox` is an optional standalone UI-prototyping tool, unrelated to Leave Tracker.

### PostgreSQL (must be started manually)
- Postgres is installed but is **not auto-started** on boot. Start it before running the API or pushing schema:
  `sudo pg_ctlcluster 16 main start`
- Local dev DB: role `leave` / password `leave`, database `leave_manager`.
  Connection string: `postgresql://leave:leave@localhost:5432/leave_manager`.
- If the role/DB are missing (fresh VM), recreate with:
  `sudo -u postgres psql -c "CREATE ROLE leave WITH LOGIN PASSWORD 'leave' CREATEDB;"`
  `sudo -u postgres psql -c "CREATE DATABASE leave_manager OWNER leave;"`
- Push the Drizzle schema before first run (idempotent):
  `DATABASE_URL=postgresql://leave:leave@localhost:5432/leave_manager pnpm --filter @workspace/db run push`

### Env files (gitignored — recreate if absent)
- The apps read per-package `.env` files via dotenv: `artifacts/api-server/.env` and `artifacts/leave-tracker/.env` (see [`.env.example`](.env.example)).
- Clerk keys are provided as injected secrets (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`); the `.env` files reference/duplicate those plus `DATABASE_URL`, `PORT`, and `BASE_PATH`.
- The frontend Vite config throws if `PORT` or `BASE_PATH` is missing; the API/DB layer throws if `DATABASE_URL` is missing.

### Auth / testing gotcha (Clerk)
- Clerk runs as a **development instance**. To sign in without a real inbox, use a Clerk **test email**: any address containing the `+clerk_test` subaddress (e.g. `leave.admin+clerk_test@example.com`) accepts the fixed verification code **`424242`** (no real email is sent).
- The **first** user to sign in is automatically provisioned as **admin**.

### Build caveat
- `pnpm run build` builds the whole workspace, which includes `mockup-sandbox`. That package's Vite config reads `PORT`/`BASE_PATH` from `process.env` directly (it does **not** load a `.env`), so a bare `pnpm run build` fails on it. Build with these set inline:
  `PORT=8081 BASE_PATH=/ pnpm run build`
  (Leave Tracker itself builds fine on its own because it loads dotenv.)

### Node version
- README says Node 24+, but the codebase builds, typechecks, tests, and runs fine on the VM's Node v22 (no `engines`/`.nvmrc` pin). No need to switch Node.
