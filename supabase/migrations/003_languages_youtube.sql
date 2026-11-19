-- ============================================================
-- MOODIFY migration 003: song languages, YouTube playback, mood sources
--
-- HOW TO USE: Supabase dashboard -> SQL Editor -> New query ->
-- paste this file -> Run. Safe to run more than once.
-- Run it BEFORE deploying the Phase 10 code.
-- ============================================================

-- Which language a song is sung in (en, ms, zh, yue, nan, ko, ja,
-- instrumental or other).
alter table public.songs add column if not exists language text;

-- YouTube video found for the song, and when it was last checked.
-- YouTube's rules: data from its API must be re-checked or deleted after 30 days.
alter table public.songs add column if not exists youtube_id text;
alter table public.songs add column if not exists youtube_checked_at timestamptz;

-- Where a song's mood comes from: mtg-jamendo, muse, playlist, estimated.
alter table public.songs add column if not exists mood_source text;

-- Imported songs do not always know their release year.
alter table public.songs alter column year drop not null;

-- Languages chosen for a mood, and the user's favourite languages.
alter table public.mood_sessions add column if not exists languages text[] not null default '{}';
alter table public.profiles add column if not exists favorite_languages text[] not null default '{}';

-- Existing sample songs have no singing.
update public.songs set language = 'instrumental' where provider = 'sample' and language is null;

create index if not exists songs_language_idx on public.songs (language);
