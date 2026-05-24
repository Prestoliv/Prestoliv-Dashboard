-- Bootstrap admin account: hello@prestoliv.com (replaces admin@prestoliv.com)

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'name', new.email);
  v_role := case
    when lower(new.email) = lower('hello@prestoliv.com') then 'admin'
    else coalesce(new.raw_user_meta_data->>'role', 'customer')
  end;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    insert into public.users (id, name, role)
    values (new.id, v_name, v_role)
    on conflict (id) do update
    set name = excluded.name, role = excluded.role;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    insert into public.profiles (id, email, name, full_name, role)
    values (new.id, new.email, v_name, v_name, v_role)
    on conflict (id) do update
    set
      email = excluded.email,
      name = excluded.name,
      full_name = excluded.full_name,
      role = excluded.role;
  end if;

  return new;
end;
$$;

-- Promote existing hello@ account if already registered
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    update public.users u
    set role = 'admin'
    from auth.users a
    where a.id = u.id
      and lower(a.email) = lower('hello@prestoliv.com')
      and u.role is distinct from 'admin';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    update public.profiles p
    set role = 'admin'
    from auth.users a
    where a.id = p.id
      and lower(a.email) = lower('hello@prestoliv.com')
      and lower(coalesce(p.role::text, '')) is distinct from 'admin';
  end if;
end $$;
