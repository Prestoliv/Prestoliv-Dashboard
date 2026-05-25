-- Construction calculator: admin-managed materials + global settings (marketing site reads via anon).

create table if not exists public.calculator_materials (
  id text primary key,
  label text not null,
  icon_key text not null default 'package',
  factor numeric not null check (factor >= 0),
  unit text not null,
  default_rate numeric not null check (default_rate >= 0),
  rate_label text not null,
  color text not null default 'bg-brand',
  sort_order int not null default 0,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists calculator_materials_sort_idx
  on public.calculator_materials (sort_order asc, id asc);

alter table public.calculator_materials enable row level security;

drop policy if exists "public read enabled calculator materials" on public.calculator_materials;
create policy "public read enabled calculator materials"
on public.calculator_materials
for select
to anon, authenticated
using (enabled = true);

drop policy if exists "admins read all calculator materials" on public.calculator_materials;
create policy "admins read all calculator materials"
on public.calculator_materials
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins insert calculator materials" on public.calculator_materials;
create policy "admins insert calculator materials"
on public.calculator_materials
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admins update calculator materials" on public.calculator_materials;
create policy "admins update calculator materials"
on public.calculator_materials
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins delete calculator materials" on public.calculator_materials;
create policy "admins delete calculator materials"
on public.calculator_materials
for delete
to authenticated
using (public.is_admin());

grant select on table public.calculator_materials to anon;
grant select on table public.calculator_materials to authenticated;
grant insert, update, delete on table public.calculator_materials to authenticated;

-- Seed default materials (matches prestoliv-code hardcoded catalog)
insert into public.calculator_materials (id, label, icon_key, factor, unit, default_rate, rate_label, color, sort_order)
values
  ('bricks', 'Bricks', 'layout-grid', 300, 'nos', 8, 'per brick', 'bg-orange-400', 1),
  ('iron', 'Iron (Sariya)', 'layers', 0.03, 'tonnes', 65000, 'per tonne', 'bg-slate-400', 2),
  ('sand', 'Sand', 'package', 0.16, 'cu.m', 1800, 'per cu.m', 'bg-yellow-400', 3),
  ('concrete', 'Concrete', 'layers', 0.3, 'quintal', 400, 'per quintal', 'bg-stone-400', 4),
  ('cement', 'Cement Bags', 'package', 20, 'bags', 400, 'per bag', 'bg-brand', 5)
on conflict (id) do nothing;

-- Global calculator settings (stored in app_settings; public read via existing policy)
insert into public.app_settings (key, value)
values (
  'calculator_settings',
  jsonb_build_object(
    'enabled', true,
    'default_area', 1000,
    'default_unit', 'sqft',
    'low_variance_pct', 0.1,
    'high_variance_pct', 0.1,
    'sqm_to_sqft_factor', 10.764
  )
)
on conflict (key) do nothing;

-- Allow anonymous read of app_settings (marketing site needs calculator_settings)
drop policy if exists "anon read app settings" on public.app_settings;
create policy "anon read app settings"
on public.app_settings
for select
to anon
using (true);

grant select on table public.app_settings to anon;
