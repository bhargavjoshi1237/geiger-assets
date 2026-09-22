-- Delivery — serve optimized assets to websites, apps, and channels.
--
-- Owns assets.delivery_events, assets.delivery_daily, assets.delivery_profiles,
-- assets.delivery_domains, assets.dynamic_links, assets.video_delivery,
-- assets.embeds, assets.delivery_keys, assets.channels, assets.channel_runs,
-- plus the assets.assets.cdn_enabled opt-in flag.
--
-- Distinct from assets.share_links (transient revocable access) and
-- assets.gallery_domains (branded gallery hosting): delivery_events is an
-- append-only log of every file/dynamic/video/embed serve, delivery_daily is
-- its per-day rollup maintained by trigger, and the remaining tables are
-- config records — nothing here calls a third-party API.
--
-- Self-contained + idempotent: safe to re-run. Follows suite conventions
-- (uuid pk, project_id scoping, metadata bag, touch_updated_at, demo-open RLS).

-- @up
create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

-- Defined locally so this file stands alone, per SUPABASE_CONVENTIONS.md.
create or replace function assets.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Opt-in flag: an asset is served from the CDN only after its toggle is on.
alter table assets.assets
  add column if not exists cdn_enabled boolean not null default false;
alter table assets.assets
  add column if not exists cdn_enabled_at timestamptz;

create index if not exists assets_cdn_enabled_idx
  on assets.assets (project_id) where deleted_at is null and cdn_enabled = true;

-- Edge configuration, one row per project -----------------------------------

create table if not exists assets.delivery_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid unique references public.projects(id) on delete cascade,
  cache_ttl_seconds integer not null default 3600,
  origin_protection text not null default 'open' check (origin_protection in ('open', 'signed', 'token')),
  allowed_referrers text[] not null default '{}'::text[],
  format_negotiation boolean not null default true,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Branded delivery hosts. Mirrors assets.gallery_domains column-for-column so
-- the gallery domain-verification flow (TXT record, verify, primary) reuses
-- unchanged; gallery_id stays nullable for project-wide delivery domains.
create table if not exists assets.delivery_domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  gallery_id uuid references assets.galleries(id) on delete cascade,
  hostname citext not null,
  kind text not null default 'subdomain' check (kind in ('subdomain', 'custom')),
  verification_token text not null default '',
  dns_record_type text not null default 'TXT' check (dns_record_type in ('TXT', 'CNAME', 'A')),
  dns_record_name text not null default '',
  dns_record_value text not null default '',
  status text not null default 'pending' check (status in ('pending', 'verifying', 'active', 'failed')),
  ssl_status text not null default 'none' check (ssl_status in ('none', 'pending', 'issued', 'error')),
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists delivery_domains_hostname_key
  on assets.delivery_domains (hostname) where deleted_at is null;

-- Stable URLs whose transform can change without the URL changing ------------
-- (re-point asset_id, keep token).

create table if not exists assets.dynamic_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled link',
  token text not null unique,
  asset_id uuid references assets.assets(id) on delete set null,
  -- { w, h, fit, format, quality, dpr, breakpoints[] }
  transform jsonb not null default '{}'::jsonb,
  signed boolean not null default false,
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'expired', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Per-video delivery state. References the renditions/processing masters but
-- never duplicates transcoding — this row only describes how the video
-- streams (mode, ABR ladder, poster, captions, signing, player).

