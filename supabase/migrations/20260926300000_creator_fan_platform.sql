-- Membership — the fan-facing creator platform (Patreon / OnlyFans style).
--
-- Owns assets.creator_profiles (the public /c/<handle> page), assets.fan_accounts
-- and assets.fan_sessions (fan sign-in, separate from workspace auth.users),
-- assets.fan_payments (subscriptions, tips and unlocks bought on the public page)
-- and assets.message_unlocks (per-fan unlocks of paid / mass DMs). Extends
-- assets.ppv_posts into a full post feed (public, members, tier and PPV posts)
-- and links assets.members to the fan account that owns it.
--
-- Fan accounts, sessions and payments hold password hashes, session tokens and
-- checkout tokens, so they get NO anon/authenticated policy: only the server
-- (service role) reads or writes them. Everything else follows the suite's
-- demo-open RLS. Self-contained + idempotent: safe to re-run.

-- @up
create extension if not exists pgcrypto;
create extension if not exists citext;

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

create table if not exists assets.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  handle citext not null,
  display_name text not null default '',
  tagline text not null default '',
  bio text not null default '',
  avatar_asset_id uuid references assets.assets(id) on delete set null,
  banner_asset_id uuid references assets.assets(id) on delete set null,
  accent_color text not null default '#f97316',
  links jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  tips_enabled boolean not null default true,
  min_tip_cents integer not null default 100 check (min_tip_cents >= 50),
  suggested_tips jsonb not null default '[300, 500, 1000, 2500]'::jsonb,
  messages_enabled boolean not null default true,
  welcome_message text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists creator_profiles_handle_key on assets.creator_profiles (handle) where deleted_at is null;
create unique index if not exists creator_profiles_project_key on assets.creator_profiles (project_id) where deleted_at is null;

create table if not exists assets.fan_accounts (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  display_name text not null default '',
  password_hash text not null,
  avatar_url text not null default '',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists fan_accounts_email_key on assets.fan_accounts (email) where deleted_at is null;

create table if not exists assets.fan_sessions (
  id uuid primary key default gen_random_uuid(),
  fan_account_id uuid not null references assets.fan_accounts(id) on delete cascade,
  token_hash text not null unique,
  user_agent text not null default '',
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists fan_sessions_account_idx on assets.fan_sessions (fan_account_id);

alter table assets.members add column if not exists fan_account_id uuid references assets.fan_accounts(id) on delete set null;
create unique index if not exists members_project_fan_key on assets.members (project_id, fan_account_id)
  where fan_account_id is not null and deleted_at is null;

alter table assets.ppv_posts add column if not exists visibility text not null default 'ppv';
alter table assets.ppv_posts add column if not exists min_tier_id uuid references assets.membership_tiers(id) on delete set null;
alter table assets.ppv_posts add column if not exists body text not null default '';
alter table assets.ppv_posts add column if not exists is_pinned boolean not null default false;
alter table assets.ppv_posts drop constraint if exists ppv_posts_visibility_check;
alter table assets.ppv_posts add constraint ppv_posts_visibility_check check (visibility in ('public', 'members', 'tier', 'ppv'));

create table if not exists assets.fan_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  fan_account_id uuid references assets.fan_accounts(id) on delete set null,
  member_id uuid references assets.members(id) on delete set null,
  kind text not null check (kind in ('subscription', 'tip', 'post_unlock', 'message_unlock')),
  target_id uuid,
  tier_id uuid references assets.membership_tiers(id) on delete set null,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  provider text not null default 'test' check (provider in ('stripe', 'test')),
  provider_ref text,
  access_token text not null default encode(gen_random_bytes(24), 'hex'),
  note text not null default '',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists fan_payments_fan_idx on assets.fan_payments (fan_account_id, project_id);

create table if not exists assets.message_unlocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  message_id uuid not null references assets.paid_messages(id) on delete cascade,
  member_id uuid not null references assets.members(id) on delete cascade,
  price_cents integer not null default 0,
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (message_id, member_id)
);

create index if not exists message_unlocks_member_idx on assets.message_unlocks (member_id);

do $$
declare t text;
begin
  foreach t in array array['creator_profiles', 'fan_accounts', 'fan_payments'] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;

  -- Public / workspace-readable tables: suite demo-open policy.
  foreach t in array array['creator_profiles', 'message_unlocks'] loop
    execute format('alter table assets.%I enable row level security', t);
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
    execute format(
      'create policy %I_demo_all on assets.%I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
    execute format('grant select, insert, update, delete on assets.%I to anon, authenticated, service_role', t);
  end loop;

  -- Secrets-bearing tables: server (service role) only.
  foreach t in array array['fan_accounts', 'fan_sessions', 'fan_payments'] loop
    execute format('alter table assets.%I enable row level security', t);
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
    execute format('revoke all on assets.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on assets.%I to service_role', t);
  end loop;
end $$;

-- @down
drop policy if exists message_unlocks_demo_all on assets.message_unlocks;
drop policy if exists creator_profiles_demo_all on assets.creator_profiles;
drop table if exists assets.message_unlocks;
drop table if exists assets.fan_payments;
alter table assets.ppv_posts drop constraint if exists ppv_posts_visibility_check;
alter table assets.ppv_posts drop column if exists is_pinned;
alter table assets.ppv_posts drop column if exists body;
alter table assets.ppv_posts drop column if exists min_tier_id;
alter table assets.ppv_posts drop column if exists visibility;
drop index if exists assets.members_project_fan_key;
alter table assets.members drop column if exists fan_account_id;
drop table if exists assets.fan_sessions;
drop table if exists assets.fan_accounts;
drop table if exists assets.creator_profiles;
