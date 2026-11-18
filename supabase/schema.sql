-- ============================================================
-- MOODIFY database schema for Supabase (PostgreSQL)
--
-- HOW TO USE: Supabase dashboard -> SQL Editor -> New query ->
-- paste this whole file -> Run. It is safe to run more than once.
--
-- Tables:
--   profiles           one row per user (extends Supabase's auth.users)
--   moods              the ten moods (reference list)
--   songs              the music catalogue
--   mood_sessions      mood profiles a user saved
--   playlists          a user's playlists
--   playlist_songs     which songs are in which playlist
--   favorites          songs a user liked
--   listening_history  played / skipped / rejected events
--
-- Security: Row Level Security (RLS) is ON for every table.
-- Everyone may READ songs and moods. Everything else can only be
-- read or changed by the user who owns it.
-- ============================================================

-- ---------- helper: keep "updated_at" current ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ("users") ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  favorite_genres text[] not null default '{}'
    check (favorite_genres <@ array['indie','alternative','pop','rock','electronic','ambient','lo-fi','hip-hop','r&b','jazz','classical','folk']),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- When someone registers, create their profile row automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Listener'
      ),
      60
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- moods (reference list) ----------
create table if not exists public.moods (
  id text primary key,
  label text not null,
  sort_order smallint not null default 0
);

-- ---------- songs ----------
create table if not exists public.songs (
  id text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
  title text not null check (char_length(title) between 1 and 200),
  artist text not null check (char_length(artist) between 1 and 200),
  genres text[] not null check (cardinality(genres) >= 1),
  moods text[] not null check (cardinality(moods) >= 1),
  effects text[] not null check (cardinality(effects) >= 1),
  energy smallint not null check (energy between 0 and 100),
  intensity smallint not null check (intensity between 0 and 100),
  bpm smallint not null check (bpm between 30 and 260),
  tempo text not null check (tempo in ('slow', 'medium', 'fast')),
  popularity smallint not null default 0 check (popularity between 0 and 100),
  year smallint not null check (year between 1900 and 2100),
  provider text not null default 'sample',   -- where the song comes from (sample, spotify, ...)
  external_url text,                          -- link to the song on the provider (Phase 7)
  preview_url text,                           -- legal audio preview, if any (Phase 7)
  created_at timestamptz not null default now()
);

-- Added in Phase 7 (also in migrations/002_music_sources.sql)
alter table public.songs add column if not exists artwork_url text;
alter table public.songs add column if not exists album text;
alter table public.songs add column if not exists duration_s integer check (duration_s is null or duration_s between 1 and 7200);
alter table public.songs add column if not exists license_url text;

create index if not exists songs_moods_idx on public.songs using gin (moods);
create index if not exists songs_genres_idx on public.songs using gin (genres);

-- ---------- mood sessions ----------
create table if not exists public.mood_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  moods text[] not null
    check (cardinality(moods) between 1 and 3
      and moods <@ array['happy','sad','lonely','angry','anxious','calm','nostalgic','motivated','empty','romantic']),
  energy smallint not null check (energy between 0 and 100),
  intensity smallint not null check (intensity between 0 and 100),
  genres text[] not null default '{}',
  desired_effect text not null
    check (desired_effect in ('comfort','embrace','companionship','release','atmosphere','memories','uplift','energize')),
  tempo text not null default 'any' check (tempo in ('slow', 'medium', 'fast', 'any')),
  source text not null default 'manual' check (source in ('manual', 'assistant')),
  created_at timestamptz not null default now()
);

create index if not exists mood_sessions_user_idx on public.mood_sessions (user_id, created_at desc);

-- ---------- playlists ----------
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  mood_session_id uuid references public.mood_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists playlists_user_idx on public.playlists (user_id, created_at desc);

drop trigger if exists playlists_set_updated_at on public.playlists;
create trigger playlists_set_updated_at
  before update on public.playlists
  for each row execute function public.set_updated_at();

-- ---------- playlist songs ----------
create table if not exists public.playlist_songs (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  song_id text not null references public.songs (id) on delete cascade,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (playlist_id, song_id)
);

create index if not exists playlist_songs_song_idx on public.playlist_songs (song_id);

-- ---------- favorites ----------
create table if not exists public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  song_id text not null references public.songs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create index if not exists favorites_song_idx on public.favorites (song_id);

