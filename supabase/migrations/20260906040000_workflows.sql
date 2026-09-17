-- Imported from workflows.sql by geiger-orm.
-- No @down section — this migration cannot be rolled back.

-- @up
-- ===========================================================================
-- Geiger Assets — workflows (automation engine) + workflow runs (execution log)
--
-- Ported from Geiger Events (events.workflows / events.workflow_runs) and
-- adapted to the DAM domain. Self-contained and idempotent: safe to run
-- repeatedly. Reuses the shared assets.set_updated_at() trigger function
-- (defined in assets.sql).
--
-- A workflow is an automation: a trigger (a library action such as
-- "asset.uploaded") feeding an ordered chain of condition/action steps.
-- `steps` is the canonical logic; `graph` stores the drag-drop canvas layout
-- (node positions + connectors) over those same steps.
--
-- Domain differences vs events:
--   - scope is 'workspace' (all assets) or 'collection' (one collection),
--     via collection_id (events used event_id).
--   - trigger / condition / action catalog keys are asset-lifecycle keys
--     (see components/internal/screens/projects/workflows/constants.js).
--
-- A run is the outcome of a single workflow execution. There is no execution
-- runner yet, so workflow_runs stays empty until one lands — the Run History
-- screen reads it and renders its empty state.
-- ===========================================================================

create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;
alter default privileges in schema assets grant all on tables to anon, authenticated, service_role;
alter default privileges in schema assets grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema assets grant all on routines to anon, authenticated, service_role;

create table if not exists assets.workflows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled workflow',
  description text,
  -- Draft | Active | Paused
  status text not null default 'Draft',
  -- Trigger catalog key, e.g. 'asset.uploaded' (see workflows/constants.js).
  trigger text,
  -- 'workspace' (listens across the library) or 'collection' (one collection).
  scope text not null default 'workspace',
  -- The collection this workflow is scoped to when scope = 'collection'.
  collection_id uuid references assets.collections(id) on delete cascade,
  -- Canonical ordered/branched logic. Array of step objects:
  --   { id, kind: 'trigger'|'condition'|'action', type, config, position,
  --     next: [...], branches: { yes: [...], no: [...] } }
  steps jsonb not null default '[]'::jsonb,
  -- Canvas layout for the drag-drop view: { nodes, edges, viewport } in
  -- @xyflow/react shape. A presentation layer over `steps`.
  graph jsonb not null default '{}'::jsonb,
  -- Last view the user used in the builder: 'list' | 'canvas'.
  view_mode text not null default 'list',
  -- Display-only run metrics (no execution runner yet).
  run_count integer not null default 0,
  last_run_at timestamptz,
  -- The owner.
  created_by uuid references auth.users(id) on delete set null,
  -- Expansion bag for not-yet-promoted config.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table assets.workflows add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table assets.workflows add column if not exists description text;
alter table assets.workflows add column if not exists trigger text;
alter table assets.workflows add column if not exists scope text not null default 'workspace';
alter table assets.workflows add column if not exists collection_id uuid references assets.collections(id) on delete cascade;
alter table assets.workflows add column if not exists steps jsonb not null default '[]'::jsonb;
alter table assets.workflows add column if not exists graph jsonb not null default '{}'::jsonb;
alter table assets.workflows add column if not exists view_mode text not null default 'list';
alter table assets.workflows add column if not exists run_count integer not null default 0;
alter table assets.workflows add column if not exists last_run_at timestamptz;
alter table assets.workflows add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table assets.workflows add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table assets.workflows add column if not exists deleted_at timestamptz;

drop trigger if exists workflows_set_updated_at on assets.workflows;
create trigger workflows_set_updated_at
before update on assets.workflows
for each row execute function assets.set_updated_at();

create index if not exists workflows_status_idx
  on assets.workflows (status) where deleted_at is null;
create index if not exists workflows_created_idx
  on assets.workflows (created_at desc);
create index if not exists workflows_collection_idx
  on assets.workflows (collection_id) where deleted_at is null;
create index if not exists workflows_project_idx
  on assets.workflows (project_id) where deleted_at is null;

grant all on assets.workflows to anon, authenticated, service_role;

alter table assets.workflows enable row level security;

drop policy if exists workflows_demo_all on assets.workflows;
create policy workflows_demo_all on assets.workflows
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Workflow runs (execution log)
-- ---------------------------------------------------------------------------

