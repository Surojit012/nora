-- Creates a public bucket for avatar uploads.
-- Run in Supabase SQL editor once per project.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = excluded.public;

-- Public bucket for cover image uploads.
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update
set public = excluded.public;
