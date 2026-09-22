-- Workflows — automation engine for Geiger Assets.
--
-- Owns assets.workflows: an automation is a `trigger` (an asset lifecycle
-- action such as "asset.uploaded") feeding an ordered chain of
-- condition/action `steps`. `steps` is the canonical logic; `graph` carries
-- the drag-drop canvas layout (node positions + connectors) over the same
-- steps. Scope is workspace-wide or pinned to one collection.
-- Self-contained + idempotent: safe to re-run. Follows suite conventions
-- (uuid pk, project_id scoping, metadata bag, touch_updated_at, demo-open RLS).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create table if not exists assets.workflows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  collection_id uuid references assets.collections(id) on delete cascade,
  name text not null default 'Untitled workflow',
  description text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Active', 'Paused')),
  trigger text not null default '',
  scope text not null default 'workspace' check (scope in ('workspace', 'collection')),
  steps jsonb not null default '[]'::jsonb,
  graph jsonb not null default '{}'::jsonb,
  view_mode text not null default 'list' check (view_mode in ('list', 'canvas')),
  run_count integer not null default 0,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table assets.workflows add column if not exists collection_id uuid references assets.collections(id) on delete cascade;

create index if not exists workflows_project_idx on assets.workflows (project_id) where deleted_at is null;
create index if not exists workflows_status_idx on assets.workflows (status) where deleted_at is null;
create index if not exists workflows_collection_idx on assets.workflows (collection_id) where deleted_at is null;
create index if not exists workflows_created_idx on assets.workflows (created_at desc);

drop trigger if exists workflows_touch_updated_at on assets.workflows;
create trigger workflows_touch_updated_at
  before update on assets.workflows
  for each row execute function assets.touch_updated_at();

alter table assets.workflows enable row level security;

drop policy if exists workflows_demo_all on assets.workflows;
create policy workflows_demo_all on assets.workflows for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists workflows_demo_all on assets.workflows;
drop table if exists assets.workflows;
