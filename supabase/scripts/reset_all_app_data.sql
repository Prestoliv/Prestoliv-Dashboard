-- =============================================================================
-- RESET ALL APP DATA (destructive) — single statement for Supabase SQL Editor
-- =============================================================================
-- Deletes: projects, milestones, updates, media, queries, chat, templates,
--          activity logs, contact form submissions, and all PM/customer auth users.
--
-- Storage: not cleared here. After this runs:  cd web && npm run reset:storage
--
-- KEEPS: admin role in profiles/users + hello@prestoliv.com in auth.users
--        Does NOT delete public.app_settings.
--
-- Paste the entire file and Run once (must be one DO block — do not split).
-- =============================================================================

do $reset$
declare
  t text;
  tables text[] := array[
    'project_chat_messages',
    'project_chat_tokens',
    'query_replies',
    'queries',
    'media',
    'updates',
    'milestones',
    'projects',
    'activity_logs',
    'contact_us',
    'milestone_template_items',
    'milestone_templates'
  ];
  preview_tables text[] := array['projects', 'queries', 'contact_us', 'activity_logs'];
  admin_keep uuid[];
  c bigint;
begin
  -- ── Admin IDs to preserve ───────────────────────────────────────────────────
  admin_keep := array[]::uuid[];

  select coalesce(array_agg(a.id), array[]::uuid[])
  into admin_keep
  from auth.users a
  where lower(a.email) = lower('hello@prestoliv.com');

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    select coalesce(array_agg(distinct uid), array[]::uuid[])
    into admin_keep
    from (
      select unnest(coalesce(admin_keep, array[]::uuid[])) as uid
      union
      select p.id
      from public.profiles p
      where lower(coalesce(p.role::text, '')) = 'admin'
    ) merged;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    select coalesce(array_agg(distinct uid), array[]::uuid[])
    into admin_keep
    from (
      select unnest(coalesce(admin_keep, array[]::uuid[])) as uid
      union
      select u.id
      from public.users u
      where lower(coalesce(u.role::text, '')) = 'admin'
    ) merged;
  end if;

  if coalesce(array_length(admin_keep, 1), 0) = 0 then
    raise exception
      'No admin account found to keep. Ensure hello@prestoliv.com exists (or an admin profile) before resetting.';
  end if;

  raise notice 'Keeping % admin user id(s)', coalesce(array_length(admin_keep, 1), 0);

  -- ── Delete public app tables (skip if missing) ───────────────────────────────
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('delete from public.%I', t);
      raise notice 'Deleted all rows from public.%', t;
    else
      raise notice 'Skipped (missing): public.%', t;
    end if;
  end loop;

  raise notice 'Storage: skipped in SQL — run: cd web && npm run reset:storage';

  -- ── Remove non-admin profiles / users ───────────────────────────────────────
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    delete from public.profiles p
    where not (p.id = any(admin_keep));
    raise notice 'Removed non-admin rows from public.profiles';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    delete from public.users u
    where not (u.id = any(admin_keep));
    raise notice 'Removed non-admin rows from public.users';
  end if;

  -- ── Remove non-admin auth accounts ──────────────────────────────────────────
  delete from auth.users a
  where not (a.id = any(admin_keep));
  raise notice 'Removed non-admin auth.users';

  -- ── Preview remaining counts ────────────────────────────────────────────────
  raise notice '--- Remaining row counts ---';
  foreach t in array preview_tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('select count(*) from public.%I', t) into c;
      raise notice '%: %', t, c;
    end if;
  end loop;

  select count(*) into c from auth.users;
  raise notice 'auth.users: %', c;
  raise notice 'Done. Clear storage with: cd web && npm run reset:storage';
end $reset$;
