-- Hashtag index tables for Nora.
-- Stores tag -> post mappings so we can query trending/topics without scanning Shelby blobs.

create table if not exists public.hashtags (
  tag text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.post_hashtags (
  post_id text not null,
  blob_name text not null,
  author text not null,
  post_timestamp bigint not null,
  tag text not null references public.hashtags(tag) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tag)
);

create index if not exists idx_post_hashtags_tag_time
  on public.post_hashtags(tag, post_timestamp desc);

create index if not exists idx_post_hashtags_time
  on public.post_hashtags(post_timestamp desc);

create index if not exists idx_post_hashtags_author
  on public.post_hashtags(author);

alter table public.hashtags enable row level security;
alter table public.post_hashtags enable row level security;

drop policy if exists "read hashtags" on public.hashtags;
create policy "read hashtags"
on public.hashtags
for select
using (true);

drop policy if exists "read post_hashtags" on public.post_hashtags;
create policy "read post_hashtags"
on public.post_hashtags
for select
using (true);
