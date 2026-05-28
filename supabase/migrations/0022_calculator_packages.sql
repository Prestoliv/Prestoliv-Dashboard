-- Package-based construction calculator (replaces material breakdown model).

create table if not exists public.calculator_packages (
  id text primary key,
  label text not null,
  description text not null default '',
  price_per_sqft numeric not null check (price_per_sqft >= 0),
  badge text,
  highlight boolean not null default false,
  color text not null default 'bg-brand',
  sort_order int not null default 0,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists calculator_packages_sort_idx
  on public.calculator_packages (sort_order asc, id asc);

alter table public.calculator_packages enable row level security;

drop policy if exists "public read enabled calculator packages" on public.calculator_packages;
create policy "public read enabled calculator packages"
on public.calculator_packages
for select
to anon, authenticated
using (enabled = true);

drop policy if exists "admins read all calculator packages" on public.calculator_packages;
create policy "admins read all calculator packages"
on public.calculator_packages
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins insert calculator packages" on public.calculator_packages;
create policy "admins insert calculator packages"
on public.calculator_packages
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admins update calculator packages" on public.calculator_packages;
create policy "admins update calculator packages"
on public.calculator_packages
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins delete calculator packages" on public.calculator_packages;
create policy "admins delete calculator packages"
on public.calculator_packages
for delete
to authenticated
using (public.is_admin());

grant select on table public.calculator_packages to anon;
grant select on table public.calculator_packages to authenticated;
grant insert, update, delete on table public.calculator_packages to authenticated;

insert into public.calculator_packages (id, label, description, price_per_sqft, badge, highlight, color, sort_order)
values
  (
    'basic',
    'Basic',
    'Budget-friendly construction with standard materials and finishes.',
    1900,
    null,
    false,
    'bg-slate-500',
    1
  ),
  (
    'classic',
    'Classic',
    'Balanced quality and value — our most popular choice for homes.',
    2100,
    'Most popular',
    true,
    'bg-brand',
    2
  ),
  (
    'premium',
    'Premium',
    'Higher-grade materials and enhanced durability throughout.',
    2350,
    null,
    false,
    'bg-amber-500',
    3
  ),
  (
    'royal',
    'Royal',
    'Luxury finishes and premium specifications for a superior home.',
    2585,
    null,
    false,
    'bg-violet-500',
    4
  )
on conflict (id) do nothing;

-- Extend calculator_settings with copy + package display options
update public.app_settings
set value = coalesce(value, '{}'::jsonb) || jsonb_build_object(
  'show_estimate_range', false,
  'hero_eyebrow', 'Construction Cost Calculator',
  'hero_title', 'Estimate your home construction cost',
  'hero_subtitle', 'Enter your built-up area and compare package rates — get an instant total with no hidden breakdowns.',
  'area_section_title', 'Built-up area',
  'area_section_help', 'Super built-up area of your home in square feet or square metres.',
  'packages_section_title', 'Choose a package',
  'packages_section_subtitle', 'All-inclusive construction rate per square foot. Total updates as you change area.',
  'per_sqft_label', 'per sq ft',
  'estimated_total_label', 'Estimated construction cost',
  'cta_eyebrow', 'Ready to build?',
  'cta_title', 'Get a fixed-price quote for your home',
  'cta_subtitle', 'Our team will assess your site and share a transparent, detailed proposal.',
  'cta_button', 'Book a Free Consultation'
),
updated_at = now()
where key = 'calculator_settings';
