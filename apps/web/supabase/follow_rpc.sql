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
begin
  -- Insert follow record idempotently
  insert into public.follows (follower_address, following_address)
  values (p_follower, p_following)
  on conflict do nothing;

  if found then
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
    -- Already following, just read counts
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
begin
  delete from public.follows
  where follower_address = p_follower and following_address = p_following;

  if found then
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
