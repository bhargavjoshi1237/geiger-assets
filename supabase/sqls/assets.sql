-- =============================================================================
-- Geiger Assets — core asset library schema
--
-- Lives in the dedicated `assets` product schema on the shared suite Supabase
-- project. References the canonical shared tables (public.projects, auth.users)
-- directly. Fully idempotent and self-contained — safe to re-run.
--
-- Tables:
--   assets.assets                 the asset records the library lists/edits
--   assets.asset_relationships    parent/child/derived/variant links between assets
--   assets.asset_versions         per-asset revision history (one "current")
--
-- snake_case here; the data layer (lib/supabase/assets.js) maps to camelCase.
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;     -- trigram index for fast name search

-- ---------------------------------------------------------------------------
-- Schema + grants
-- (Also add `assets` to Settings -> API -> Exposed schemas in the Supabase
--  dashboard so PostgREST/supabase-js can serve it via .schema("assets").)
-- ---------------------------------------------------------------------------

create schema if not exists assets;

grant usage on schema assets to anon, authenticated, service_role;
alter default privileges in schema assets
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema assets
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema assets
  grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists assets.assets (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade,
  name          text not null default '',
  type          text not null default 'image',
  format        text not null default '',
  size_bytes    bigint not null default 0,
  dimensions    text,
  folder        text not null default 'root',
  status        text not null default 'draft',
  tags          text[] not null default '{}'::text[],
  description   text not null default '',
  downloads     integer not null default 0,
  color         text not null default '#737373',
  thumbnail_url text not null default '',
  created_by    uuid references auth.users(id) on delete set null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  metadata      jsonb not null default '{}'::jsonb,
  constraint assets_type_chk check (
    type in ('image','video','audio','document','3d','raw','pdf','archive')
  ),
  constraint assets_status_chk check (
    status in ('approved','draft','review','processing','archived')
  )
);

create table if not exists assets.asset_relationships (
  id               uuid primary key default gen_random_uuid(),
  asset_id         uuid not null references assets.assets(id) on delete cascade,
  related_asset_id uuid references assets.assets(id) on delete cascade,
  relation_type    text not null default 'derived',
  label            text not null default '',
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  metadata         jsonb not null default '{}'::jsonb,
  constraint asset_rel_type_chk check (
    relation_type in ('parent','child','derived','variant','source','campaign','product')
  ),
  -- a relationship points at another asset OR carries a free-text label
  constraint asset_rel_target_chk check (
    related_asset_id is not null or length(label) > 0
  )
);

create table if not exists assets.asset_versions (
  id             uuid primary key default gen_random_uuid(),
  asset_id       uuid not null references assets.assets(id) on delete cascade,
  version_number integer not null,
  label          text not null default '',
  is_current     boolean not null default false,
  size_bytes     bigint,
  note           text not null default '',
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  metadata       jsonb not null default '{}'::jsonb,
  constraint asset_versions_unique unique (asset_id, version_number)
);

grant all on assets.assets to anon, authenticated, service_role;
grant all on assets.asset_relationships to anon, authenticated, service_role;
grant all on assets.asset_versions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Indexes (sized for scale — the library list, filters, search, and the
-- per-asset relationship/version panels all hit an index, not a seq scan)
-- ---------------------------------------------------------------------------

-- Default list: active rows, newest-edited first.
create index if not exists assets_active_updated_idx
  on assets.assets (updated_at desc) where deleted_at is null;

-- Per-project scoping (multi-tenant ready).
create index if not exists assets_project_idx
  on assets.assets (project_id) where deleted_at is null;

-- Toolbar facets.
create index if not exists assets_status_idx
  on assets.assets (status) where deleted_at is null;
create index if not exists assets_type_idx
  on assets.assets (type) where deleted_at is null;
create index if not exists assets_folder_idx
  on assets.assets (folder) where deleted_at is null;
create index if not exists assets_created_by_idx
  on assets.assets (created_by);

-- Tag filtering + metadata containment.
create index if not exists assets_tags_idx
  on assets.assets using gin (tags);
create index if not exists assets_metadata_idx
  on assets.assets using gin (metadata jsonb_path_ops);

-- Fuzzy/substring name search (ILIKE '%q%').
create index if not exists assets_name_trgm_idx
  on assets.assets using gin (name gin_trgm_ops);

-- Relationship lookups from either side.
create index if not exists asset_rel_asset_idx
  on assets.asset_relationships (asset_id, relation_type);
create index if not exists asset_rel_related_idx
  on assets.asset_relationships (related_asset_id);

-- De-dupe identical links (when they point at a real asset).
create unique index if not exists asset_rel_unique_idx
  on assets.asset_relationships (asset_id, related_asset_id, relation_type)
  where related_asset_id is not null;

-- Version history newest-first, plus a guarantee of one current per asset.
create index if not exists asset_versions_asset_idx
  on assets.asset_versions (asset_id, version_number desc);
create unique index if not exists asset_versions_one_current_idx
  on assets.asset_versions (asset_id) where is_current;

-- ---------------------------------------------------------------------------
-- updated_at trigger (kept inside this schema; does not touch public)
-- ---------------------------------------------------------------------------

create or replace function assets.set_updated_at()
returns trigger
language plpgsql
set search_path = assets
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assets_set_updated_at on assets.assets;
create trigger assets_set_updated_at
  before update on assets.assets
  for each row execute function assets.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- Demo policy: open to anon/authenticated. Replace with a project/org-scoped
