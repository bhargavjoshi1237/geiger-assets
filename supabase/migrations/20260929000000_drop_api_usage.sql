-- Platform — stop recording API usage.
--
-- assets.api_usage was a per-request ledger (every keyed API call and dynamic
-- render). Nothing writes or reads it any more, and the monthly transform
-- budget it fed is gone with it, so the table and the budget column are
-- dropped. API keys keep their own last_used_at stamp.
--
-- Self-contained + idempotent: safe to re-run.

-- @up
drop table if exists assets.api_usage;
alter table assets.delivery_settings drop column if exists monthly_transform_budget;

-- @down
alter table assets.delivery_settings
  add column if not exists monthly_transform_budget integer not null default 100000;

create table if not exists assets.api_usage (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  api_key_id uuid references assets.api_keys(id) on delete set null,
  route text not null default '',
  method text not null default '',
  status integer not null default 200,
  kind text not null default 'api' check (kind in ('api', 'transform', 'delivery')),
  asset_id uuid references assets.assets(id) on delete set null,
  transforms integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists api_usage_project_idx
  on assets.api_usage (project_id, created_at desc);
create index if not exists api_usage_key_idx
  on assets.api_usage (api_key_id, created_at desc);
create index if not exists api_usage_kind_idx
  on assets.api_usage (project_id, kind, created_at desc);

drop trigger if exists api_usage_touch_updated_at on assets.api_usage;
create trigger api_usage_touch_updated_at before update on assets.api_usage
  for each row execute function assets.touch_updated_at();

alter table assets.api_usage enable row level security;
drop policy if exists api_usage_demo_all on assets.api_usage;
create policy api_usage_demo_all on assets.api_usage
  for all to anon, authenticated using (true) with check (true);
