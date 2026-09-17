-- Platform domain for Geiger Assets: third-party integrations + data-job history.
--
-- Shape (two tables, each serving exactly one read):
--   assets.integrations   one row per connected service per project
--                         (unique project_id + key): catalog key, category,
--                         lifecycle status, provider config as jsonb (API keys
--                         and tokens live here as write-only values — reads are
--                         masked in the UI, never shown back), last sync marker,
--                         and soft delete. The integrations screen reads one
--                         project's live rows and merges them over its static
--                         catalog. A new service never needs a migration.
--   assets.data_jobs      append-mostly run history for CSV/JSON imports and
--                         exports: kind, format, lifecycle status, source file
--                         name, the source-column → asset-field mapping as
--                         jsonb, row counters, and a terminal error. The import/
--                         export screen reads one project's recent runs newest
--                         first.
--
-- Webhook endpoints and deliveries are NOT created here — they already live in
-- assets.webhook_endpoints / assets.webhook_deliveries
-- (20260917000001_webhooks.sql). lib/supabase/platform.js only reads the
-- deliveries log; endpoint CRUD stays behind /api/webhooks/endpoints.
--
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create table if not exists assets.integrations (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  key          text not null default '',
  category     text not null default '',
  status       text not null default 'disconnected',
  config       jsonb not null default '{}'::jsonb,
  created_by   uuid references auth.users(id) on delete set null,
  last_sync_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  metadata     jsonb not null default '{}'::jsonb,
  constraint integrations_project_key_uniq unique (project_id, key),
  constraint integrations_key_chk check (char_length(key) > 0),
  constraint integrations_status_chk check (status in ('connected', 'paused', 'error', 'disconnected'))
);

create table if not exists assets.data_jobs (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  kind           text not null default 'import',
  format         text not null default 'csv',
  status         text not null default 'pending',
  source_name    text not null default '',
  mapping        jsonb not null default '{}'::jsonb,
  total_rows     integer not null default 0,
  processed_rows integer not null default 0,
  error          text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  metadata       jsonb not null default '{}'::jsonb,
  constraint data_jobs_kind_chk check (kind in ('import', 'export')),
  constraint data_jobs_format_chk check (format in ('csv', 'json')),
  constraint data_jobs_status_chk check (status in ('pending', 'running', 'completed', 'failed')),
  constraint data_jobs_rows_chk check (total_rows >= 0 and processed_rows >= 0)
);

grant all on assets.integrations to anon, authenticated, service_role;
grant all on assets.data_jobs to anon, authenticated, service_role;

-- Project integrations lookup; job history reads one project's recent runs.
create index if not exists integrations_project_idx
  on assets.integrations (project_id) where deleted_at is null;
create index if not exists data_jobs_project_idx
  on assets.data_jobs (project_id, created_at desc) where deleted_at is null;

drop trigger if exists integrations_set_updated_at on assets.integrations;
create trigger integrations_set_updated_at
  before update on assets.integrations
  for each row execute function assets.set_updated_at();

drop trigger if exists data_jobs_set_updated_at on assets.data_jobs;
create trigger data_jobs_set_updated_at
  before update on assets.data_jobs
  for each row execute function assets.set_updated_at();

alter table assets.integrations enable row level security;
alter table assets.data_jobs enable row level security;

drop policy if exists integrations_demo_all on assets.integrations;
create policy integrations_demo_all on assets.integrations
  for all to anon, authenticated using (true) with check (true);

drop policy if exists data_jobs_demo_all on assets.data_jobs;
create policy data_jobs_demo_all on assets.data_jobs
  for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists data_jobs_demo_all on assets.data_jobs;
drop policy if exists integrations_demo_all on assets.integrations;
drop index if exists assets.data_jobs_project_idx;
drop index if exists assets.integrations_project_idx;
drop table if exists assets.data_jobs;
drop table if exists assets.integrations;
