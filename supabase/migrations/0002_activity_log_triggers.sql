-- Activity logs: write audit events for key domain actions.

create or replace function public.log_activity(p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.activity_logs (user_id, action)
  values (auth.uid(), p_action);
end;
$$;

-- Projects created
create or replace function public.trg_projects_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_activity('Project created: ' || coalesce(new.name, ''));
  return new;
end;
$$;

drop trigger if exists projects_after_insert_activity on public.projects;
create trigger projects_after_insert_activity
after insert on public.projects
for each row execute procedure public.trg_projects_after_insert();

-- Milestones updated (percentage/title changes)
create or replace function public.trg_milestones_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_activity('Milestone updated: ' || coalesce(new.title, '') || ' (' || new.percentage::text || '%)');
  return new;
end;
$$;

drop trigger if exists milestones_after_update_activity on public.milestones;
create trigger milestones_after_update_activity
after update on public.milestones
for each row execute procedure public.trg_milestones_after_update();

-- Updates inserted
create or replace function public.trg_updates_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snippet text;
begin
  snippet := left(coalesce(new.text, ''), 120);
  perform public.log_activity('Update posted: ' || snippet);
  return new;
end;
$$;

drop trigger if exists updates_after_insert_activity on public.updates;
create trigger updates_after_insert_activity
after insert on public.updates
for each row execute procedure public.trg_updates_after_insert();

-- Queries inserted
create or replace function public.trg_queries_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snippet text;
begin
  snippet := left(coalesce(new.message, ''), 120);
  perform public.log_activity('Query opened: ' || snippet);
  return new;
end;
$$;

drop trigger if exists queries_after_insert_activity on public.queries;
create trigger queries_after_insert_activity
after insert on public.queries
for each row execute procedure public.trg_queries_after_insert();

-- Query replies inserted
create or replace function public.trg_query_replies_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snippet text;
begin
  snippet := left(coalesce(new.message, ''), 120);
  perform public.log_activity('Reply added: ' || snippet);
  return new;
end;
$$;

drop trigger if exists query_replies_after_insert_activity on public.query_replies;
create trigger query_replies_after_insert_activity
after insert on public.query_replies
for each row execute procedure public.trg_query_replies_after_insert();

-- Query status updates (close)
create or replace function public.trg_queries_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_activity('Query status changed to: ' || coalesce(new.status, ''));
  end if;
  return new;
end;
$$;

drop trigger if exists queries_after_update_activity on public.queries;
create trigger queries_after_update_activity
after update on public.queries
for each row execute procedure public.trg_queries_after_update();

-- Milestone templates inserted
create or replace function public.trg_milestone_templates_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_activity('Milestone template created: ' || coalesce(new.name, ''));
  return new;
end;
$$;

drop trigger if exists milestone_templates_after_insert_activity on public.milestone_templates;
create trigger milestone_templates_after_insert_activity
after insert on public.milestone_templates
for each row execute procedure public.trg_milestone_templates_after_insert();

-- Template items inserted
create or replace function public.trg_milestone_template_items_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_activity('Milestone template item added: ' || coalesce(new.title, ''));
  return new;
end;
$$;

drop trigger if exists milestone_template_items_after_insert_activity on public.milestone_template_items;
create trigger milestone_template_items_after_insert_activity
after insert on public.milestone_template_items
for each row execute procedure public.trg_milestone_template_items_after_insert();

