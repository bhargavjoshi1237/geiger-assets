-- Storage backends and pools for Geiger Assets.
--
-- Shape (three tables, each serving exactly one read):
--   assets.storage_backends      one row per provider: project scope (null =
--                                suite-wide), kind (s3/rest), label, enabled
--                                flag, encrypted config bag, per-backend upload
--                                cap, last health probe, and soft delete. The
--                                admin list and pool selection read by
--                                project_id filtered on enabled + alive.
--   assets.storage_pools         named failover/spread/mirror sets per project;
--                                the hot path resolves one pool to an ordered
--                                member list, never a scan.
--   assets.storage_pool_members  join of pools to backends: priority (lower
--                                wins for failover), weight (share for spread),
--                                and read_only. Replaced wholesale by
--                                setPoolMembers, so there is no updated_at and
--                                no soft delete — membership is the pool's
--                                current truth.
--
-- assets.assets.storage_backend / assets.asset_versions.storage_backend point
-- at the backend holding the bytes; null means the env-configured default
-- backend, so every pre-existing row keeps resolving. Secrets in
-- storage_backends.config are encrypted in JS before they are written — the
-- DB stores the bag, it does not protect it.
--
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create table if not exists assets.storage_backends (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references public.project(id) on delete cascade,
  kind              text not null,
  label             text not null default '',
  enabled           boolean not null default true,
  config            jsonb not null default '{}'::jsonb,
  max_upload_bytes  bigint not null default 0,
  health_ok         boolean,
  health_detail     text,
  health_checked_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  constraint storage_backends_kind_chk check (kind in ('s3', 'rest'))
);

create table if not exists assets.storage_pools (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.project(id) on delete cascade,
  name        text not null,
  strategy    text not null default 'failover',
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint storage_pools_strategy_chk check (strategy in ('failover', 'spread', 'mirror'))
);

create table if not exists assets.storage_pool_members (
  pool_id     uuid not null references assets.storage_pools(id) on delete cascade,
  backend_id  uuid not null references assets.storage_backends(id) on delete cascade,
  priority    int not null default 100,
  weight      int not null default 1,
  read_only   boolean not null default false,
  primary key (pool_id, backend_id)
);

grant all on assets.storage_backends to anon, authenticated, service_role;
grant all on assets.storage_pools to anon, authenticated, service_role;
grant all on assets.storage_pool_members to anon, authenticated, service_role;

-- Admin list / pool resolution: live rows of one project.
-- Member fan-out: every pool using a backend (health sweep / delete guard).
create index if not exists storage_backends_project_idx
  on assets.storage_backends (project_id) where deleted_at is null;
create index if not exists storage_pools_project_idx
  on assets.storage_pools (project_id) where deleted_at is null;
create index if not exists storage_pool_members_backend_idx
  on assets.storage_pool_members (backend_id);

drop trigger if exists storage_backends_set_updated_at on assets.storage_backends;
create trigger storage_backends_set_updated_at
  before update on assets.storage_backends
  for each row execute function public.flow_touch_updated_at();

drop trigger if exists storage_pools_set_updated_at on assets.storage_pools;
create trigger storage_pools_set_updated_at
  before update on assets.storage_pools
  for each row execute function public.flow_touch_updated_at();

alter table assets.storage_backends enable row level security;
alter table assets.storage_pools enable row level security;
alter table assets.storage_pool_members enable row level security;

drop policy if exists storage_backends_demo_all on assets.storage_backends;
create policy storage_backends_demo_all on assets.storage_backends
  for all to anon, authenticated using (true) with check (true);

drop policy if exists storage_pools_demo_all on assets.storage_pools;
create policy storage_pools_demo_all on assets.storage_pools
  for all to anon, authenticated using (true) with check (true);

drop policy if exists storage_pool_members_demo_all on assets.storage_pool_members;
create policy storage_pool_members_demo_all on assets.storage_pool_members
  for all to anon, authenticated using (true) with check (true);

alter table assets.assets
  add column if not exists storage_backend uuid;
alter table assets.asset_versions
  add column if not exists storage_backend uuid;
-- The presigned flow commits in a separate request from the one that chose a
-- backend, so the placement decision has to survive on the job row. Re-deciding
-- it at commit time could name a different pool member than the one actually
-- holding the object.
alter table assets.upload_jobs
  add column if not exists storage_backend uuid;

comment on column assets.assets.storage_backend is
  'Physical backend in assets.storage_backends holding the bytes; null means the env-configured default backend, so every pre-existing row keeps resolving.';

-- @down
alter table assets.upload_jobs drop column if exists storage_backend;
alter table assets.asset_versions drop column if exists storage_backend;
alter table assets.assets drop column if exists storage_backend;
drop policy if exists storage_pool_members_demo_all on assets.storage_pool_members;
drop policy if exists storage_pools_demo_all on assets.storage_pools;
drop policy if exists storage_backends_demo_all on assets.storage_backends;
drop index if exists assets.storage_pool_members_backend_idx;
drop index if exists assets.storage_pools_project_idx;
drop index if exists assets.storage_backends_project_idx;
drop table if exists assets.storage_pool_members;
drop table if exists assets.storage_pools;
drop table if exists assets.storage_backends;
