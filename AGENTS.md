# AGENTS.md

## Cursor Cloud specific instructions

Leave Tracker is a pnpm-workspace monorepo. The two services that make up the product are:

| Service | Path | Dev command | Port |
|---------|------|-------------|------|
| API (Express 5) | `artifacts/api-server/` | `pnpm run dev:api` | 8080 |
| Frontend (React 19 + Vite 7) | `artifacts/leave-tracker/` | `pnpm run dev:web` | 5173 |

`pnpm run dev` runs both together. The Vite dev server proxies `/api` to the API server. Standard commands (test, typecheck, build, DB push, codegen) are documented in `replit.md`.

### Startup caveats (things the update script does NOT do)

- **PostgreSQL is not auto-started.** Start the pre-provisioned cluster each session with `sudo pg_ctlcluster 16 main start`. A role `leave` (password `leave`) and database `leave_manager` already exist, and the Drizzle schema has already been pushed. If the DB is ever missing, recreate it with `sudo -u postgres createdb -O leave leave_manager` then `cd lib/db && DATABASE_URL=postgresql://leave:leave@localhost:5432/leave_manager pnpm run push`.
- **Node 24 is required** and is the nvm default (login shells pick it up automatically); pnpm is provided via corepack. The base image's `/exec-daemon/node` is v22 — always run dev/build/test through a login shell (the tmux sessions and `bash -l` do this) so Node 24 is active.
- **Env files are git-ignored** and live at `artifacts/api-server/.env` and `artifacts/leave-tracker/.env`. They persist in the VM snapshot. If missing, copy from `.env.example`. Minimum working `DATABASE_URL` is `postgresql://leave:leave@localhost:5432/leave_manager`.

### Clerk auth is mandatory to run either service

Authentication uses [Clerk](https://clerk.com), a hosted service — there is no local/offline mode. `clerkMiddleware` is applied globally in `artifacts/api-server/src/app.ts`, so **every** API request (including `/api/healthz`) returns 500 "Publishable key not valid" without a real key. The frontend throws "Failed to load Clerk JS" without a valid `VITE_CLERK_PUBLISHABLE_KEY`. Real keys must be supplied via secrets:

- `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` → `artifacts/api-server/.env`
- `VITE_CLERK_PUBLISHABLE_KEY` (same value as `CLERK_PUBLISHABLE_KEY`) → `artifacts/leave-tracker/.env`

Add `http://localhost:5173` to the Clerk instance's allowed origins. The first user to sign in is auto-provisioned as an admin. Email (Resend) only works on Replit; in-app notifications work locally.
