-- Ensure realtime can deliver row payloads reliably for INSERT/UPDATE events.
alter table public.updates replica identity full;
alter table public.queries replica identity full;
alter table public.query_replies replica identity full;

