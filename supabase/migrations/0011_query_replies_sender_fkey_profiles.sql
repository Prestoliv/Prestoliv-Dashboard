-- query_replies.sender_id → public.profiles(id) so portal replies validate against the same
-- table as /api/at/bundle. The original FK to public.users(id) fails when profiles exist but
-- public.users has no matching row (common on Supabase-heavy setups).

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    alter table public.query_replies drop constraint if exists query_replies_sender_id_fkey;
    alter table public.query_replies
      add constraint query_replies_sender_id_fkey
      foreign key (sender_id) references public.profiles(id) on delete restrict;
  end if;
end $$;
