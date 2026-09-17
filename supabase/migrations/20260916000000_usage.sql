-- Storage/bandwidth metering for Geiger Assets.
--
-- Shape (two tables, each serving exactly one read):
--   assets.project_usage    one rollup row per project (unique project_id): bytes
--                           stored + object count for the dashboard, plus lifetime
--                           served-bytes / served-events counters for billing. The
--                           dashboard and the quota check are a single-row lookup
--                           by project_id — no aggregation at read time.
--   assets.delivery_events  append-only log of every delivery: project, asset,
--                           variant (negotiated encoding as free text, so a new
--                           encoding never needs a migration), bytes served, and
--                           event time. A daily series aggregates served_at through
--                           the (project_id, served_at) composite index, so a
--                           day-range query touches only that project's window,
--                           never a full scan.
--
-- Rollup accuracy without a recount on every write: the hot path never scans.
-- record_delivery_event() inserts the event and bumps the rollup's served_*
-- counters in the same transaction (one RPC from the delivery path), and
-- adjust_project_usage() applies signed storage deltas (upload / delete / size
-- change) as an atomic upsert clamped at zero. recompute_project_usage() is the
-- cold repair path: it recounts stored_* for ONE project from assets.assets
-- (live rows only) and upserts just those columns. Served counters are
-- write-once increments owned by the hot path — recompute never touches them,
-- which is exactly what keeps it safe to run after a retention purge.
--
-- Retention: delivery_events is bounded by purge_delivery_events(days), default
-- 90 days of raw per-delivery detail for daily series. The purge is lossless
-- for billing because lifetime served totals already live on the rollup row
-- (folded in at insert time, never recomputed from the log) — only old
-- per-day / per-asset granularity expires. asset_id is ON DELETE SET NULL (not
-- cascade) so deleting an asset never erases its billed bytes; project_id
-- cascades like every other assets.* table. The log has no updated_at and no
-- soft-delete column: rows are immutable, expiry is a hard delete by served_at.
--
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create table if not exists assets.project_usage (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  stored_bytes        bigint not null default 0,
  stored_objects      integer not null default 0,
  served_bytes_total  bigint not null default 0,
  served_events_total bigint not null default 0,
  last_recomputed_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  metadata            jsonb not null default '{}'::jsonb,
  constraint project_usage_project_uniq unique (project_id),
  constraint project_usage_stored_bytes_chk check (stored_bytes >= 0),
  constraint project_usage_stored_objects_chk check (stored_objects >= 0),
  constraint project_usage_served_bytes_chk check (served_bytes_total >= 0),
  constraint project_usage_served_events_chk check (served_events_total >= 0)
);

create table if not exists assets.delivery_events (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  asset_id     uuid references assets.assets(id) on delete set null,
  variant      text not null default '',
  bytes_served bigint not null default 0,
  served_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  metadata     jsonb not null default '{}'::jsonb,
  constraint delivery_events_bytes_chk check (bytes_served >= 0)
);

grant all on assets.project_usage to anon, authenticated, service_role;
grant all on assets.delivery_events to anon, authenticated, service_role;

-- Dashboard/quota read: single-row lookup via the unique(project_id) index.
-- Daily series: project_id equality + served_at range through this composite,
-- so aggregation scans only that project's window.
create index if not exists delivery_events_project_time_idx
  on assets.delivery_events (project_id, served_at desc);

drop trigger if exists project_usage_set_updated_at on assets.project_usage;
create trigger project_usage_set_updated_at
  before update on assets.project_usage
  for each row execute function assets.set_updated_at();

alter table assets.project_usage enable row level security;
alter table assets.delivery_events enable row level security;

drop policy if exists project_usage_demo_all on assets.project_usage;
create policy project_usage_demo_all on assets.project_usage
  for all to anon, authenticated using (true) with check (true);

drop policy if exists delivery_events_demo_all on assets.delivery_events;
create policy delivery_events_demo_all on assets.delivery_events
  for all to anon, authenticated using (true) with check (true);

-- Hot path: atomic signed-delta upsert. Storage writers (upload / delete /
-- size change) and backfills adjust the rollup without scanning anything;
-- every counter is clamped at zero so a double-delete can never drive it
-- negative. Returns the resulting rollup row.
create or replace function assets.adjust_project_usage(
  p_project_id uuid,
  p_stored_bytes_delta bigint default 0,
  p_stored_objects_delta integer default 0,
  p_served_bytes_delta bigint default 0,
  p_served_events_delta bigint default 0
)
returns assets.project_usage
language plpgsql
set search_path = assets
as $$
declare
  v_row assets.project_usage%ROWTYPE;
