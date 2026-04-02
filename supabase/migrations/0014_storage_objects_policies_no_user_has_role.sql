-- Fix Supabase Storage RLS for uploads/reads without relying on `public.user_has_role()`.
-- MediaUpload first uploads a file to storage.objects (bucket `project-media`),
-- then inserts a row into public.media. Both need to be authorized by RLS.

alter table storage.objects enable row level security;

-- Remove existing policies that rely on public.user_has_role()
drop policy if exists "storage media read for customers" on storage.objects;
drop policy if exists "storage media read for pm" on storage.objects;
drop policy if exists "storage media read for admin" on storage.objects;

drop policy if exists "storage media insert for pm" on storage.objects;
drop policy if exists "storage media insert for admin" on storage.objects;

drop policy if exists "storage media delete for admin" on storage.objects;

-- Project-level reads
create policy "storage media read for customers"
on storage.objects for select
using (
  bucket_id = 'project-media'
  and exists (
    select 1
    from public.projects p
    where p.id =
      (case
        when split_part(name,'/',2) ~ '^[0-9a-fA-F-]{36}$'
        then split_part(name,'/',2)::uuid
        else null
      end)
      and p.customer_id = auth.uid()
  )
);

create policy "storage media read for pm"
on storage.objects for select
using (
  bucket_id = 'project-media'
  and exists (
    select 1
    from public.projects p
    where p.id =
      (case
        when split_part(name,'/',2) ~ '^[0-9a-fA-F-]{36}$'
        then split_part(name,'/',2)::uuid
        else null
      end)
      and p.pm_id = auth.uid()
  )
);

-- Admin reads: user role in public.users (not via user_has_role function)
create policy "storage media read for admin"
on storage.objects for select
using (
  bucket_id = 'project-media'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

-- Uploads: allow only if the user created the corresponding updates row.
-- MediaUpload stores objects at:
--   projects/<project_id>/updates/<update_id>/<filename>
create policy "storage media insert for own update"
on storage.objects for insert
with check (
  bucket_id = 'project-media'
  and exists (
    select 1
    from public.updates u
    where u.id =
      (case
        when split_part(name,'/',4) ~ '^[0-9a-fA-F-]{36}$'
        then split_part(name,'/',4)::uuid
        else null
      end)
      and u.created_by = auth.uid()
  )
);

create policy "storage media delete for admin"
on storage.objects for delete
using (
  bucket_id = 'project-media'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

