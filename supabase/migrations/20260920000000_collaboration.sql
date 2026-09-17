-- Collaboration domain — shareable links, approval reviews, invitations.
--
-- Owns assets.shared_links, assets.approvals, assets.collaboration_invites.
-- Shared links are the workspace handle for the HMAC-signed delivery tokens
-- minted through POST /api/media/share (verified by lib/media/token, never
-- looked up): the row records label, kind, visibility, scope and expiry, and
-- revoking deactivates it in place. Approvals move an asset from draft to
-- approved with a decision trail in metadata.history. Invites are the
-- pending-invite queue in front of public.roles + assets.role_grants, which
-- stay the source of truth for membership (lib/supabase/rbac.js).
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

create table if not exists assets.shared_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  label text not null default 'Untitled link',
  kind text not null default 'asset' check (kind in ('asset', 'collection')),
  asset_id uuid references assets.assets(id) on delete set null,
  collection_id uuid,
  collection_name text not null default '',
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  scope text not null default 'view' check (scope in ('view', 'download')),
  password_protected boolean not null default false,
  password_hint text not null default '',
  token text not null default '',
  url text not null default '',
  view_count integer not null default 0 check (view_count >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  asset_id uuid references assets.assets(id) on delete set null,
  title text not null default 'Untitled review',
  description text not null default '',
  requester text not null default '',
  reviewer text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'changes_requested')),
  version_label text not null default '',
  is_locked boolean not null default false,
  external_token text not null default '',
  note text not null default '',
  decided_at timestamptz,
  decided_by text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.collaboration_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  email citext not null,
  name text not null default '',
  role_id uuid,
  role_key text not null default '',
  role_name text not null default '',
  invite_type text not null default 'member' check (invite_type in ('member', 'guest', 'reviewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  message text not null default '',
  expires_at timestamptz,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists shared_links_project_idx on assets.shared_links (project_id) where deleted_at is null;
create index if not exists shared_links_asset_idx on assets.shared_links (asset_id) where deleted_at is null;
create index if not exists approvals_project_idx on assets.approvals (project_id) where deleted_at is null;
create index if not exists approvals_asset_idx on assets.approvals (asset_id) where deleted_at is null;
create index if not exists approvals_status_idx on assets.approvals (status) where deleted_at is null;
create index if not exists collaboration_invites_project_idx on assets.collaboration_invites (project_id) where deleted_at is null;
create index if not exists collaboration_invites_email_idx on assets.collaboration_invites (email) where deleted_at is null;

do $$
declare t text;
begin
  foreach t in array array[
    'shared_links', 'approvals', 'collaboration_invites'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

alter table assets.shared_links enable row level security;
alter table assets.approvals enable row level security;
alter table assets.collaboration_invites enable row level security;

drop policy if exists shared_links_demo_all on assets.shared_links;
create policy shared_links_demo_all on assets.shared_links for all to anon, authenticated using (true) with check (true);
drop policy if exists approvals_demo_all on assets.approvals;
create policy approvals_demo_all on assets.approvals for all to anon, authenticated using (true) with check (true);
drop policy if exists collaboration_invites_demo_all on assets.collaboration_invites;
create policy collaboration_invites_demo_all on assets.collaboration_invites for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists collaboration_invites_demo_all on assets.collaboration_invites;
drop policy if exists approvals_demo_all on assets.approvals;
drop policy if exists shared_links_demo_all on assets.shared_links;
drop table if exists assets.collaboration_invites;
drop table if exists assets.approvals;
drop table if exists assets.shared_links;
