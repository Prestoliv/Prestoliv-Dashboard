-- Fix: media insert RLS should rely on ownership of the update (created_by),
-- not strictly on projects.pm_id, which may be null/out-of-sync for some rows.
-- This allows admins/PMs to attach media only to updates they created.

drop policy if exists "pm insert media row" on public.media;
drop policy if exists "admins insert media row" on public.media;

drop policy if exists "members insert media for their own updates" on public.media;

create policy "members insert media for their own updates"
on public.media for insert
with check (
  exists (
    select 1
    from public.updates u
    where u.id = media.update_id
      and u.created_by = auth.uid()
  )
);

