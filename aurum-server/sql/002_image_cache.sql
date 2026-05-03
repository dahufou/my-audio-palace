-- Aurum Server — cache des images externes (artistes & albums)
-- Évite de spammer Deezer/Spotify/Last.fm/Wikipedia depuis chaque navigateur.

create table if not exists artist_images (
  artist_id   uuid primary key references artists(id) on delete cascade,
  url         text,                 -- null = pas trouvé (cache négatif)
  source      text,                 -- deezer | spotify | lastfm | wikipedia | itunes | mb_wiki | manual
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null  -- TTL : 90j succès, 7j échec
);
create index if not exists artist_images_expires_idx on artist_images (expires_at);

create table if not exists album_external_covers (
  album_id    uuid primary key references albums(id) on delete cascade,
  url         text,
  source      text,                 -- deezer | spotify | itunes | caa | manual
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists album_ext_covers_expires_idx on album_external_covers (expires_at);

insert into schema_migrations (version) values ('002_image_cache')
on conflict (version) do nothing;
