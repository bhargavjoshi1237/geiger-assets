-- Project-wide delivery switches.
--
-- Adds two columns to assets.delivery_settings, both read by the /d/ route
-- through normalizePolicy():
--
--   transforms_enabled        — gates URL transforms (/d/…/w_800,c_fill/…).
--                               OFF by default: a project serves originals
--                               only until someone opts into the transform
--                               engine, so no project pays sharp CPU by
--                               accident.
--   delivery_default_enabled  — seeds assets.delivery_enabled on newly
--                               uploaded assets. ON by default. This is a
--                               seed, not a gate: the per-asset toggle stays
--                               the single source of truth at serve time.
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

-- The table is created by 20260921000001_platform_delivery.sql; this file only
-- extends it, so it is guarded for the case where that migration ran first on
-- a fresh database and for re-runs on an existing one.
create table if not exists assets.delivery_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid unique references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table assets.delivery_settings
  add column if not exists transforms_enabled boolean not null default false;

alter table assets.delivery_settings
  add column if not exists delivery_default_enabled boolean not null default true;

-- @down
alter table assets.delivery_settings drop column if exists delivery_default_enabled;
alter table assets.delivery_settings drop column if exists transforms_enabled;
