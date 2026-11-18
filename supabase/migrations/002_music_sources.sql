-- ============================================================
-- MOODIFY migration 002: real music sources (Phase 7)
-- Adds the columns needed for songs from Jamendo and other providers.
--
-- HOW TO USE: Supabase dashboard -> SQL Editor -> New query ->
-- paste this file -> Run. Safe to run more than once.
-- ============================================================
alter table public.songs add column if not exists artwork_url text;
alter table public.songs add column if not exists album text;
alter table public.songs add column if not exists duration_s integer check (duration_s is null or duration_s between 1 and 7200);
alter table public.songs add column if not exists license_url text;

-- The songs table already allows everyone to read and only the server's
-- secret key to write, so no policy changes are needed.
