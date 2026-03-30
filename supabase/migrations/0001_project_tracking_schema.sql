-- Project Tracking & Client Communication System
-- Run with Supabase migrations (supabase/migrations folder).

-- Extensions
create extension if not exists pgcrypto;

-- Role helpers
create or replace function public.user_has_role(target_role text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = target_role
  );
$$;

-- users (profiles/roles)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'customer' check (role in ('admin','pm','customer')),
  created_at timestamptz not null default now()
);

-- projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_id uuid not null references public.users(id) on delete restrict,
  pm_id uuid references public.users(id) on delete restrict,
  status text not null default 'active' check (status in ('active','completed','on_hold','cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists projects_customer_id_idx on public.projects(customer_id);
create index if not exists projects_pm_id_idx on public.projects(pm_id);

-- milestones
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  percentage integer not null default 0 check (percentage >= 0 and percentage <= 100),
  created_at timestamptz not null default now()
);

create index if not exists milestones_project_id_idx on public.milestones(project_id);

-- updates
create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete restrict,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists updates_project_id_idx on public.updates(project_id);
create index if not exists updates_created_by_idx on public.updates(created_by);

-- media
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  update_id uuid not null references public.updates(id) on delete cascade,
  url text not null,
  type text not null check (type in ('image','video')),
  created_at timestamptz not null default now()
);

create index if not exists media_project_id_idx on public.media(project_id);
create index if not exists media_update_id_idx on public.media(update_id);

-- queries (tickets)
create table if not exists public.queries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete restrict,
  message text not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create index if not exists queries_project_id_idx on public.queries(project_id);
create index if not exists queries_created_by_idx on public.queries(created_by);

-- query_replies (chat thread)
create table if not exists public.query_replies (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.queries(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete restrict,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists query_replies_query_id_idx on public.query_replies(query_id);
create index if not exists query_replies_sender_id_idx on public.query_replies(sender_id);

-- activity_logs
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_user_id_idx on public.activity_logs(user_id);

-- Optional: milestone templates (used by the Admin UI)
create table if not exists public.milestone_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.milestone_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.milestone_templates(id) on delete cascade,
  title text not null,
  percentage integer not null default 0 check (percentage >= 0 and percentage <= 100),
  created_at timestamptz not null default now()
);

create index if not exists milestone_template_items_template_id_idx on public.milestone_template_items(template_id);

-- Storage bucket (project media)
insert into storage.buckets (id, name, public)
values ('project-media','project-media', false)
on conflict (id) do update set public = false;

-- Seed: create a public "admin" row on first run is not possible without a user.
-- Role is set on auth.users insert via trigger below.

-- Create user profile row on auth signup
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    case
      -- Hardcoded bootstrap admin account.
      -- If the user signs up with this email, we ensure their role is set to `admin`.
      when lower(new.email) = lower('admin@prestoliv.com') then 'admin'
      else coalesce(new.raw_user_meta_data->>'role', 'customer')
    end
  )
  on conflict (id) do update
  set
    name = excluded.name,
    role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Ensure the bootstrap admin user is marked as `admin` even if it already exists.
-- This is safe (non-destructive) and idempotent.
update public.users u
set role = 'admin'
from auth.users a
where a.id = u.id
  and lower(a.email) = lower('admin@prestoliv.com')
  and u.role is distinct from 'admin';

-- RLS enabled
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.updates enable row level security;
alter table public.media enable row level security;
alter table public.queries enable row level security;
alter table public.query_replies enable row level security;
alter table public.activity_logs enable row level security;
alter table public.milestone_templates enable row level security;
alter table public.milestone_template_items enable row level security;

-- USERS policies
drop policy if exists "users can select own profile" on public.users;
create policy "users can select own profile"
on public.users for select
using (id = auth.uid());

drop policy if exists "admins can select all profiles" on public.users;
create policy "admins can select all profiles"
on public.users for select
using (public.user_has_role('admin'));

drop policy if exists "admins can update roles" on public.users;
create policy "admins can update roles"
on public.users for update
using (public.user_has_role('admin'))
with check (public.user_has_role('admin'));

-- PROJECTS policies
drop policy if exists "customers select own projects" on public.projects;
create policy "customers select own projects"
on public.projects for select
using (
  customer_id = auth.uid()
  and public.user_has_role('customer')
);

drop policy if exists "pm select assigned projects" on public.projects;
create policy "pm select assigned projects"
on public.projects for select
using (
  pm_id = auth.uid()
  and public.user_has_role('pm')
);

drop policy if exists "admins select all projects" on public.projects;
create policy "admins select all projects"
on public.projects for select
using (public.user_has_role('admin'));

drop policy if exists "admins manage projects" on public.projects;
create policy "admins manage projects"
on public.projects for all
using (public.user_has_role('admin'))
with check (public.user_has_role('admin'));

