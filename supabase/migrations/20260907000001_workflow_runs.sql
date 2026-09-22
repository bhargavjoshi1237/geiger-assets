-- Workflow runs — execution log for Geiger Assets automations.
--
-- Owns assets.workflow_runs: one row per workflow execution with the trigger
-- that fired, its status, timing, and a per-step log. Empty until an
-- execution runner lands — Run History reads it and renders its empty state.
-- Self-contained + idempotent: safe to re-run. Follows suite conventions
-- (uuid pk, project_id scoping, metadata bag, touch_updated_at, demo-open RLS).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create table if not exists assets.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references assets.workflows(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  trigger text not null default '',
  status text not null default 'Success' check (status in ('Success', 'Failed', 'Running', 'Skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer not null default 0,
  steps_total integer not null default 0,
  steps_completed integer not null default 0,
  error text,
  context jsonb not null default '{}'::jsonb,
  steps_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists workflow_runs_workflow_idx on assets.workflow_runs (workflow_id);
create index if not exists workflow_runs_project_idx on assets.workflow_runs (project_id);
create index if not exists workflow_runs_started_idx on assets.workflow_runs (started_at desc);
create index if not exists workflow_runs_status_idx on assets.workflow_runs (status);

drop trigger if exists workflow_runs_touch_updated_at on assets.workflow_runs;
create trigger workflow_runs_touch_updated_at
  before update on assets.workflow_runs
  for each row execute function assets.touch_updated_at();

alter table assets.workflow_runs enable row level security;

drop policy if exists workflow_runs_demo_all on assets.workflow_runs;
create policy workflow_runs_demo_all on assets.workflow_runs for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists workflow_runs_demo_all on assets.workflow_runs;
drop table if exists assets.workflow_runs;
