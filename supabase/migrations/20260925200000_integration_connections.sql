-- Integration connections — one row per user per linked cloud provider.
--
-- Owns assets.integration_connections: the OAuth link a user makes to a
-- source such as Google Drive so imports work without re-consenting. Only
-- the refresh token is stored, AES-GCM encrypted by the server
-- (lib/integrations/google_server.js); access tokens are minted on demand.
--
-- Unlike the demo-open module tables, RLS here is owner-only: a row holds a
-- credential, so a user can only ever see or change their own connections.
--
-- Self-contained + idempotent: safe to re-run.

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

create table if not exists assets.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google-drive')),
  account_email text not null default '',
  refresh_token_enc text not null,
  scopes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_user_provider_key unique (user_id, provider)
);

drop trigger if exists integration_connections_touch_updated_at on assets.integration_connections;
create trigger integration_connections_touch_updated_at
  before update on assets.integration_connections
  for each row execute function assets.touch_updated_at();

grant select, insert, update, delete on assets.integration_connections to authenticated, service_role;

alter table assets.integration_connections enable row level security;

drop policy if exists integration_connections_owner on assets.integration_connections;
create policy integration_connections_owner on assets.integration_connections
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- @down
drop table if exists assets.integration_connections;
