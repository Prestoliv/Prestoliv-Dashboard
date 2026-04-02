-- Read receipts for query threads (WhatsApp-style seen) + RPCs for safe updates.

alter table public.queries
  add column if not exists last_read_customer_at timestamptz,
  add column if not exists last_read_team_at timestamptz;

create or replace function public.mark_query_read_customer(p_query_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.queries q
  set last_read_customer_at = now()
  where q.id = p_query_id
    and exists (
      select 1 from public.projects p
      where p.id = q.project_id and p.customer_id = auth.uid()
    );
end;
$$;

create or replace function public.mark_query_read_team(p_query_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.queries q
  set last_read_team_at = now()
  where q.id = p_query_id
    and (
      public.is_admin()
      or exists (
        select 1 from public.projects p
        where p.id = q.project_id and p.pm_id = auth.uid()
      )
    );
end;
$$;

grant execute on function public.mark_query_read_customer(uuid) to authenticated;
grant execute on function public.mark_query_read_team(uuid) to authenticated;
