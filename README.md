# Prestoliv Dashboard

Prestoliv is a web dashboard with a Supabase-backed backend (RLS + realtime) for:
- Project tracking (milestones / updates)
- Customer portal messaging (replies, typing, read receipts)
- Media uploads (images/videos) attached to updates

This repo contains:
- `web/`: Next.js app
- `supabase/`: SQL migrations (tables, RLS, realtime helpers/policies)
- `swagger.yaml`: OpenAPI reference for the backend API (as implemented via Supabase + routes used by the app)

## Quick Start (local)

### 1) Configure environment variables

Copy the example env file:

```bash
cp web/.env.example web/.env
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, required by server routes such as `/api/at/bundle`)

### 2) Apply Supabase migrations

Migrations are located in `supabase/migrations/` and should be applied to your Supabase project in order.

If you are using the Supabase CLI, point it at your project and apply the migrations using your normal workflow.
Otherwise, you can run the SQL files in order via the Supabase SQL editor.

### 3) Run the web app

```bash
cd web
npm install
npm run dev
```

Open the app at `http://localhost:3000`.

## Deployment

The repo includes a `render.yaml` for deploying the `web/` service.
It builds with:
- `npm ci && npm run build`
and starts with:
- `npx next start -p $PORT`

## Useful References

- Web app code: `web/src/`
- Supabase migrations: `supabase/migrations/`
- OpenAPI docs: `swagger.yaml`

## Notes

- Media and signed URLs are handled server-side to work with Supabase RLS.
- Chat realtime uses Supabase realtime/broadcast plus polling fallbacks (to avoid missing updates if realtime is temporarily delayed).

