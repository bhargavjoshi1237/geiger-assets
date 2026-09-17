-- Geiger Assets — governance (permissions, identity, retention, legal holds).
--
-- Seven tables, each serving exactly the reads its screen makes:
--   assets.permission_overrides  per-scope allow/deny rows that refine the
--                                workspace roles in public.roles (see
--                                lib/supabase/rbac.js). Scope is one of
--                                workspace|folder|collection|asset|portal|field;
--                                field-level rows name the column in field_name.
--   assets.identity_providers    SSO/SAML/OIDC/SCIM connection records plus
--                                MFA and provisioning flags. Configuration
--                                ONLY — no client secrets, tokens, or
--                                certificates are stored here; those live in
--                                the identity provider itself.
--   assets.retention_policies    retention schedules: how long rows are kept,
--                                when they auto-archive, when they auto-delete,
--                                and what outcome applies. The actual sweep is
--                                pass 3 of lib/storage/reconcile.js — these
--                                rows configure and report on that mechanism,
--                                they do not delete bytes themselves.
--   assets.retention_exceptions  per-target carve-outs from a policy, with an
--                                optional expiry after which the policy applies
--                                again.
--   assets.legal_holds           hold records: matter, reason, custodians, and
--                                lifecycle (active|released). An ACTIVE hold
--                                suspends retention for its assets — the
--                                retention sweep must exclude held ids.
--   assets.legal_hold_assets     join of held asset ids to a hold.
--   assets.legal_hold_events     append-only audit trail for a hold (created,
--                                assets added/removed, custodians, notices,
--                                release). Never updated or deleted.
--
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;
alter default privileges in schema assets grant all on tables to anon, authenticated, service_role;
alter default privileges in schema assets grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema assets grant all on routines to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permission overrides
-- ---------------------------------------------------------------------------

create table if not exists assets.permission_overrides (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  scope text not null default 'workspace',
  target_id text not null default '',
  target_label text not null default '',
  field_name text not null default '',
  role_id uuid,
  role_key text not null default '',
  permission_key text not null default '',
  effect text not null default 'allow',
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint permission_overrides_scope_chk check (scope in ('workspace', 'folder', 'collection', 'asset', 'portal', 'field')),
  constraint permission_overrides_effect_chk check (effect in ('allow', 'deny'))
);

create index if not exists permission_overrides_project_idx
  on assets.permission_overrides (project_id) where deleted_at is null;
create index if not exists permission_overrides_scope_idx
  on assets.permission_overrides (scope) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Identity providers (configuration only — never credentials)
-- ---------------------------------------------------------------------------

create table if not exists assets.identity_providers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default '',
  protocol text not null default 'saml',
  status text not null default 'pending',
  domain text not null default '',
  sso_url text not null default '',
  entity_id text not null default '',
  scim_enabled boolean not null default false,
  auto_provision boolean not null default true,
  require_mfa boolean not null default false,
  deprovision_on_disable boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint identity_providers_protocol_chk check (protocol in ('saml', 'oidc', 'scim')),
  constraint identity_providers_status_chk check (status in ('active', 'pending', 'disabled'))
);

create index if not exists identity_providers_project_idx
  on assets.identity_providers (project_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Retention policies + exceptions
-- ---------------------------------------------------------------------------

create table if not exists assets.retention_policies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default '',
  scope text not null default 'workspace',
  target text not null default '',
  retention_days integer not null default 30,
  auto_archive_days integer,
  auto_delete_days integer,
  disposition text not null default 'retain',
  requires_review boolean not null default false,
  is_active boolean not null default true,
  last_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint retention_policies_scope_chk check (scope in ('workspace', 'folder', 'collection', 'asset_type')),
  constraint retention_policies_disposition_chk check (disposition in ('retain', 'archive', 'delete'))
);

create index if not exists retention_policies_project_idx
  on assets.retention_policies (project_id) where deleted_at is null;

create table if not exists assets.retention_exceptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  policy_id uuid references assets.retention_policies(id) on delete cascade,
  target_id text not null default '',
  target_label text not null default '',
  reason text not null default '',
  expires_at timestamptz,
  approved_by text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists retention_exceptions_project_idx
  on assets.retention_exceptions (project_id) where deleted_at is null;
create index if not exists retention_exceptions_policy_idx
  on assets.retention_exceptions (policy_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Legal holds + preserved assets + audit history
-- ---------------------------------------------------------------------------

create table if not exists assets.legal_holds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default '',
  matter text not null default '',
  reason text not null default '',
  status text not null default 'active',
  custodians text[] not null default '{}'::text[],
  notify_custodians boolean not null default true,
  released_at timestamptz,
  released_by text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint legal_holds_status_chk check (status in ('active', 'released'))
);

create index if not exists legal_holds_project_idx
  on assets.legal_holds (project_id) where deleted_at is null;
create index if not exists legal_holds_status_idx
  on assets.legal_holds (status) where deleted_at is null;

