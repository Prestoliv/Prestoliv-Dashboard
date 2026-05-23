-- Public consultation form submissions from the marketing site.

create table if not exists public.contact_us (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  city text not null,
  service text not null,
  other_service text,
  created_at timestamptz not null default now()
);

create index if not exists contact_us_created_at_idx
  on public.contact_us (created_at desc);

alter table public.contact_us enable row level security;

drop policy if exists "anyone can submit contact form" on public.contact_us;
create policy "anyone can submit contact form"
on public.contact_us
for insert
to anon, authenticated
with check (true);

drop policy if exists "admins can read contact submissions" on public.contact_us;
create policy "admins can read contact submissions"
on public.contact_us
for select
to authenticated
using (public.is_admin());

grant insert on table public.contact_us to anon;
grant insert on table public.contact_us to authenticated;
grant select on table public.contact_us to authenticated;
