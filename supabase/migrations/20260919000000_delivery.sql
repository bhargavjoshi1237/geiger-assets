-- Delivery domain for Geiger Assets (CDN domains, channel publishing, share
-- links, video player config).
--
-- Shape (five tables, each serving exactly one read):
--   assets.delivery_domains       custom delivery domains per project: the
--                                 hostname operators point at a backend's CDN
--                                 origin (lib/storage/cdn.js), which backend it
--                                 fronts, edge TTL, origin protection, and when
--                                 an edge purge was last logged. The CDN screen
--                                 lists live rows of one project.
--   assets.channel_destinations   connected publish targets per project: kind
--                                 (cms / pim / ecommerce / social / automation),
--                                 name, status, and endpoint. Channel publishing
--                                 lists live rows of one project.
--   assets.channel_exports        publish jobs aimed at a destination: status
--                                 lifecycle (draft / scheduled / publishing /
--                                 published / failed), optional schedule, and a
--                                 planned asset count. Per-channel status is
--                                 derived from the latest export row.
--   assets.share_links            minted signed share links (POST
--                                 /api/media/share): asset, variant, scope, a
--                                 token prefix for identification, and expiry.
--                                 The token itself is a bearer credential and is
--                                 never stored — only its prefix, so a leaked
--                                 table cannot be replayed. Revocation is a soft
--                                 delete; expiry is honoured by the token route.
--   assets.video_configs          per-asset player configuration: autoplay,
--                                 muted, loop, controls, poster variant,
--                                 captions, and whether streams must be signed.
--                                 Transcoding/rendition state is deliberately
--                                 absent — there is no ffmpeg in this deployment,
--                                 so there is nothing truthful to persist there.
--
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create table if not exists assets.delivery_domains (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  domain             text not null,
  backend_id         uuid references assets.storage_backends(id) on delete set null,
  is_primary         boolean not null default false,
  verified           boolean not null default false,
  verified_at        timestamptz,
  edge_ttl_seconds   integer not null default 3600,
  origin_protection  boolean not null default true,
  last_purged_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  metadata           jsonb not null default '{}'::jsonb,
  constraint delivery_domains_domain_chk check (char_length(domain) > 0 and char_length(domain) <= 253),
  constraint delivery_domains_ttl_chk check (edge_ttl_seconds >= 0)
);

create table if not exists assets.channel_destinations (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  kind         text not null,
  name         text not null default '',
  status       text not null default 'connected',
  base_url     text not null default '',
  last_sync_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  metadata     jsonb not null default '{}'::jsonb,
  constraint channel_destinations_kind_chk check (kind in ('cms', 'pim', 'ecommerce', 'social', 'automation')),
  constraint channel_destinations_status_chk check (status in ('connected', 'paused', 'error'))
);

create table if not exists assets.channel_exports (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  destination_id uuid references assets.channel_destinations(id) on delete set null,
  name           text not null default '',
  status         text not null default 'draft',
  scheduled_at   timestamptz,
  asset_count    integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  metadata       jsonb not null default '{}'::jsonb,
  constraint channel_exports_status_chk check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  constraint channel_exports_asset_count_chk check (asset_count >= 0)
);

create table if not exists assets.share_links (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  asset_id     uuid references assets.assets(id) on delete set null,
  variant      text not null default 'original',
  scope        text not null default 'view',
  token_prefix text not null default '',
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  metadata     jsonb not null default '{}'::jsonb,
  constraint share_links_scope_chk check (scope in ('view', 'download'))
);

create table if not exists assets.video_configs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  asset_id          uuid not null references assets.assets(id) on delete cascade,
  autoplay          boolean not null default false,
  muted             boolean not null default true,
  loop_enabled      boolean not null default false,
  show_controls     boolean not null default true,
  poster_variant    text not null default 'poster',
  captions_enabled  boolean not null default false,
  captions_language text not null default 'en',
  signed_urls       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  constraint video_configs_asset_uniq unique (asset_id),
  constraint video_configs_poster_chk check (poster_variant in ('thumb', 'preview', 'poster', 'original'))
);

