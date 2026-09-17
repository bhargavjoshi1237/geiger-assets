-- Analytics domain for Geiger Assets (engagement, search, portals, commerce,
-- licensing, and report configuration).
--
-- Shape (seven tables, each serving exactly one read):
--   assets.asset_events     append-only engagement log per project: asset,
--                           kind (view / download / share / embed), event time.
--                           Backs Asset Analytics. Immutable like
--                           delivery_events: no updated_at, no soft delete.
--   assets.search_events    append-only search log: query text, result count,
--                           whether the search converted, event time. Filter
--                           usage rides in metadata.filters. Backs Search
--                           Analytics. Immutable.
--   assets.portal_visits    append-only portal log: portal key, asset, kind
--                           (visit / download / signup), referrer, and an
--                           optional free-text country. Geography is only ever
--                           what a caller records — never inferred here. Backs
--                           Portal Analytics. Immutable.
--   assets.commerce_orders  order ledger: status lifecycle (pending / paid /
--                           refunded / cancelled), gross and refunded cents,
--                           product detail in metadata. Backs Commerce Analytics.
--   assets.asset_licenses   outbound rights granted to a licensee: asset, kind,
--                           territory, status, term, amount, and an optional
--                           self-reference to the license it renewed. Backs
--                           License Analytics.
--   assets.report_configs   saved dashboards and scheduled reports: kind
--                           (dashboard / report), schedule, active flag, last
--                           run, metric/filter/format config in metadata.
--   assets.report_exports   append-only log of export runs: report, format
--                           (csv / pdf), status, row count. Immutable.
--
-- What this migration deliberately does NOT create: delivery metering
-- (assets.project_usage + assets.delivery_events already exist), storage
-- quotas (assets.project_settings), duplicate detection
-- (assets.duplicate_groups), and asset rows themselves (assets.assets).
-- Library Health and Storage & Usage read those existing tables instead of
-- duplicating them. AI credits and seat-level activity have no meter behind
-- them, so no table pretends to store them.
--
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create table if not exists assets.asset_events (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  asset_id    uuid references assets.assets(id) on delete set null,
  kind        text not null default 'view',
  created_at  timestamptz not null default now(),
  metadata    jsonb not null default '{}'::jsonb,
  constraint asset_events_kind_chk check (kind in ('view', 'download', 'share', 'embed'))
);

create table if not exists assets.search_events (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  query         text not null default '',
  results_count integer not null default 0,
  converted     boolean not null default false,
  created_at    timestamptz not null default now(),
  metadata      jsonb not null default '{}'::jsonb,
  constraint search_events_results_chk check (results_count >= 0)
);

create table if not exists assets.portal_visits (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  portal_key  text not null default '',
  asset_id    uuid references assets.assets(id) on delete set null,
  kind        text not null default 'visit',
  referrer    text not null default '',
  country     text not null default '',
  created_at  timestamptz not null default now(),
  metadata    jsonb not null default '{}'::jsonb,
  constraint portal_visits_kind_chk check (kind in ('visit', 'download', 'signup'))
);

create table if not exists assets.commerce_orders (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  status         text not null default 'pending',
  amount_cents   bigint not null default 0,
  currency       text not null default 'usd',
  refunded_cents bigint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  metadata       jsonb not null default '{}'::jsonb,
  constraint commerce_orders_status_chk check (status in ('pending', 'paid', 'refunded', 'cancelled')),
  constraint commerce_orders_amount_chk check (amount_cents >= 0),
  constraint commerce_orders_refunded_chk check (refunded_cents >= 0)
);

create table if not exists assets.asset_licenses (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  asset_id     uuid references assets.assets(id) on delete set null,
  licensee     text not null default '',
  kind         text not null default 'standard',
  territory    text not null default '',
  status       text not null default 'active',
  amount_cents bigint not null default 0,
  currency     text not null default 'usd',
  starts_at    timestamptz,
  expires_at   timestamptz,
  renewed_from uuid references assets.asset_licenses(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  metadata     jsonb not null default '{}'::jsonb,
  constraint asset_licenses_status_chk check (status in ('active', 'pending', 'expired', 'revoked')),
  constraint asset_licenses_amount_chk check (amount_cents >= 0)
);

create table if not exists assets.report_configs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null default '',
  kind        text not null default 'report',
  schedule    text not null default 'manual',
  is_active   boolean not null default true,
  last_run_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  metadata    jsonb not null default '{}'::jsonb,
  constraint report_configs_kind_chk check (kind in ('dashboard', 'report')),
  constraint report_configs_schedule_chk check (schedule in ('manual', 'daily', 'weekly', 'monthly'))
);

create table if not exists assets.report_exports (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  report_id   uuid references assets.report_configs(id) on delete set null,
  format      text not null default 'csv',
  status      text not null default 'completed',
  row_count   integer not null default 0,
  created_at  timestamptz not null default now(),
  metadata    jsonb not null default '{}'::jsonb,
  constraint report_exports_format_chk check (format in ('csv', 'pdf')),
  constraint report_exports_status_chk check (status in ('queued', 'running', 'completed', 'failed')),
  constraint report_exports_rows_chk check (row_count >= 0)
);

