-- Posts index for Shelby blobs.
-- This is the authoritative feed index (replaces local .nora-post-index.json).

create table if not exists public.post_blobs (
  blob_name text primary key,
  owner_address text not null,
  author_address text not null,
  post_timestamp bigint not null,
  tx_hash text,
  tx_explorer_url text,
  shelby_tx_explorer_url text,
  shelby_blob_url text,
  created_at timestamptz not null default now()
);

create index if not exists post_blobs_post_timestamp_idx
  on public.post_blobs (post_timestamp desc);

create index if not exists post_blobs_author_timestamp_idx
  on public.post_blobs (author_address, post_timestamp desc);