-- MILSTONES policies
drop policy if exists "customers select milestones" on public.milestones;
create policy "customers select milestones"
on public.milestones for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.customer_id = auth.uid()
      and public.user_has_role('customer')
  )
);

drop policy if exists "pm select milestones" on public.milestones;
create policy "pm select milestones"
on public.milestones for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.pm_id = auth.uid()
      and public.user_has_role('pm')
  )
);

drop policy if exists "admins select milestones" on public.milestones;
create policy "admins select milestones"
on public.milestones for select
using (public.user_has_role('admin'));

drop policy if exists "pm update milestones" on public.milestones;
create policy "pm update milestones"
on public.milestones for update
using (
  exists (
    select 1 from public.projects p
    where p.id = milestones.project_id
      and p.pm_id = auth.uid()
      and public.user_has_role('pm')
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = milestones.project_id
      and p.pm_id = auth.uid()
      and public.user_has_role('pm')
  )
);

drop policy if exists "admins manage milestones" on public.milestones;
create policy "admins manage milestones"
on public.milestones for all
using (public.user_has_role('admin'))
with check (public.user_has_role('admin'));

-- UPDATES policies
drop policy if exists "customers select updates" on public.updates;
create policy "customers select updates"
on public.updates for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = updates.project_id
      and p.customer_id = auth.uid()
      and public.user_has_role('customer')
  )
);

drop policy if exists "pm select updates" on public.updates;
create policy "pm select updates"
on public.updates for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = updates.project_id
      and p.pm_id = auth.uid()
      and public.user_has_role('pm')
  )
);

drop policy if exists "admins select updates" on public.updates;
create policy "admins select updates"
on public.updates for select
using (public.user_has_role('admin'));

drop policy if exists "pm insert updates" on public.updates;
create policy "pm insert updates"
on public.updates for insert
with check (
  public.user_has_role('pm')
  and exists (
    select 1 from public.projects p
    where p.id = updates.project_id
      and p.pm_id = auth.uid()
  )
);

drop policy if exists "admins insert updates" on public.updates;
create policy "admins insert updates"
on public.updates for insert
with check (public.user_has_role('admin'));

-- MEDIA policies
drop policy if exists "customers select media" on public.media;
create policy "customers select media"
on public.media for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = media.project_id
      and p.customer_id = auth.uid()
      and public.user_has_role('customer')
  )
);

drop policy if exists "pm select media" on public.media;
create policy "pm select media"
on public.media for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = media.project_id
      and p.pm_id = auth.uid()
      and public.user_has_role('pm')
  )
);

drop policy if exists "admins select media" on public.media;
create policy "admins select media"
on public.media for select
using (public.user_has_role('admin'));

drop policy if exists "pm insert media row" on public.media;
create policy "pm insert media row"
on public.media for insert
with check (
  public.user_has_role('pm')
  and exists (
    select 1 from public.projects p
    where p.id = media.project_id
      and p.pm_id = auth.uid()
  )
);

drop policy if exists "admins insert media row" on public.media;
create policy "admins insert media row"
on public.media for insert
with check (public.user_has_role('admin'));

drop policy if exists "admins manage media" on public.media;
create policy "admins manage media"
on public.media for delete
using (public.user_has_role('admin'));

-- QUERIES policies
drop policy if exists "customers select their queries" on public.queries;
create policy "customers select their queries"
on public.queries for select
using (
  exists (
    select 1 from public.projects p
    where p.id = queries.project_id
      and p.customer_id = auth.uid()
      and public.user_has_role('customer')
  )
);

drop policy if exists "pm select assigned queries" on public.queries;
create policy "pm select assigned queries"
on public.queries for select
using (
  exists (
    select 1 from public.projects p
    where p.id = queries.project_id
      and p.pm_id = auth.uid()
      and public.user_has_role('pm')
  )
);

drop policy if exists "admins select all queries" on public.queries;
create policy "admins select all queries"
on public.queries for select
using (public.user_has_role('admin'));

drop policy if exists "customers insert queries" on public.queries;
create policy "customers insert queries"
on public.queries for insert
with check (
  public.user_has_role('customer')
  and exists (
    select 1 from public.projects p
    where p.id = queries.project_id
      and p.customer_id = auth.uid()
  )
);

drop policy if exists "pm insert queries" on public.queries;
create policy "pm insert queries"
on public.queries for insert
with check (
  public.user_has_role('pm')
  and exists (
    select 1 from public.projects p
    where p.id = queries.project_id
      and p.pm_id = auth.uid()
  )
);

drop policy if exists "admins insert queries" on public.queries;
create policy "admins insert queries"
on public.queries for insert
with check (public.user_has_role('admin'));

drop policy if exists "pm close queries" on public.queries;
create policy "pm close queries"
on public.queries for update
using (
  public.user_has_role('pm')
  and exists (
    select 1 from public.projects p
    where p.id = queries.project_id
      and p.pm_id = auth.uid()
  )
)
with check (
  public.user_has_role('pm')
  and exists (
    select 1 from public.projects p
    where p.id = queries.project_id
      and p.pm_id = auth.uid()
  )
);

