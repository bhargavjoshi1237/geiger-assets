-- Platform delivery + public API keys.
--
-- Owns assets.api_keys, assets.delivery_settings, assets.api_usage and the
-- assets.assets.delivery_enabled opt-in flag.
--
-- Self-contained + idempotent: safe to re-run. Follows suite conventions
-- (uuid pk, project_id scoping, metadata bag, touch_updated_at, demo-open RLS).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create or replace function assets.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Opt-in flag: delivery is OFF unless enabled in the asset Delivery section.
alter table assets.assets
  add column if not exists delivery_enabled boolean not null default false;

create index if not exists assets_delivery_enabled_idx
  on assets.assets (project_id) where deleted_at is null and delivery_enabled = true;

-- API keys ---------------------------------------------------------------

create table if not exists assets.api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default '',
  prefix text not null default '',
  key_hash text not null default '',
  scopes text[] not null default '{}'::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists api_keys_hash_key
  on assets.api_keys (key_hash) where key_hash <> '';
create index if not exists api_keys_project_idx
  on assets.api_keys (project_id) where deleted_at is null;
create index if not exists api_keys_prefix_idx
  on assets.api_keys (prefix) where deleted_at is null;

-- Per-project delivery policy. OPEN by default, bounded by the limits below;
-- URL signing is opt-in (require_signed_urls defaults false).
create table if not exists assets.delivery_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid unique references public.projects(id) on delete cascade,
  max_width integer not null default 4000,
  max_height integer not null default 4000,
  max_megapixels numeric not null default 25,
  allowed_formats text[] not null default '{auto,webp,avif,jpg,png}'::text[],
  allowed_effects text[] not null default '{blur,sharpen,grayscale,sepia,negate,brightness,contrast,saturation,tint}'::text[],
  referrer_allowlist text[] not null default '{}'::text[],
  monthly_transform_budget integer not null default 100000,
  require_signed_urls boolean not null default false,
  signing_secret text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists delivery_settings_project_idx
  on assets.delivery_settings (project_id);

-- Usage ledger: one row per API call / delivery transform.
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

-- Triggers -----------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['api_keys', 'delivery_settings', 'api_usage'] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- RLS ----------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['api_keys', 'delivery_settings', 'api_usage'] loop
    execute format('alter table assets.%I enable row level security', t);
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
    execute format(
      'create policy %I_demo_all on assets.%I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- @down
do $$
declare t text;
begin
  foreach t in array array['api_keys', 'delivery_settings', 'api_usage'] loop
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
  end loop;
end $$;

drop table if exists assets.api_usage;
drop table if exists assets.delivery_settings;
drop table if exists assets.api_keys;
alter table assets.assets drop column if exists delivery_enabled;
