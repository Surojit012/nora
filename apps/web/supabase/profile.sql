-- Profile enhancements for Nora.
-- Adds cover image url field to users.

alter table public.users
  add column if not exists cover text not null default '';