-- policy (mirroring flow.can_access_issue_project) once suite auth lands.
-- ---------------------------------------------------------------------------

alter table assets.assets enable row level security;
alter table assets.asset_relationships enable row level security;
alter table assets.asset_versions enable row level security;

drop policy if exists assets_demo_all on assets.assets;
create policy assets_demo_all on assets.assets
  for all to anon, authenticated using (true) with check (true);

drop policy if exists asset_relationships_demo_all on assets.asset_relationships;
create policy asset_relationships_demo_all on assets.asset_relationships
  for all to anon, authenticated using (true) with check (true);

drop policy if exists asset_versions_demo_all on assets.asset_versions;
create policy asset_versions_demo_all on assets.asset_versions
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Demo seed (stable UUIDs; project_id/created_by left null so the rows resolve
-- without a specific project or auth user). The screen never depends on these —
-- an empty table renders the empty state.
-- ---------------------------------------------------------------------------

insert into assets.assets
  (id, name, type, format, size_bytes, dimensions, folder, status, tags,
   downloads, color, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001','hero-banner-summer.psd','image','PSD',26000000,'4096 × 2160','summer-2026','approved','{banner,hero,summer}',47,'#3b82f6','2026-05-28','2026-06-02'),
  ('a0000000-0000-4000-8000-000000000002','brand-guidelines-v4.pdf','document','PDF',8600000,null,'brand','approved','{brand,guidelines,pdf}',128,'#ef4444','2026-04-15','2026-05-20'),
  ('a0000000-0000-4000-8000-000000000003','logo-primary-dark.svg','image','SVG',12000,'512 × 512','logos','approved','{logo,primary,dark}',312,'#10b981','2026-03-10','2026-03-10'),
  ('a0000000-0000-4000-8000-000000000004','product-shot-angle-01.jpg','image','JPG',5700000,'6000 × 4000','photography','approved','{product,photography,lifestyle}',23,'#f59e0b','2026-06-01','2026-06-01'),
  ('a0000000-0000-4000-8000-000000000005','promo-video-30s.mp4','video','MP4',155000000,'1920 × 1080','summer-2026','review','{video,promo,summer}',8,'#8b5cf6','2026-06-03','2026-06-05'),
  ('a0000000-0000-4000-8000-000000000006','icon-set-2026.fig','image','FIG',3300000,null,'brand','draft','{icons,figma,brand}',15,'#06b6d4','2026-05-30','2026-06-04'),
  ('a0000000-0000-4000-8000-000000000007','podcast-ep12-interview.mp3','audio','MP3',44000000,null,'root','approved','{podcast,audio,interview}',64,'#f59e0b','2026-05-22','2026-05-22'),
  ('a0000000-0000-4000-8000-000000000008','social-insta-grid.ai','image','AI',19500000,'1080 × 1080','social','approved','{social,instagram,template}',89,'#ec4899','2026-05-18','2026-06-01'),
  ('a0000000-0000-4000-8000-000000000009','chair-model-3d.glb','3d','GLB',33600000,null,'mockups','draft','{3d,model,furniture}',3,'#f43f5e','2026-06-04','2026-06-04'),
  ('a0000000-0000-4000-8000-000000000010','annual-report-2025.docx','document','DOCX',2500000,null,'q1-archive','archived','{report,annual,2025}',41,'#3b82f6','2026-02-28','2026-03-15')
on conflict (id) do nothing;

insert into assets.asset_relationships
  (id, asset_id, related_asset_id, relation_type, label)
values
  ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005','derived',''),
  ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004','variant',''),
  ('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000003','source',''),
  ('b0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003','child',''),
  ('b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000008',null,'campaign','Summer 2026 Campaign')
on conflict (id) do nothing;

insert into assets.asset_versions
  (id, asset_id, version_number, label, is_current, size_bytes)
values
  -- hero psd: 3 versions
  ('c0000001-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',1,'Initial draft',false,24000000),
  ('c0000001-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001',2,'Color pass',false,25200000),
  ('c0000001-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001',3,'Approved current',true,26000000),
  -- brand guidelines: 4 versions
  ('c0000002-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',1,'',false,7800000),
  ('c0000002-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002',2,'',false,8100000),
  ('c0000002-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002',3,'',false,8400000),
  ('c0000002-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000002',4,'Q2 refresh',true,8600000),
  -- logo: single version
  ('c0000003-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003',1,'Original',true,12000),
  -- product shot: single version
  ('c0000004-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000004',1,'Original',true,5700000),
  -- promo video: 2 versions
  ('c0000005-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005',1,'Rough cut',false,151000000),
  ('c0000005-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000005',2,'Review cut',true,155000000),
  -- icon set: 7 versions (show only first/last few)
  ('c0000006-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000006',6,'',false,3200000),
  ('c0000006-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000006',7,'Latest',true,3300000),
  -- podcast: single
  ('c0000007-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000007',1,'Master',true,44000000),
  -- social grid: 5 versions (latest current)
  ('c0000008-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000008',5,'Final',true,19500000),
  -- chair 3d: single
  ('c0000009-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000009',1,'Import',true,33600000),
  -- annual report: 2 versions
  ('c0000010-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000010',1,'',false,2400000),
  ('c0000010-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000010',2,'Final filed',true,2500000)
on conflict (id) do nothing;