create table if not exists assets.video_delivery (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  asset_id uuid references assets.assets(id) on delete cascade,
  streaming_mode text not null default 'progressive' check (streaming_mode in ('progressive', 'hls', 'dash')),
  -- [{ label, width, height, bitrate_kbps, url }]
  ladder jsonb not null default '[]'::jsonb,
  poster_asset_id uuid references assets.assets(id) on delete set null,
  -- [{ lang, label, url, is_default }]
  captions jsonb not null default '[]'::jsonb,
  signed boolean not null default false,
  -- { autoplay, muted, loop, controls, preload }
  player jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'ready', 'processing', 'failed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists video_delivery_asset_key
  on assets.video_delivery (asset_id) where deleted_at is null;

-- Registered headless embeds -------------------------------------------------

create table if not exists assets.embeds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled embed',
  kind text not null default 'iframe' check (kind in ('iframe', 'img', 'video', 'oembed', 'url')),
  subject_kind text not null default 'asset',
  subject_id uuid,
  version_mode text not null default 'latest' check (version_mode in ('pinned', 'latest')),
  params jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Headless API keys. The secret itself is never stored — key_hash carries the
-- hash (or the opaque verifier), prefix identifies the key in listings.

create table if not exists assets.delivery_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled key',
  prefix text not null default '',
  key_hash text not null default '',
  scopes text[] not null default '{}'::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists delivery_keys_project_idx
  on assets.delivery_keys (project_id) where deleted_at is null;

-- Channel destinations. Config records only — publishing executes elsewhere;
-- channel_runs is the local ledger of what was (or would be) sent.

create table if not exists assets.channels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled channel',
  kind text not null default 'cms' check (kind in ('cms', 'pim', 'ecommerce', 'social', 'marketing')),
  source_kind text not null default 'collection',
  source_id uuid,
  -- 'manual' or a cron-ish label; credentials live in metadata, never in columns
  schedule text not null default 'manual',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'disabled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.channel_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  channel_id uuid not null references assets.channels(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  published_count integer not null default 0,
  failed_count integer not null default 0,
  error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists channel_runs_channel_idx
  on assets.channel_runs (channel_id, started_at desc) where deleted_at is null;

-- Append-only serve log ------------------------------------------------------
-- One row per file/dynamic/video/embed serve, written fire-and-forget from the
-- file routes after the response is built — never on the streaming path.

create table if not exists assets.delivery_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  asset_id uuid references assets.assets(id) on delete set null,
  link_id uuid,
  embed_id uuid references assets.embeds(id) on delete set null,
  kind text not null default 'file' check (kind in ('file', 'dynamic', 'video', 'embed')),
  bytes bigint not null default 0,
  -- A bare 304 on ETag match is recorded as a hit; everything else is a miss
  -- unless the origin explicitly revalidated.
  cache_status text not null default 'miss' check (cache_status in ('hit', 'miss', 'revalidated')),
  status_code integer not null default 200,
  country text not null default '',
  referrer_host text not null default '',
  transform jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists delivery_events_project_idx
  on assets.delivery_events (project_id, occurred_at desc) where deleted_at is null;
create index if not exists delivery_events_asset_idx
  on assets.delivery_events (asset_id, occurred_at desc) where deleted_at is null;
create index if not exists delivery_events_embed_idx
  on assets.delivery_events (embed_id, occurred_at desc) where deleted_at is null;

-- Per-day rollup, maintained by trigger --------------------------------------

create table if not exists assets.delivery_daily (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  day date not null,
  -- null = project total for the day; otherwise the per-asset slice
  asset_id uuid references assets.assets(id) on delete cascade,
  requests bigint not null default 0,
  bytes bigint not null default 0,
  hits bigint not null default 0,
  misses bigint not null default 0,
  -- { "US": 12, "DE": 3 }
  countries jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists delivery_daily_total_key
  on assets.delivery_daily (project_id, day) where asset_id is null;
create unique index if not exists delivery_daily_asset_key
  on assets.delivery_daily (project_id, day, asset_id) where asset_id is not null;
create index if not exists delivery_daily_project_idx
  on assets.delivery_daily (project_id, day desc);

-- Sum two per-country count bags ({"US": 2} + {"US": 1} = {"US": 3}).
create or replace function assets.delivery_merge_counts(a jsonb, b jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (select jsonb_object_agg(key, total) from (
      select key, sum(value::bigint) as total from (
        select * from jsonb_each_text(coalesce(a, '{}'::jsonb))
        union all
        select * from jsonb_each_text(coalesce(b, '{}'::jsonb))
      ) s group by key
    ) t),
    '{}'::jsonb
  );
$$;

create or replace function assets.delivery_events_rollup()
returns trigger
language plpgsql
as $$
declare
  v_day date := (new.occurred_at)::date;
  v_bytes bigint := coalesce(new.bytes, 0);
  v_hit bigint := case when new.cache_status = 'hit' then 1 else 0 end;
  v_miss bigint := case when new.cache_status in ('miss', 'revalidated') then 1 else 0 end;
  v_countries jsonb := case
    when new.country is not null and new.country <> ''
    then jsonb_build_object(new.country, 1)
    else '{}'::jsonb
  end;
begin
  insert into assets.delivery_daily
    (project_id, day, asset_id, requests, bytes, hits, misses, countries)
  values
    (new.project_id, v_day, null, 1, v_bytes, v_hit, v_miss, v_countries)
  on conflict (project_id, day) where asset_id is null do update set
    requests = assets.delivery_daily.requests + 1,
    bytes = assets.delivery_daily.bytes + excluded.bytes,
    hits = assets.delivery_daily.hits + excluded.hits,
    misses = assets.delivery_daily.misses + excluded.misses,
    countries = assets.delivery_merge_counts(assets.delivery_daily.countries, excluded.countries),
    updated_at = now();

  if new.asset_id is not null then
    insert into assets.delivery_daily
      (project_id, day, asset_id, requests, bytes, hits, misses, countries)
    values
      (new.project_id, v_day, new.asset_id, 1, v_bytes, v_hit, v_miss, v_countries)
    on conflict (project_id, day, asset_id) where asset_id is not null do update set
      requests = assets.delivery_daily.requests + 1,
      bytes = assets.delivery_daily.bytes + excluded.bytes,
      hits = assets.delivery_daily.hits + excluded.hits,
      misses = assets.delivery_daily.misses + excluded.misses,
      countries = assets.delivery_merge_counts(assets.delivery_daily.countries, excluded.countries),
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists delivery_events_rollup on assets.delivery_events;
create trigger delivery_events_rollup
  after insert on assets.delivery_events
  for each row execute function assets.delivery_events_rollup();

-- updated_at triggers ----------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'delivery_events', 'delivery_daily', 'delivery_profiles', 'delivery_domains',
    'dynamic_links', 'video_delivery', 'embeds', 'delivery_keys',
    'channels', 'channel_runs'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- RLS --------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'delivery_events', 'delivery_daily', 'delivery_profiles', 'delivery_domains',
    'dynamic_links', 'video_delivery', 'embeds', 'delivery_keys',
    'channels', 'channel_runs'
  ] loop
    execute format('alter table assets.%I enable row level security', t);
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
    execute format(
      'create policy %I_demo_all on assets.%I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- @down
drop trigger if exists delivery_events_rollup on assets.delivery_events;
drop function if exists assets.delivery_events_rollup();
drop function if exists assets.delivery_merge_counts(jsonb, jsonb);

do $$
declare t text;
begin
  foreach t in array array[
    'delivery_events', 'delivery_daily', 'delivery_profiles', 'delivery_domains',
    'dynamic_links', 'video_delivery', 'embeds', 'delivery_keys',
    'channels', 'channel_runs'
  ] loop
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
  end loop;
end $$;

drop table if exists assets.delivery_events;
drop table if exists assets.delivery_daily;
drop table if exists assets.channel_runs;
drop table if exists assets.channels;
drop table if exists assets.delivery_keys;
drop table if exists assets.embeds;
drop table if exists assets.video_delivery;
drop table if exists assets.dynamic_links;
drop table if exists assets.delivery_domains;
drop table if exists assets.delivery_profiles;
alter table assets.assets drop column if exists cdn_enabled_at;
alter table assets.assets drop column if exists cdn_enabled;
