-- Post bookmarks for Nora.
-- Posts live on Shelby; bookmarks live in Supabase keyed by post_id.

create table if not exists public.post_bookmarks (
  post_id text not null,
  user_address text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_address)
);

create index if not exists idx_post_bookmarks_user_time
  on public.post_bookmarks (user_address, created_at desc);

create index if not exists idx_post_bookmarks_post
  on public.post_bookmarks (post_id);

alter table public.post_bookmarks enable row level security;

drop policy if exists "read post_bookmarks" on public.post_bookmarks;
create policy "read post_bookmarks"
on public.post_bookmarks
for select
using (true);

-- No INSERT/UPDATE/DELETE policies. Writes happen via server using service role key (bypasses RLS).