create table if not exists assets.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  -- The workflow that executed. Cascades so a deleted workflow takes its runs.
  workflow_id uuid references assets.workflows(id) on delete cascade,
  -- Project scoping (mirrors the workflows table's project filter).
  project_id uuid references public.projects(id) on delete cascade,
  -- Trigger catalog key that fired this run, e.g. 'asset.uploaded'.
  trigger text,
  -- Success | Failed | Running | Skipped
  status text not null default 'Success',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer not null default 0,
  steps_total integer not null default 0,
  steps_completed integer not null default 0,
  -- First error message when status = 'Failed' (null otherwise).
  error text,
  -- Trigger payload / run context (asset, collection, requester…).
  context jsonb not null default '{}'::jsonb,
  -- Per-step outcome log: [{ label, kind, type, status, durationMs, error }].
  steps_log jsonb not null default '[]'::jsonb,
  -- Expansion bag for not-yet-promoted config.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tolerate older copies of the table by back-filling any missing columns.
alter table assets.workflow_runs add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table assets.workflow_runs add column if not exists trigger text;
alter table assets.workflow_runs add column if not exists status text not null default 'Success';
alter table assets.workflow_runs add column if not exists started_at timestamptz not null default now();
alter table assets.workflow_runs add column if not exists finished_at timestamptz;
alter table assets.workflow_runs add column if not exists duration_ms integer not null default 0;
alter table assets.workflow_runs add column if not exists steps_total integer not null default 0;
alter table assets.workflow_runs add column if not exists steps_completed integer not null default 0;
alter table assets.workflow_runs add column if not exists error text;
alter table assets.workflow_runs add column if not exists context jsonb not null default '{}'::jsonb;
alter table assets.workflow_runs add column if not exists steps_log jsonb not null default '[]'::jsonb;
alter table assets.workflow_runs add column if not exists metadata jsonb not null default '{}'::jsonb;

drop trigger if exists workflow_runs_set_updated_at on assets.workflow_runs;
create trigger workflow_runs_set_updated_at
before update on assets.workflow_runs
for each row execute function assets.set_updated_at();

create index if not exists workflow_runs_workflow_idx
  on assets.workflow_runs (workflow_id);
create index if not exists workflow_runs_project_idx
  on assets.workflow_runs (project_id);
create index if not exists workflow_runs_started_idx
  on assets.workflow_runs (started_at desc);
create index if not exists workflow_runs_status_idx
  on assets.workflow_runs (status);

grant all on assets.workflow_runs to anon, authenticated, service_role;

alter table assets.workflow_runs enable row level security;

drop policy if exists workflow_runs_demo_all on assets.workflow_runs;
create policy workflow_runs_demo_all on assets.workflow_runs
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Demo seed (stable UUIDs; project_id/created_by null). The screens never
-- depend on these — an empty table renders the empty state.
-- ---------------------------------------------------------------------------

insert into assets.workflows (id, name, description, status, trigger, scope, steps, graph, view_mode) values
  ('70000000-0000-4000-8000-000000000001','Auto-tag on upload','Tag every upload with its source and route RAW files for review.','Active','asset.uploaded','workspace',
   '[{"id":"step_seed_1","kind":"trigger","type":"asset.uploaded","config":{},"position":{"x":0,"y":0}},{"id":"step_seed_2","kind":"condition","type":"if.asset_type","config":{"assetType":"RAW"},"position":{"x":0,"y":150}},{"id":"step_seed_3","kind":"action","type":"tag.add","config":{"tag":"needs-review"},"position":{"x":0,"y":300}}]'::jsonb,'{}'::jsonb,'canvas'),
  ('70000000-0000-4000-8000-000000000002','Approval notification','Notify the requester the moment an asset is approved.','Draft','asset.approved','workspace',
   '[{"id":"step_seed_4","kind":"trigger","type":"asset.approved","config":{},"position":{"x":0,"y":0}},{"id":"step_seed_5","kind":"action","type":"send.email","config":{"subject":"Your asset was approved","template":"Approval"},"position":{"x":0,"y":150}}]'::jsonb,'{}'::jsonb,'list'),
  ('70000000-0000-4000-8000-000000000003','License expiry reminder','Warn the team a week before licensed assets expire.','Paused','license.expiring','workspace',
   '[{"id":"step_seed_6","kind":"trigger","type":"license.expiring","config":{},"position":{"x":0,"y":0}},{"id":"step_seed_7","kind":"action","type":"staff.notify","config":{"channel":"#content","message":"Licenses expiring soon — review renewals."},"position":{"x":0,"y":150}}]'::jsonb,'{}'::jsonb,'list')
on conflict (id) do nothing;
