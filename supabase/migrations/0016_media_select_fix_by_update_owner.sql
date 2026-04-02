-- Media SELECT RLS fix:
-- Your earlier policies can fail when `projects.pm_id` is NULL/out-of-sync.
-- We authorize visibility based on either:
-- 1) project membership (customer_id / pm_id), OR
-- 2) media belongs to an update created by the current user,
-- 3) user role is admin (public.users.role).

drop policy if exists "customers select media" on public.media;
drop policy if exists "pm select media" on public.media;
drop policy if exists "admins select media" on public.media;

create policy "media select (project member or update owner or admin)"
on public.media for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = media.project_id
      and (
        p.customer_id = auth.uid()
        or p.pm_id = auth.uid()
      )
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
  or exists (
    select 1
    from public.updates up
    where up.id = media.update_id
      and up.created_by = auth.uid()
  )
);

