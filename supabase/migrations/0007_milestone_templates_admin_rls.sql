-- Milestone templates: align admin checks with profiles + is_admin() (not user_has_role on public.users).

alter table if exists public.milestone_templates enable row level security;
alter table if exists public.milestone_template_items enable row level security;

drop policy if exists "admins select templates" on public.milestone_templates;
drop policy if exists "admins manage templates" on public.milestone_templates;

create policy "admins select templates"
on public.milestone_templates
for select
using (public.is_admin());

create policy "admins insert templates"
on public.milestone_templates
for insert
with check (public.is_admin());

create policy "admins update templates"
on public.milestone_templates
for update
using (public.is_admin())
with check (public.is_admin());

create policy "admins delete templates"
on public.milestone_templates
for delete
using (public.is_admin());

drop policy if exists "admins manage template items" on public.milestone_template_items;

create policy "admins select template items"
on public.milestone_template_items
for select
using (public.is_admin());

create policy "admins insert template items"
on public.milestone_template_items
for insert
with check (public.is_admin());

create policy "admins update template items"
on public.milestone_template_items
for update
using (public.is_admin())
with check (public.is_admin());

create policy "admins delete template items"
on public.milestone_template_items
for delete
using (public.is_admin());
