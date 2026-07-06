# Leave Tracker

A leave management app for small teams — request and track time off, view calendars and balances, and administer approvals, users, and policy settings.

## Run & Operate

### Local development

1. Install dependencies: `pnpm install` (approve build scripts if prompted: `pnpm approve-builds --all`)
2. Copy [`.env.example`](.env.example) and fill in Clerk keys from [dashboard.clerk.com](https://dashboard.clerk.com)
3. Create a Postgres database and set `DATABASE_URL` in `artifacts/api-server/.env`
4. Push schema: `cd lib/db && DATABASE_URL=... ./node_modules/.bin/drizzle-kit push --config ./drizzle.config.ts`
5. Start both services: `pnpm run dev` (API on port 8080, frontend on port 5173)

Or run separately:

- `pnpm run dev:api` — API server (port 8080)
- `pnpm run dev:web` — frontend (port 5173)

The Vite dev server proxies `/api` to the API server. First sign-in creates an admin user if none exists.

### Other commands

- `pnpm --filter @workspace/api-server run test` — API unit tests (vitest)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24+, TypeScript 5.9
- Frontend: React 19, Vite 7, Tailwind 4, Clerk auth
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (API), Vite (frontend)

## Where things live

| Path | Purpose |
|------|---------|
| `artifacts/leave-tracker/` | React SPA |
| `artifacts/api-server/` | Express REST API (`/api/*`) |
| `lib/db/src/schema/` | Drizzle DB schema (source of truth) |
| `lib/api-spec/openapi.yaml` | OpenAPI contract |
| `lib/api-client-react/` | Generated React Query hooks |

## Gotchas

- **macOS:** `pnpm-workspace.yaml` keeps darwin native binaries for local dev; Replit deployments use linux-x64 only.
- **pnpm filter + preinstall:** If `pnpm --filter` fails with "Use pnpm instead", run commands from the package directory or use the root `pnpm run dev` scripts.
- **Clerk:** Add `http://localhost:5173` to allowed origins in your Clerk dashboard.
- **Email:** Resend integration only works on Replit; in-app notifications work locally.
