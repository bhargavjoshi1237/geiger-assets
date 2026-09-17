-- Project settings + custom metadata fields for Geiger Assets.
--
-- Shape (two tables, each serving exactly one read):
--   assets.project_settings   one row per project (unique project_id): workspace
--                             identity (name, description, slug, locale,
--                             timezone, default visibility, archive marker) as
--                             real columns, plus a metadata bag for every other
--                             settings-screen value (connectivity, add-ons,
--                             quotas, retention, session policy, SSO/SCIM, …).
--                             The settings screens read a single row by
--                             project_id — no aggregation at read time. A new
--                             toggle never needs a migration; promote a key to
--                             a real column once it needs indexing or a check.
--   assets.custom_fields      per-project metadata field definitions: display
--                             name, machine key, type, required flag, default,
--                             select options as jsonb, scoped asset types as a
--                             text array (empty = all types), manual position,
--                             and soft delete. The custom-fields editor reads
--                             one project's rows ordered by position.
--
-- Singleton writes go through an upsert on project_id (see
-- lib/supabase/settings.js), so the unique constraint below is load-bearing.
--
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create table if not exists assets.project_settings (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  name               text not null default '',
  description        text not null default '',
  slug               text not null default '',
  default_locale     text not null default 'en',
  timezone           text not null default 'UTC',
  default_visibility text not null default 'private',
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  metadata           jsonb not null default '{}'::jsonb,
  constraint project_settings_project_uniq unique (project_id),
  constraint project_settings_visibility_chk check (default_visibility in ('private', 'shared', 'public'))
);

create table if not exists assets.custom_fields (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  name          text not null default '',
  key           text not null default '',
  type          text not null default 'text',
  required      boolean not null default false,
  default_value text not null default '',
  options       jsonb not null default '[]'::jsonb,
  asset_types   text[] not null default '{}'::text[],
  position      integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  metadata      jsonb not null default '{}'::jsonb,
  constraint custom_fields_key_chk check (char_length(key) > 0),
  constraint custom_fields_type_chk check (type in ('text', 'textarea', 'number', 'boolean', 'date', 'select', 'multiselect', 'url'))
);

grant all on assets.project_settings to anon, authenticated, service_role;
grant all on assets.custom_fields to anon, authenticated, service_role;

-- Singleton read: single-row lookup via the unique(project_id) index.
-- Field editor: one project's live rows in manual order.
create index if not exists custom_fields_project_idx
  on assets.custom_fields (project_id, position) where deleted_at is null;

drop trigger if exists project_settings_set_updated_at on assets.project_settings;
create trigger project_settings_set_updated_at
  before update on assets.project_settings
  for each row execute function assets.set_updated_at();

drop trigger if exists custom_fields_set_updated_at on assets.custom_fields;
create trigger custom_fields_set_updated_at
  before update on assets.custom_fields
  for each row execute function assets.set_updated_at();

alter table assets.project_settings enable row level security;
alter table assets.custom_fields enable row level security;

drop policy if exists project_settings_demo_all on assets.project_settings;
create policy project_settings_demo_all on assets.project_settings
  for all to anon, authenticated using (true) with check (true);

drop policy if exists custom_fields_demo_all on assets.custom_fields;
create policy custom_fields_demo_all on assets.custom_fields
  for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists custom_fields_demo_all on assets.custom_fields;
drop policy if exists project_settings_demo_all on assets.project_settings;
drop index if exists assets.custom_fields_project_idx;
drop table if exists assets.custom_fields;
drop table if exists assets.project_settings;
