# Supabase scripts

## Full reset (database + storage)

### Step 1 — `reset_all_app_data.sql` (database)

Wipes application data in one transaction:

| Removed | Kept |
|--------|------|
| All projects, milestones, updates, media | Admin user(s) |
| All queries and query replies | `admin@prestoliv.com` (bootstrap) |
| Project chat tokens/messages (if migrated) | `public.app_settings` (e.g. PM chat toggle) |
| Activity logs | |
| Contact form (`contact_us`) submissions | |
| Milestone templates | |
| All PM and customer `auth.users` | |

**Storage is not cleared in SQL** — Supabase blocks `DELETE` on `storage.objects`. Use step 2.

#### Run

1. Supabase Dashboard → **SQL Editor**
2. Paste `reset_all_app_data.sql` → **Run**
3. Check **Messages** — counts should be `0` for projects/queries; `auth.users` should be `1`

Skips tables that do not exist in your project. The file is **one `DO` block** — paste and run the entire file in one go (do not run parts separately).

### Step 2 — empty storage bucket (optional but recommended)

From the `web` folder (needs `SUPABASE_SERVICE_ROLE_KEY` in `web/.env.local`):

```bash
cd web && npm run reset:storage
```

This removes all files in the `project-media` bucket via the Storage API.

Alternatively: Dashboard → **Storage** → `project-media` → select all → delete.

### Step 3 — seed demo users & project (optional)

```bash
cd web && npm run seed:demo
```

Creates:

| Account | Role |
|---------|------|
| `vivek@dzynd.co` | customer |
| `sharun@prestoliv.com` | PM |

Plus an **active** project assigned to both, with 2 images and 1 video on the update feed.

Default password: `PrestolivDemo2026!` (override with `SEED_DEFAULT_PASSWORD` in `.env.local`).

---

### Notes

- Must run SQL as **postgres** (SQL Editor default).
- **Irreversible** unless you have a backup.
- To keep contact form leads, remove `contact_us` from the `tables` array in the SQL script.
- To keep milestone templates, remove `milestone_template_items` and `milestone_templates` from that array.
