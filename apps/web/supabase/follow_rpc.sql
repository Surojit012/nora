-- Production-grade Follow/Unfollow Schema and RPCs

-- 1. Ensure 'users' has both counters
alter table public.users
  add column if not exists followers_count integer not null default 0,
  add column if not exists following_count integer not null default 0;

-- 2. Drop existing follows to rebuild with strict constraints (assuming early stage / ok to drop)
drop table if exists public.follows;

create table public.follows (
  follower_address text not null references public.users(wallet_address) on delete cascade,
  following_address text not null references public.users(wallet_address) on delete cascade,
  follower_username text,
  following_username text,
  created_at timestamptz not null default now(),
  primary key (follower_address, following_address),
  check (follower_address != following_address)
);

-- Indexes for fast lookups
create index if not exists idx_follows_follower on public.follows (follower_address);
create index if not exists idx_follows_following on public.follows (following_address);

alter table public.follows enable row level security;
create policy "read follows" on public.follows for select using (true);

-- 3. HANDLE FOLLOW RPC
create or replace function public.handle_follow(
  p_follower text, 
  p_following text,
  out followers_count int,
  out following_count int,
  out following boolean
)
language plpgsql
security definer
as $$
declare
  v_follower_username text;
  v_following_username text;
  v_inserted boolean;
begin
  -- Look up usernames
  select username into v_follower_username from public.users where wallet_address = p_follower;
  select username into v_following_username from public.users where wallet_address = p_following;

  -- Insert follow record idempotently
  -- We use a CTE to detect if an actual insert happened
  with ins as (
    insert into public.follows (follower_address, following_address, follower_username, following_username)
    values (p_follower, p_following, v_follower_username, v_following_username)
    on conflict (follower_address, following_address) do nothing
    returning 1
  )
  select count(*) > 0 into v_inserted from ins;

  if v_inserted then
    -- Atomically update counters
    update public.users 
    set following_count = public.users.following_count + 1 
    where wallet_address = p_follower
    returning public.users.following_count into handle_follow.following_count;

    update public.users 
    set followers_count = public.users.followers_count + 1 
    where wallet_address = p_following
    returning public.users.followers_count into handle_follow.followers_count;

    -- Insert notification
    insert into public.notification_events (type, actor_address, recipient_address)
    values ('follow', p_follower, p_following);
  else
    -- Already following, just update usernames (optional but good for sync)
    update public.follows 
    set follower_username = v_follower_username, 
        following_username = v_following_username
    where follower_address = p_follower and following_address = p_following;

    -- Read current counts
    select public.users.followers_count into handle_follow.followers_count from public.users where wallet_address = p_following;
    select public.users.following_count into handle_follow.following_count from public.users where wallet_address = p_follower;
  end if;

  following := true;
end;
$$;

-- 4. HANDLE UNFOLLOW RPC
create or replace function public.handle_unfollow(
  p_follower text, 
  p_following text,
  out followers_count int,
  out following_count int,
  out following boolean
)
language plpgsql
security definer
as $$
declare
  v_deleted boolean;
begin
  with del as (
    delete from public.follows
    where follower_address = p_follower and following_address = p_following
    returning 1
  )
  select count(*) > 0 into v_deleted from del;

  if v_deleted then
    -- Atomically update counters
    update public.users 
    set following_count = greatest(0, public.users.following_count - 1) 
    where wallet_address = p_follower
    returning public.users.following_count into handle_unfollow.following_count;

    update public.users 
    set followers_count = greatest(0, public.users.followers_count - 1) 
    where wallet_address = p_following
    returning public.users.followers_count into handle_unfollow.followers_count;
  else
    -- Not following, just read counts
    select public.users.followers_count into handle_unfollow.followers_count from public.users where wallet_address = p_following;
    select public.users.following_count into handle_unfollow.following_count from public.users where wallet_address = p_follower;
  end if;

  following := false;
end;
$$;

-- 5. RECONCILE COUNTERS (Run this once to fix data)
-- This function fixes any desync between follows table and user counts
create or replace function public.sync_follow_counters()
returns void
language plpgsql
security definer
as $$
begin
  update public.users u
  set 
    followers_count = (select count(*) from public.follows where following_address = u.wallet_address),
    following_count = (select count(*) from public.follows where follower_address = u.wallet_address);
end;
$$;