-- ---------- listening history ----------
create table if not exists public.listening_history (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  song_id text not null references public.songs (id) on delete cascade,
  event text not null check (event in ('played', 'skipped', 'rejected')),
  mood_session_id uuid references public.mood_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists listening_history_user_idx on public.listening_history (user_id, created_at desc);
create index if not exists listening_history_song_idx on public.listening_history (song_id);

-- ============================================================
-- Permissions (GRANT): which roles may touch which tables at all.
--   anon          = visitors who are not logged in
--   authenticated = logged-in users
--   service_role  = the backend's secret key (used only for seeding)
-- New Supabase projects no longer grant these automatically.
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;

grant select on public.songs, public.moods to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.mood_sessions to authenticated;
grant select, insert, update, delete on public.playlists to authenticated;
grant select, insert, update, delete on public.playlist_songs to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, delete on public.listening_history to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ============================================================
-- Row Level Security (RLS): which ROWS each user may see or change.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.moods enable row level security;
alter table public.songs enable row level security;
alter table public.mood_sessions enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;
alter table public.favorites enable row level security;
alter table public.listening_history enable row level security;

-- songs and moods: everyone can read, nobody can write through the API.
drop policy if exists "Songs are readable by everyone" on public.songs;
create policy "Songs are readable by everyone" on public.songs
  for select to anon, authenticated using (true);

drop policy if exists "Moods are readable by everyone" on public.moods;
create policy "Moods are readable by everyone" on public.moods
  for select to anon, authenticated using (true);

-- profiles: a user sees and edits only their own.
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- mood sessions
drop policy if exists "Users read own mood sessions" on public.mood_sessions;
create policy "Users read own mood sessions" on public.mood_sessions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users add own mood sessions" on public.mood_sessions;
create policy "Users add own mood sessions" on public.mood_sessions
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own mood sessions" on public.mood_sessions;
create policy "Users delete own mood sessions" on public.mood_sessions
  for delete to authenticated using (user_id = (select auth.uid()));

-- playlists
drop policy if exists "Users read own playlists" on public.playlists;
create policy "Users read own playlists" on public.playlists
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users add own playlists" on public.playlists;
create policy "Users add own playlists" on public.playlists
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users update own playlists" on public.playlists;
create policy "Users update own playlists" on public.playlists
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own playlists" on public.playlists;
create policy "Users delete own playlists" on public.playlists
  for delete to authenticated using (user_id = (select auth.uid()));

-- playlist songs: allowed only inside a playlist the user owns.
drop policy if exists "Users read songs of own playlists" on public.playlist_songs;
create policy "Users read songs of own playlists" on public.playlist_songs
  for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));

drop policy if exists "Users add songs to own playlists" on public.playlist_songs;
create policy "Users add songs to own playlists" on public.playlist_songs
  for insert to authenticated
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));

drop policy if exists "Users reorder songs of own playlists" on public.playlist_songs;
create policy "Users reorder songs of own playlists" on public.playlist_songs
  for update to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));

drop policy if exists "Users remove songs from own playlists" on public.playlist_songs;
create policy "Users remove songs from own playlists" on public.playlist_songs
  for delete to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));

-- favorites
drop policy if exists "Users read own favorites" on public.favorites;
create policy "Users read own favorites" on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users add own favorites" on public.favorites;
create policy "Users add own favorites" on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users remove own favorites" on public.favorites;
create policy "Users remove own favorites" on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

-- listening history
drop policy if exists "Users read own history" on public.listening_history;
create policy "Users read own history" on public.listening_history
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users add own history" on public.listening_history;
create policy "Users add own history" on public.listening_history
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own history" on public.listening_history;
create policy "Users delete own history" on public.listening_history
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- the ten moods ----------
insert into public.moods (id, label, sort_order) values
  ('happy', 'Happy', 1), ('sad', 'Sad', 2), ('lonely', 'Lonely', 3), ('angry', 'Angry', 4),
  ('anxious', 'Anxious', 5), ('calm', 'Calm', 6), ('nostalgic', 'Nostalgic', 7),
  ('motivated', 'Motivated', 8), ('empty', 'Empty', 9), ('romantic', 'Romantic', 10)
on conflict (id) do update set label = excluded.label, sort_order = excluded.sort_order;
