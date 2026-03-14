-- Follows schema for Nora.
-- Tracks who follows whom.

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_address text not null,
  following_address text not null,
  created_at timestamptz not null default now(),
  unique(follower_address, following_address)
);

alter table public.follows enable row level security;

drop policy if exists "read follows" on public.follows;
create policy "read follows"
on public.follows
for select
using (true);