create table if not exists assets.legal_hold_assets (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid references assets.legal_holds(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  asset_id text not null default '',
  asset_label text not null default '',
  added_by text not null default '',
  added_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists legal_hold_assets_hold_idx
  on assets.legal_hold_assets (hold_id) where deleted_at is null;
create index if not exists legal_hold_assets_project_idx
  on assets.legal_hold_assets (project_id) where deleted_at is null;

create table if not exists assets.legal_hold_events (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid references assets.legal_holds(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  action text not null default 'updated',
  actor text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists legal_hold_events_hold_idx
  on assets.legal_hold_events (hold_id);
create index if not exists legal_hold_events_project_idx
  on assets.legal_hold_events (project_id);

-- ---------------------------------------------------------------------------
-- Triggers, grants, RLS
-- ---------------------------------------------------------------------------

drop trigger if exists permission_overrides_set_updated_at on assets.permission_overrides;
create trigger permission_overrides_set_updated_at
before update on assets.permission_overrides
for each row execute function assets.set_updated_at();

drop trigger if exists identity_providers_set_updated_at on assets.identity_providers;
create trigger identity_providers_set_updated_at
before update on assets.identity_providers
for each row execute function assets.set_updated_at();

drop trigger if exists retention_policies_set_updated_at on assets.retention_policies;
create trigger retention_policies_set_updated_at
before update on assets.retention_policies
for each row execute function assets.set_updated_at();

drop trigger if exists retention_exceptions_set_updated_at on assets.retention_exceptions;
create trigger retention_exceptions_set_updated_at
before update on assets.retention_exceptions
for each row execute function assets.set_updated_at();

drop trigger if exists legal_holds_set_updated_at on assets.legal_holds;
create trigger legal_holds_set_updated_at
before update on assets.legal_holds
for each row execute function assets.set_updated_at();

drop trigger if exists legal_hold_assets_set_updated_at on assets.legal_hold_assets;
create trigger legal_hold_assets_set_updated_at
before update on assets.legal_hold_assets
for each row execute function assets.set_updated_at();

grant all on assets.permission_overrides to anon, authenticated, service_role;
grant all on assets.identity_providers to anon, authenticated, service_role;
grant all on assets.retention_policies to anon, authenticated, service_role;
grant all on assets.retention_exceptions to anon, authenticated, service_role;
grant all on assets.legal_holds to anon, authenticated, service_role;
grant all on assets.legal_hold_assets to anon, authenticated, service_role;
grant all on assets.legal_hold_events to anon, authenticated, service_role;

alter table assets.permission_overrides enable row level security;
alter table assets.identity_providers enable row level security;
alter table assets.retention_policies enable row level security;
alter table assets.retention_exceptions enable row level security;
alter table assets.legal_holds enable row level security;
alter table assets.legal_hold_assets enable row level security;
alter table assets.legal_hold_events enable row level security;

drop policy if exists permission_overrides_demo_all on assets.permission_overrides;
create policy permission_overrides_demo_all on assets.permission_overrides
  for all to anon, authenticated using (true) with check (true);

drop policy if exists identity_providers_demo_all on assets.identity_providers;
create policy identity_providers_demo_all on assets.identity_providers
  for all to anon, authenticated using (true) with check (true);

drop policy if exists retention_policies_demo_all on assets.retention_policies;
create policy retention_policies_demo_all on assets.retention_policies
  for all to anon, authenticated using (true) with check (true);

drop policy if exists retention_exceptions_demo_all on assets.retention_exceptions;
create policy retention_exceptions_demo_all on assets.retention_exceptions
  for all to anon, authenticated using (true) with check (true);

drop policy if exists legal_holds_demo_all on assets.legal_holds;
create policy legal_holds_demo_all on assets.legal_holds
  for all to anon, authenticated using (true) with check (true);

drop policy if exists legal_hold_assets_demo_all on assets.legal_hold_assets;
create policy legal_hold_assets_demo_all on assets.legal_hold_assets
  for all to anon, authenticated using (true) with check (true);

drop policy if exists legal_hold_events_demo_all on assets.legal_hold_events;
create policy legal_hold_events_demo_all on assets.legal_hold_events
  for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists legal_hold_events_demo_all on assets.legal_hold_events;
drop policy if exists legal_hold_assets_demo_all on assets.legal_hold_assets;
drop policy if exists legal_holds_demo_all on assets.legal_holds;
drop policy if exists retention_exceptions_demo_all on assets.retention_exceptions;
drop policy if exists retention_policies_demo_all on assets.retention_policies;
drop policy if exists identity_providers_demo_all on assets.identity_providers;
drop policy if exists permission_overrides_demo_all on assets.permission_overrides;
drop index if exists assets.legal_hold_events_project_idx;
drop index if exists assets.legal_hold_events_hold_idx;
drop index if exists assets.legal_hold_assets_project_idx;
drop index if exists assets.legal_hold_assets_hold_idx;
drop index if exists assets.legal_holds_status_idx;
drop index if exists assets.legal_holds_project_idx;
drop index if exists assets.retention_exceptions_policy_idx;
drop index if exists assets.retention_exceptions_project_idx;
drop index if exists assets.retention_policies_project_idx;
drop index if exists assets.identity_providers_project_idx;
drop index if exists assets.permission_overrides_scope_idx;
drop index if exists assets.permission_overrides_project_idx;
drop table if exists assets.legal_hold_events;
drop table if exists assets.legal_hold_assets;
drop table if exists assets.legal_holds;
drop table if exists assets.retention_exceptions;
drop table if exists assets.retention_policies;
drop table if exists assets.identity_providers;
drop table if exists assets.permission_overrides;