grant all on assets.asset_events to anon, authenticated, service_role;
grant all on assets.search_events to anon, authenticated, service_role;
grant all on assets.portal_visits to anon, authenticated, service_role;
grant all on assets.commerce_orders to anon, authenticated, service_role;
grant all on assets.asset_licenses to anon, authenticated, service_role;
grant all on assets.report_configs to anon, authenticated, service_role;
grant all on assets.report_exports to anon, authenticated, service_role;

-- Log reads: one project's window, newest first. Ledger reads: live rows of
-- one project. License reads add an expiry scan for the upcoming-renewals list.
create index if not exists asset_events_project_idx
  on assets.asset_events (project_id, created_at desc);
create index if not exists asset_events_asset_idx
  on assets.asset_events (asset_id, created_at desc);
create index if not exists search_events_project_idx
  on assets.search_events (project_id, created_at desc);
create index if not exists portal_visits_project_idx
  on assets.portal_visits (project_id, created_at desc);
create index if not exists portal_visits_asset_idx
  on assets.portal_visits (asset_id) where asset_id is not null;
create index if not exists commerce_orders_project_idx
  on assets.commerce_orders (project_id) where deleted_at is null;
create index if not exists asset_licenses_project_idx
  on assets.asset_licenses (project_id) where deleted_at is null;
create index if not exists asset_licenses_expiry_idx
  on assets.asset_licenses (project_id, expires_at) where deleted_at is null;
create index if not exists report_configs_project_idx
  on assets.report_configs (project_id) where deleted_at is null;
create index if not exists report_exports_project_idx
  on assets.report_exports (project_id, created_at desc);

drop trigger if exists commerce_orders_set_updated_at on assets.commerce_orders;
create trigger commerce_orders_set_updated_at
  before update on assets.commerce_orders
  for each row execute function assets.set_updated_at();

drop trigger if exists asset_licenses_set_updated_at on assets.asset_licenses;
create trigger asset_licenses_set_updated_at
  before update on assets.asset_licenses
  for each row execute function assets.set_updated_at();

drop trigger if exists report_configs_set_updated_at on assets.report_configs;
create trigger report_configs_set_updated_at
  before update on assets.report_configs
  for each row execute function assets.set_updated_at();

alter table assets.asset_events enable row level security;
alter table assets.search_events enable row level security;
alter table assets.portal_visits enable row level security;
alter table assets.commerce_orders enable row level security;
alter table assets.asset_licenses enable row level security;
alter table assets.report_configs enable row level security;
alter table assets.report_exports enable row level security;

drop policy if exists asset_events_demo_all on assets.asset_events;
create policy asset_events_demo_all on assets.asset_events
  for all to anon, authenticated using (true) with check (true);

drop policy if exists search_events_demo_all on assets.search_events;
create policy search_events_demo_all on assets.search_events
  for all to anon, authenticated using (true) with check (true);

drop policy if exists portal_visits_demo_all on assets.portal_visits;
create policy portal_visits_demo_all on assets.portal_visits
  for all to anon, authenticated using (true) with check (true);

drop policy if exists commerce_orders_demo_all on assets.commerce_orders;
create policy commerce_orders_demo_all on assets.commerce_orders
  for all to anon, authenticated using (true) with check (true);

drop policy if exists asset_licenses_demo_all on assets.asset_licenses;
create policy asset_licenses_demo_all on assets.asset_licenses
  for all to anon, authenticated using (true) with check (true);

drop policy if exists report_configs_demo_all on assets.report_configs;
create policy report_configs_demo_all on assets.report_configs
  for all to anon, authenticated using (true) with check (true);

drop policy if exists report_exports_demo_all on assets.report_exports;
create policy report_exports_demo_all on assets.report_exports
  for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists report_exports_demo_all on assets.report_exports;
drop policy if exists report_configs_demo_all on assets.report_configs;
drop policy if exists asset_licenses_demo_all on assets.asset_licenses;
drop policy if exists commerce_orders_demo_all on assets.commerce_orders;
drop policy if exists portal_visits_demo_all on assets.portal_visits;
drop policy if exists search_events_demo_all on assets.search_events;
drop policy if exists asset_events_demo_all on assets.asset_events;
drop index if exists assets.report_exports_project_idx;
drop index if exists assets.report_configs_project_idx;
drop index if exists assets.asset_licenses_expiry_idx;
drop index if exists assets.asset_licenses_project_idx;
drop index if exists assets.commerce_orders_project_idx;
drop index if exists assets.portal_visits_asset_idx;
drop index if exists assets.portal_visits_project_idx;
drop index if exists assets.search_events_project_idx;
drop index if exists assets.asset_events_asset_idx;
drop index if exists assets.asset_events_project_idx;
drop table if exists assets.report_exports;
drop table if exists assets.report_configs;
drop table if exists assets.asset_licenses;
drop table if exists assets.commerce_orders;
drop table if exists assets.portal_visits;
drop table if exists assets.search_events;
drop table if exists assets.asset_events;
