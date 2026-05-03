-- Aurum Server — schéma initial
-- Idempotent : ré-exécutable sans erreur.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Migrations bookkeeping
-- ---------------------------------------------------------------------------
create table if not exists schema_migrations (
  version     text primary key,
  applied_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Utilisateurs (auth locale)
-- ---------------------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  display_name  text,
  password_hash text not null,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bibliothèque
-- ---------------------------------------------------------------------------
create table if not exists artists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_name   text,
  mbid        text,
  created_at  timestamptz not null default now(),
  unique (name)
);
create index if not exists artists_name_trgm on artists using gin (name gin_trgm_ops);

create table if not exists albums (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references artists(id) on delete cascade,
  title        text not null,
  year         int,
  mbid         text,
  cover_path   text,           -- chemin absolu du fichier cover (jpg/png)
  cover_mime   text,
  folder_path  text,           -- dossier "racine" de l'album
  added_at     timestamptz not null default now(),
  unique (artist_id, title)
);
create index if not exists albums_title_trgm on albums using gin (title gin_trgm_ops);
create index if not exists albums_artist_idx on albums (artist_id);

create table if not exists tracks (
  id            uuid primary key default gen_random_uuid(),
  album_id      uuid not null references albums(id) on delete cascade,
  artist_id     uuid not null references artists(id) on delete cascade,
  title         text not null,
  track_no      int,
  disc_no       int,
  duration_sec  numeric(10,3),
  bitrate       int,
  sample_rate   int,
  channels      int,
  codec         text,            -- flac, alac, mp3, aac, opus, ...
  container     text,            -- flac, m4a, mp3, ...
  lossless      boolean not null default false,
  file_path     text not null unique,
  file_size     bigint,
  file_mtime    timestamptz,
  added_at      timestamptz not null default now()
);
create index if not exists tracks_album_idx  on tracks (album_id, disc_no, track_no);
create index if not exists tracks_artist_idx on tracks (artist_id);
create index if not exists tracks_title_trgm on tracks using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Playlists
-- ---------------------------------------------------------------------------
create table if not exists playlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists playlist_tracks (
  playlist_id uuid not null references playlists(id) on delete cascade,
  position    int not null,
  track_id    uuid not null references tracks(id) on delete cascade,
  primary key (playlist_id, position)
);

-- ---------------------------------------------------------------------------
-- Historique de lecture
-- ---------------------------------------------------------------------------
create table if not exists play_history (
  id         bigserial primary key,
  user_id    uuid references users(id) on delete set null,
  track_id   uuid not null references tracks(id) on delete cascade,
  played_at  timestamptz not null default now(),
  zone_id    uuid
);
create index if not exists play_history_user_idx on play_history (user_id, played_at desc);

-- ---------------------------------------------------------------------------
-- Zones & devices (Chromecast / UPnP / locale)
-- ---------------------------------------------------------------------------
create table if not exists zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists devices (
  id          uuid primary key default gen_random_uuid(),
  zone_id     uuid references zones(id) on delete set null,
  kind        text not null,          -- chromecast | upnp | local | airplay
  name        text not null,
  address     text,                   -- ip:port ou udn
  last_seen   timestamptz,
  created_at  timestamptz not null default now(),
  unique (kind, address)
);

-- ---------------------------------------------------------------------------
-- Marqueur de version
-- ---------------------------------------------------------------------------
insert into schema_migrations (version)
values ('001_init')
on conflict (version) do nothing;
