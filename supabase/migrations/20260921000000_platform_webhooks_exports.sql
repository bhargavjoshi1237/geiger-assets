-- Platform — webhooks and data export history.
--
-- Three surfaces, one domain:
--   webhook_endpoints  outbound subscriber URLs + per-endpoint event subscriptions
--   webhook_deliveries append-only log of delivery attempts (test sends included)
--   export_runs        append-only history of inline CSV / JSON / ZIP exports
--
-- Deliveries and export runs are append-only: they carry created_at and no
-- deleted_at, because log rows are never soft-deleted. There is no sender or
-- job runner yet — rows in webhook_deliveries sit at status 'queued' until a
-- delivery worker exists, and export_runs rows are written by the screen after
-- an inline run completes.
--
-- Self-contained + idempotent: safe to re-run. Follows suite conventions
-- (uuid pk, project_id scoping, metadata bag, touch_updated_at, demo-open RLS).

-- @up
create extension if not exists pgcrypto;

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

-- ---------------------------------------------------------------------------
-- Webhook endpoints — where event notifications go, and which events each
-- endpoint asked for. `events` holds catalog keys (see platform/constants.js);
-- `signing_secret` is the HMAC secret a receiver uses to verify payloads.
-- ---------------------------------------------------------------------------
create table if not exists assets.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled endpoint',
  url text not null default '',
  description text not null default '',
  events text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'paused')),
  signing_secret text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists webhook_endpoints_project_idx on assets.webhook_endpoints (project_id) where deleted_at is null;
create index if not exists webhook_endpoints_status_idx on assets.webhook_endpoints (status) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Webhook deliveries — append-only attempt log. A test send from the UI writes
-- a row at status 'queued' with attempt_count 0 and no response code; nothing
-- delivers it until a worker exists, which is why Replay stays disabled.
-- ---------------------------------------------------------------------------
create table if not exists assets.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  endpoint_id uuid references assets.webhook_endpoints(id) on delete cascade,
  event text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'delivered', 'failed')),
  attempt_count integer not null default 0,
  response_code integer,
  error text not null default '',
  duration_ms integer,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists webhook_deliveries_project_idx on assets.webhook_deliveries (project_id, created_at desc);
create index if not exists webhook_deliveries_endpoint_idx on assets.webhook_deliveries (endpoint_id, created_at desc);
create index if not exists webhook_deliveries_status_idx on assets.webhook_deliveries (status);

-- ---------------------------------------------------------------------------
-- Export runs — append-only history of inline exports. The screen writes a row
-- after the CSV / JSON / ZIP route finishes, with the real file count and byte
-- total (or status 'failed' and the error when the route fails).
-- ---------------------------------------------------------------------------
create table if not exists assets.export_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  format text not null default 'csv' check (format in ('csv', 'json', 'zip')),
  scope_type text not null default 'project' check (scope_type in ('project', 'collection', 'folder', 'filter')),
  scope_id uuid,
  scope_label text not null default '',
  options jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  file_count integer not null default 0,
  total_bytes bigint not null default 0,
  error text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists export_runs_project_idx on assets.export_runs (project_id, created_at desc);
create index if not exists export_runs_format_idx on assets.export_runs (format);

-- ---------------------------------------------------------------------------
-- Triggers, grants, RLS
-- ---------------------------------------------------------------------------
drop trigger if exists webhook_endpoints_touch_updated_at on assets.webhook_endpoints;
create trigger webhook_endpoints_touch_updated_at
  before update on assets.webhook_endpoints
  for each row execute function assets.touch_updated_at();

grant all on assets.webhook_endpoints to anon, authenticated, service_role;
grant all on assets.webhook_deliveries to anon, authenticated, service_role;
grant all on assets.export_runs to anon, authenticated, service_role;

alter table assets.webhook_endpoints enable row level security;
alter table assets.webhook_deliveries enable row level security;
alter table assets.export_runs enable row level security;

drop policy if exists webhook_endpoints_demo_all on assets.webhook_endpoints;
create policy webhook_endpoints_demo_all on assets.webhook_endpoints for all to anon, authenticated using (true) with check (true);

drop policy if exists webhook_deliveries_demo_all on assets.webhook_deliveries;
create policy webhook_deliveries_demo_all on assets.webhook_deliveries for all to anon, authenticated using (true) with check (true);

drop policy if exists export_runs_demo_all on assets.export_runs;
create policy export_runs_demo_all on assets.export_runs for all to anon, authenticated using (true) with check (true);

-- @down
drop table if exists assets.export_runs;
drop table if exists assets.webhook_deliveries;
drop table if exists assets.webhook_endpoints;
