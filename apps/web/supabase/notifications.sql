-- Notifications + follows for Nora.
-- Run once in Supabase SQL editor.

create extension if not exists pgcrypto;

-- Follow graph (wallet -> wallet).
create table if not exists public.follows (
  follower_address text not null,
  following_address text not null,
  created_at timestamptz not null default now(),
  primary key (follower_address, following_address)
);

create index if not exists idx_follows_following_created
  on public.follows (following_address, created_at desc);

-- Event stream (likes, follows, mentions).
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('like','follow','mention')),
  recipient_address text not null,
  actor_address text not null,
  post_id text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_created
  on public.notification_events (recipient_address, created_at desc);

create index if not exists idx_notifications_type_created
  on public.notification_events (type, created_at desc);

alter table public.follows enable row level security;
alter table public.notification_events enable row level security;

drop policy if exists "read follows" on public.follows;
create policy "read follows"
on public.follows
for select
using (true);

drop policy if exists "read notifications" on public.notification_events;
create policy "read notifications"
on public.notification_events
for select
using (true);

-- Writes happen via server using service role key (bypasses RLS).

