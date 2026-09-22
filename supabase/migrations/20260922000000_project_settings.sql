-- Project settings — one row per project for the Settings area.
--
-- Owns assets.project_settings: promoted columns for General (visibility,
-- region, default page size, default tab) and Usage & Storage limits
-- (quota, upload cap, retention), plus the metadata expansion bag for the
-- section prefs ({ addons, security, advanced, variables, allowedFileTypes,
-- brandKit, watermarks, contactSheets }). The assets.project_merge_settings()
-- RPC shallow-merges a patch so one settings tab never clobbers another.
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

create table if not exists assets.project_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,

  -- General
  visibility text not null default 'private'
    check (visibility in ('private', 'internal', 'public')),
  region text not null default 'us-east-1',
  default_page_size integer not null default 25,
  default_tab text not null default 'Overview',

  -- Usage & Storage limits
  storage_quota_gb numeric not null default 500,
  max_upload_mb integer not null default 2048,
  trash_retention_days integer not null default 30,
  auto_archive_days integer not null default 0,
  quota_alert_percent integer not null default 80,

  -- Expansion bag: { addons, security, advanced, variables, allowedFileTypes,
  -- brandKit, watermarks, contactSheets }
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists project_settings_project_idx
  on assets.project_settings (project_id)
  where deleted_at is null;

drop trigger if exists project_settings_touch_updated_at on assets.project_settings;
create trigger project_settings_touch_updated_at
  before update on assets.project_settings
  for each row execute function assets.touch_updated_at();

grant all on assets.project_settings to anon, authenticated, service_role;

alter table assets.project_settings enable row level security;

drop policy if exists project_settings_demo_all on assets.project_settings;
create policy project_settings_demo_all on assets.project_settings
  for all to anon, authenticated using (true) with check (true);

-- Shallow-merge a patch into the metadata bag, creating the row when absent.
-- One settings tab writes only its own keys, so concurrent tabs never clobber
-- each other the way a full-row upsert would.
create or replace function assets.project_merge_settings(p_project_id uuid, p_patch jsonb)
returns assets.project_settings
language plpgsql
as $function$
declare result assets.project_settings;
begin
  insert into assets.project_settings (project_id, metadata)
  values (p_project_id, coalesce(p_patch, '{}'::jsonb))
  on conflict (project_id)
  do update set metadata = assets.project_settings.metadata || excluded.metadata,
                updated_at = now()
  returning * into result;
  return result;
end;
$function$;

-- @down
drop function if exists assets.project_merge_settings(uuid, jsonb);
drop table if exists assets.project_settings;