grant all on assets.delivery_domains to anon, authenticated, service_role;
grant all on assets.channel_destinations to anon, authenticated, service_role;
grant all on assets.channel_exports to anon, authenticated, service_role;
grant all on assets.share_links to anon, authenticated, service_role;
grant all on assets.video_configs to anon, authenticated, service_role;

-- Screen lists: live rows of one project. Export rollups: latest export per
-- destination. Link lookups: live links of one asset.
create index if not exists delivery_domains_project_idx
  on assets.delivery_domains (project_id) where deleted_at is null;
create index if not exists channel_destinations_project_idx
  on assets.channel_destinations (project_id) where deleted_at is null;
create index if not exists channel_exports_project_idx
  on assets.channel_exports (project_id) where deleted_at is null;
create index if not exists channel_exports_destination_idx
  on assets.channel_exports (destination_id, created_at desc) where deleted_at is null;
create index if not exists share_links_project_idx
  on assets.share_links (project_id) where deleted_at is null;
create index if not exists share_links_asset_idx
  on assets.share_links (asset_id) where deleted_at is null;
create index if not exists video_configs_project_idx
  on assets.video_configs (project_id) where deleted_at is null;

drop trigger if exists delivery_domains_set_updated_at on assets.delivery_domains;
create trigger delivery_domains_set_updated_at
  before update on assets.delivery_domains
  for each row execute function assets.set_updated_at();

drop trigger if exists channel_destinations_set_updated_at on assets.channel_destinations;
create trigger channel_destinations_set_updated_at
  before update on assets.channel_destinations
  for each row execute function assets.set_updated_at();

drop trigger if exists channel_exports_set_updated_at on assets.channel_exports;
create trigger channel_exports_set_updated_at
  before update on assets.channel_exports
  for each row execute function assets.set_updated_at();

drop trigger if exists share_links_set_updated_at on assets.share_links;
create trigger share_links_set_updated_at
  before update on assets.share_links
  for each row execute function assets.set_updated_at();

drop trigger if exists video_configs_set_updated_at on assets.video_configs;
create trigger video_configs_set_updated_at
  before update on assets.video_configs
  for each row execute function assets.set_updated_at();

alter table assets.delivery_domains enable row level security;
alter table assets.channel_destinations enable row level security;
alter table assets.channel_exports enable row level security;
alter table assets.share_links enable row level security;
alter table assets.video_configs enable row level security;

drop policy if exists delivery_domains_demo_all on assets.delivery_domains;
create policy delivery_domains_demo_all on assets.delivery_domains
  for all to anon, authenticated using (true) with check (true);

drop policy if exists channel_destinations_demo_all on assets.channel_destinations;
create policy channel_destinations_demo_all on assets.channel_destinations
  for all to anon, authenticated using (true) with check (true);

drop policy if exists channel_exports_demo_all on assets.channel_exports;
create policy channel_exports_demo_all on assets.channel_exports
  for all to anon, authenticated using (true) with check (true);

drop policy if exists share_links_demo_all on assets.share_links;
create policy share_links_demo_all on assets.share_links
  for all to anon, authenticated using (true) with check (true);

drop policy if exists video_configs_demo_all on assets.video_configs;
create policy video_configs_demo_all on assets.video_configs
  for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists video_configs_demo_all on assets.video_configs;
drop policy if exists share_links_demo_all on assets.share_links;
drop policy if exists channel_exports_demo_all on assets.channel_exports;
drop policy if exists channel_destinations_demo_all on assets.channel_destinations;
drop policy if exists delivery_domains_demo_all on assets.delivery_domains;
drop index if exists assets.video_configs_project_idx;
drop index if exists assets.share_links_asset_idx;
drop index if exists assets.share_links_project_idx;
drop index if exists assets.channel_exports_destination_idx;
drop index if exists assets.channel_exports_project_idx;
drop index if exists assets.channel_destinations_project_idx;
drop index if exists assets.delivery_domains_project_idx;
drop table if exists assets.video_configs;
drop table if exists assets.share_links;
drop table if exists assets.channel_exports;
drop table if exists assets.channel_destinations;
drop table if exists assets.delivery_domains;
