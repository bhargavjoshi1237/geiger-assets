-- Outbound webhooks for asset lifecycle events.
--
-- Shape (two tables, each serving exactly one read):
--   assets.webhook_endpoints  one row per subscriber URL: project scope, target
--                           url, HMAC secret, subscribed events as a text array
--                           (a new event never needs a migration), active flag,
--                           and soft delete. The dispatch fan-out is a single
--                           lookup by project_id filtered on active + events.
--   assets.webhook_deliveries append-only log of every attempt: endpoint, event,
--                           JSON envelope, status, attempt count, response code,
--                           and next_retry_at. The retry sweep scans the
--                           (status, next_retry_at) composite, so a due-delivery
--                           query touches only retryable rows, never a full scan.
--
-- Delivery vs log: dispatch inserts one delivery row per endpoint and attempts
-- the POST outside any asset transaction, so a slow or dead receiver can never
-- block a commit. Failures reschedule with exponential backoff; successes mark
-- delivered_at. URL safety (https-only, private-range rejection, no redirects)
-- is enforced in JS before every fetch — the DB stores the URL, it does not
-- validate it.
--
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create table if not exists assets.webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  url         text not null,
  secret      text not null,
  events      text[] not null default '{}'::text[],
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  metadata    jsonb not null default '{}'::jsonb,
  constraint webhook_endpoints_url_chk check (char_length(url) > 0 and char_length(url) <= 2048)
);

create table if not exists assets.webhook_deliveries (
  id            uuid primary key default gen_random_uuid(),
  endpoint_id   uuid not null references assets.webhook_endpoints(id) on delete cascade,
  event         text not null,
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'pending',
  attempts      integer not null default 0,
  response_code integer,
  error         text,
  next_retry_at timestamptz,
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz,
  constraint webhook_deliveries_status_chk check (status in ('pending', 'delivered', 'failed')),
  constraint webhook_deliveries_attempts_chk check (attempts >= 0)
);

grant all on assets.webhook_endpoints to anon, authenticated, service_role;
grant all on assets.webhook_deliveries to anon, authenticated, service_role;

-- Dispatch fan-out: active endpoints of one project.
-- Retry sweep: pending rows whose backoff has elapsed.
create index if not exists webhook_endpoints_project_idx
  on assets.webhook_endpoints (project_id) where deleted_at is null;
create index if not exists webhook_deliveries_retry_idx
  on assets.webhook_deliveries (status, next_retry_at);
create index if not exists webhook_deliveries_endpoint_idx
  on assets.webhook_deliveries (endpoint_id, created_at desc);

drop trigger if exists webhook_endpoints_set_updated_at on assets.webhook_endpoints;
create trigger webhook_endpoints_set_updated_at
  before update on assets.webhook_endpoints
  for each row execute function assets.set_updated_at();

alter table assets.webhook_endpoints enable row level security;
alter table assets.webhook_deliveries enable row level security;

drop policy if exists webhook_endpoints_demo_all on assets.webhook_endpoints;
create policy webhook_endpoints_demo_all on assets.webhook_endpoints
  for all to anon, authenticated using (true) with check (true);

drop policy if exists webhook_deliveries_demo_all on assets.webhook_deliveries;
create policy webhook_deliveries_demo_all on assets.webhook_deliveries
  for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists webhook_deliveries_demo_all on assets.webhook_deliveries;
drop policy if exists webhook_endpoints_demo_all on assets.webhook_endpoints;
drop index if exists assets.webhook_deliveries_endpoint_idx;
drop index if exists assets.webhook_deliveries_retry_idx;
drop index if exists assets.webhook_endpoints_project_idx;
drop table if exists assets.webhook_deliveries;
drop table if exists assets.webhook_endpoints;
