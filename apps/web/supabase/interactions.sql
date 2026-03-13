-- Post interactions for Nora.
-- Posts live on Shelby; interactions live in Supabase keyed by post_id.

create extension if not exists pgcrypto;

create table if not exists public.post_likes (
  post_id text not null,
  user_address text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_address)
);

create table if not exists public.post_reposts (
  post_id text not null,
  user_address text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_address)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  author_address text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_post_likes_post
  on public.post_likes (post_id);

create index if not exists idx_post_reposts_post
  on public.post_reposts (post_id);

create index if not exists idx_post_comments_post_time
  on public.post_comments (post_id, created_at desc);

alter table public.post_likes enable row level security;
alter table public.post_reposts enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists "read post_likes" on public.post_likes;
create policy "read post_likes"
on public.post_likes
for select
using (true);

drop policy if exists "read post_reposts" on public.post_reposts;
create policy "read post_reposts"
on public.post_reposts
for select
using (true);

drop policy if exists "read post_comments" on public.post_comments;
create policy "read post_comments"
on public.post_comments
for select
using (true);

-- No INSERT/UPDATE/DELETE policies. Writes happen via server using service role key (bypasses RLS).

