-- Poll voting tables for Nora.
-- Poll definitions (options/endsAt) live inside the Shelby post JSON blob.
-- This table stores votes: one vote per (post_id, voter_address).

create table if not exists public.poll_votes (
  post_id text not null,
  voter_address text not null,
  option_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, voter_address)
);

create index if not exists idx_poll_votes_post
  on public.poll_votes (post_id);

alter table public.poll_votes enable row level security;

drop policy if exists "read poll_votes" on public.poll_votes;
create policy "read poll_votes"
on public.poll_votes
for select
using (true);

-- No INSERT/UPDATE policies. Writes happen via server using service role key (bypasses RLS).

