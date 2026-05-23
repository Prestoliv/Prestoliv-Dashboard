-- Seen status, admin update/delete, and realtime for new submissions.

alter table public.contact_us
  add column if not exists seen_at timestamptz;

create index if not exists contact_us_unseen_idx
  on public.contact_us (created_at desc)
  where seen_at is null;

alter table public.contact_us replica identity full;

drop policy if exists "admins can update contact submissions" on public.contact_us;
create policy "admins can update contact submissions"
on public.contact_us
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can delete contact submissions" on public.contact_us;
create policy "admins can delete contact submissions"
on public.contact_us
for delete
to authenticated
using (public.is_admin());

grant update, delete on table public.contact_us to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'contact_us'
  ) then
    alter publication supabase_realtime add table public.contact_us;
  end if;
end $$;
