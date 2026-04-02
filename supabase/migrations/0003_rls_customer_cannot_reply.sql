-- Customers should not be able to reply to queries.
drop policy if exists "customer insert replies" on public.query_replies;