begin
  if p_project_id is null then
    return null;
  end if;
  insert into assets.project_usage as pu
    (project_id, stored_bytes, stored_objects, served_bytes_total, served_events_total)
  values (
    p_project_id,
    greatest(coalesce(p_stored_bytes_delta, 0), 0),
    greatest(coalesce(p_stored_objects_delta, 0), 0),
    greatest(coalesce(p_served_bytes_delta, 0), 0),
    greatest(coalesce(p_served_events_delta, 0), 0)
  )
  on conflict (project_id) do update set
    stored_bytes = greatest(pu.stored_bytes + coalesce(p_stored_bytes_delta, 0), 0),
    stored_objects = greatest(pu.stored_objects + coalesce(p_stored_objects_delta, 0), 0),
    served_bytes_total = greatest(pu.served_bytes_total + coalesce(p_served_bytes_delta, 0), 0),
    served_events_total = greatest(pu.served_events_total + coalesce(p_served_events_delta, 0), 0),
    updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

-- Cold repair path: recount stored_* for ONE project from the live asset rows
-- and upsert just those columns (plus last_recomputed_at). Served counters are
-- deliberately untouched — they are lifetime increments, not derivable from a
-- retention-bounded log. Returns the resulting rollup row.
create or replace function assets.recompute_project_usage(p_project_id uuid)
returns assets.project_usage
language plpgsql
set search_path = assets
as $$
declare
  v_stored_bytes bigint := 0;
  v_stored_objects integer := 0;
  v_row assets.project_usage%ROWTYPE;
begin
  if p_project_id is null then
    return null;
  end if;
  select coalesce(sum(size_bytes), 0)::bigint, count(*)::integer
    into v_stored_bytes, v_stored_objects
    from assets.assets
    where project_id = p_project_id
      and deleted_at is null;
  insert into assets.project_usage as pu
    (project_id, stored_bytes, stored_objects, last_recomputed_at)
  values (p_project_id, v_stored_bytes, v_stored_objects, now())
  on conflict (project_id) do update set
    stored_bytes = excluded.stored_bytes,
    stored_objects = excluded.stored_objects,
    last_recomputed_at = excluded.last_recomputed_at,
    updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

-- Delivery hot path: append the event and fold its bytes into the rollup's
-- lifetime served counters in one transaction, so the log and the rollup can
-- never disagree. Returns the inserted event row.
create or replace function assets.record_delivery_event(
  p_project_id uuid,
  p_asset_id uuid,
  p_variant text,
  p_bytes_served bigint
)
returns assets.delivery_events
language plpgsql
set search_path = assets
as $$
declare
  v_bytes bigint := greatest(coalesce(p_bytes_served, 0), 0);
  v_row assets.delivery_events%ROWTYPE;
begin
  if p_project_id is null then
    return null;
  end if;
  insert into assets.delivery_events (project_id, asset_id, variant, bytes_served)
  values (p_project_id, p_asset_id, coalesce(p_variant, ''), v_bytes)
  returning * into v_row;
  insert into assets.project_usage as pu
    (project_id, served_bytes_total, served_events_total)
  values (p_project_id, v_bytes, 1)
  on conflict (project_id) do update set
    served_bytes_total = pu.served_bytes_total + v_bytes,
    served_events_total = pu.served_events_total + 1,
    updated_at = now();
  return v_row;
end;
$$;

-- Retention: hard-delete raw events older than the window (default 90 days).
-- Billable lifetime totals survive on the rollup row, so only per-day /
-- per-asset granularity expires. A NULL or non-positive window keeps
-- everything (never wipe recent history on a bad argument). Returns rows
-- deleted so a scheduled job can log it.
create or replace function assets.purge_delivery_events(p_retention_days integer default 90)
returns integer
language plpgsql
set search_path = assets
as $$
declare
  v_deleted integer := 0;
begin
  if p_retention_days is null or p_retention_days <= 0 then
    return 0;
  end if;
  delete from assets.delivery_events
  where served_at < now() - make_interval(days => p_retention_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function assets.adjust_project_usage(uuid, bigint, integer, bigint, bigint)
  to anon, authenticated, service_role;
grant execute on function assets.recompute_project_usage(uuid)
  to anon, authenticated, service_role;
grant execute on function assets.record_delivery_event(uuid, uuid, text, bigint)
  to anon, authenticated, service_role;
grant execute on function assets.purge_delivery_events(integer)
  to anon, authenticated, service_role;

-- @down
revoke execute on function assets.purge_delivery_events(integer)
  from anon, authenticated, service_role;
revoke execute on function assets.record_delivery_event(uuid, uuid, text, bigint)
  from anon, authenticated, service_role;
revoke execute on function assets.recompute_project_usage(uuid)
  from anon, authenticated, service_role;
revoke execute on function assets.adjust_project_usage(uuid, bigint, integer, bigint, bigint)
  from anon, authenticated, service_role;
drop function if exists assets.purge_delivery_events(integer);
drop function if exists assets.record_delivery_event(uuid, uuid, text, bigint);
drop function if exists assets.recompute_project_usage(uuid);
drop function if exists assets.adjust_project_usage(uuid, bigint, integer, bigint, bigint);
drop policy if exists delivery_events_demo_all on assets.delivery_events;
drop policy if exists project_usage_demo_all on assets.project_usage;
drop index if exists assets.delivery_events_project_time_idx;
drop table if exists assets.delivery_events;
drop table if exists assets.project_usage;