drop policy if exists "admins update queries" on public.queries;
create policy "admins update queries"
on public.queries for update
using (public.user_has_role('admin'))
with check (public.user_has_role('admin'));

-- QUERY REPLIES policies
drop policy if exists "customers select replies" on public.query_replies;
create policy "customers select replies"
on public.query_replies for select
using (
  exists (
    select 1
    from public.queries q
    join public.projects p on p.id = q.project_id
    where q.id = query_replies.query_id
      and p.customer_id = auth.uid()
      and public.user_has_role('customer')
  )
);

drop policy if exists "pm select replies" on public.query_replies;
create policy "pm select replies"
on public.query_replies for select
using (
  exists (
    select 1
    from public.queries q
    join public.projects p on p.id = q.project_id
    where q.id = query_replies.query_id
      and p.pm_id = auth.uid()
      and public.user_has_role('pm')
  )
);

drop policy if exists "admins select replies" on public.query_replies;
create policy "admins select replies"
on public.query_replies for select
using (public.user_has_role('admin'));

drop policy if exists "customer insert replies" on public.query_replies;
create policy "customer insert replies"
on public.query_replies for insert
with check (
  public.user_has_role('customer')
  and exists (
    select 1
    from public.queries q
    join public.projects p on p.id = q.project_id
    where q.id = query_replies.query_id
      and p.customer_id = auth.uid()
  )
);

drop policy if exists "pm insert replies" on public.query_replies;
create policy "pm insert replies"
on public.query_replies for insert
with check (
  public.user_has_role('pm')
  and exists (
    select 1
    from public.queries q
    join public.projects p on p.id = q.project_id
    where q.id = query_replies.query_id
      and p.pm_id = auth.uid()
  )
);

drop policy if exists "admins insert replies" on public.query_replies;
create policy "admins insert replies"
on public.query_replies for insert
with check (public.user_has_role('admin'));

-- ACTIVITY_LOGS policies
drop policy if exists "admins select activity logs" on public.activity_logs;
create policy "admins select activity logs"
on public.activity_logs for select
using (public.user_has_role('admin'));

drop policy if exists "authenticated can insert activity logs (for self)" on public.activity_logs;
create policy "authenticated can insert activity logs (for self)"
on public.activity_logs for insert
with check (user_id = auth.uid());

-- Milestone templates policies
drop policy if exists "admins select templates" on public.milestone_templates;
create policy "admins select templates"
on public.milestone_templates for select
using (public.user_has_role('admin'));

drop policy if exists "admins manage templates" on public.milestone_templates;
create policy "admins manage templates"
on public.milestone_templates for all
using (public.user_has_role('admin'))
with check (public.user_has_role('admin'));

drop policy if exists "admins manage template items" on public.milestone_template_items;
create policy "admins manage template items"
on public.milestone_template_items for all
using (public.user_has_role('admin'))
with check (public.user_has_role('admin'));

-- Storage.objects policies
alter table storage.objects enable row level security;

-- Read access to media for visible projects
drop policy if exists "storage media read for customers" on storage.objects;
create policy "storage media read for customers"
on storage.objects for select
using (
  bucket_id = 'project-media'
  and public.user_has_role('customer')
  and exists (
    select 1
    from public.projects p
    where p.id = split_part(name,'/',2)::uuid
      and p.customer_id = auth.uid()
  )
);

drop policy if exists "storage media read for pm" on storage.objects;
create policy "storage media read for pm"
on storage.objects for select
using (
  bucket_id = 'project-media'
  and public.user_has_role('pm')
  and exists (
    select 1
    from public.projects p
    where p.id = split_part(name,'/',2)::uuid
      and p.pm_id = auth.uid()
  )
);

drop policy if exists "storage media read for admin" on storage.objects;
create policy "storage media read for admin"
on storage.objects for select
using (
  bucket_id = 'project-media'
  and public.user_has_role('admin')
);

-- Insert access for PM to their project folders
drop policy if exists "storage media insert for pm" on storage.objects;
create policy "storage media insert for pm"
on storage.objects for insert
with check (
  bucket_id = 'project-media'
  and public.user_has_role('pm')
  and exists (
    select 1
    from public.projects p
    where p.id = split_part(name,'/',2)::uuid
      and p.pm_id = auth.uid()
  )
);

-- Insert for admin
drop policy if exists "storage media insert for admin" on storage.objects;
create policy "storage media insert for admin"
on storage.objects for insert
with check (
  bucket_id = 'project-media'
  and public.user_has_role('admin')
);

-- Delete storage objects: admin only (cleanup)
drop policy if exists "storage media delete for admin" on storage.objects;
create policy "storage media delete for admin"
on storage.objects for delete
using (bucket_id = 'project-media' and public.user_has_role('admin'));

