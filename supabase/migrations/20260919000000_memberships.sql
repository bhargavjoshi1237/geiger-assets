-- Memberships domain — access rules, member activity log, billing invoices,
-- gallery integrations.
--
-- Owns assets.membership_access_rules, assets.membership_activity,
-- assets.membership_invoices, assets.membership_gallery_links.
-- Extends the creator-monetization tables (membership_tiers, members,
-- subscriptions) without touching them: rules and gallery links point at
-- tiers, invoices point at members/subscriptions, activity points at members.
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

-- One row binds a scope (folder | collection | gallery) to a tier plus a set
-- of allowances: login gates, guest paywalls, hi-res downloads, watermark
-- bypass, preview-only constraints, metadata visibility.
create table if not exists assets.membership_access_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled rule',
  scope_type text not null default 'collection' check (scope_type in ('folder', 'collection', 'gallery')),
  scope_id uuid,
  scope_name text not null default '',
  tier_id uuid references assets.membership_tiers(id) on delete set null,
  login_required boolean not null default true,
  paywall_enabled boolean not null default false,
  allow_hires_download boolean not null default false,
  watermark_bypass boolean not null default false,
  preview_only boolean not null default false,
  metadata_visible boolean not null default true,
  is_active boolean not null default true,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Append-only member activity log: logins, views, downloads, signups, tier
-- changes. Immutable history, so no updated_at and no soft delete — the data
-- layer only ever lists and appends.
create table if not exists assets.membership_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  member_id uuid references assets.members(id) on delete cascade,
  kind text not null default 'view' check (kind in ('login', 'view', 'download', 'signup', 'tier_change')),
  detail text not null default '',
  asset_id uuid references assets.assets(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- Billing ledger: renewal and one-off invoices, the failed-payment dunning
-- queue (failed / past_due + attempt_count), and refunds. Providers are
-- configuration only — this table records money, it never charges it.
create table if not exists assets.membership_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  member_id uuid references assets.members(id) on delete cascade,
  subscription_id uuid references assets.subscriptions(id) on delete set null,
  number text not null default '',
  status text not null default 'open' check (status in ('open', 'paid', 'failed', 'past_due', 'refunded', 'void')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',
  provider text not null default 'manual' check (provider in ('manual', 'stripe', 'paypal')),
  due_at timestamptz,
  paid_at timestamptz,
  attempt_count integer not null default 0,
  last_error text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (project_id, number)
);

-- Membership features attached to showcase galleries and asset storefronts:
-- member login, member-only pricing, interactive paywalls, custom signup
-- forms, tier-restricted libraries, welcome banners.
create table if not exists assets.membership_gallery_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  gallery_id uuid,
  gallery_name text not null default '',
  tier_id uuid references assets.membership_tiers(id) on delete set null,
  login_required boolean not null default true,
  member_pricing_enabled boolean not null default false,
  paywall_enabled boolean not null default false,
  signup_form_enabled boolean not null default false,
  welcome_banner text not null default '',
  is_active boolean not null default true,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists membership_access_rules_project_idx on assets.membership_access_rules (project_id) where deleted_at is null;
create index if not exists membership_access_rules_tier_idx on assets.membership_access_rules (tier_id) where deleted_at is null;
create index if not exists membership_activity_member_idx on assets.membership_activity (member_id);
create index if not exists membership_activity_project_idx on assets.membership_activity (project_id, created_at desc);
create index if not exists membership_invoices_project_idx on assets.membership_invoices (project_id) where deleted_at is null;
create index if not exists membership_invoices_member_idx on assets.membership_invoices (member_id) where deleted_at is null;
create index if not exists membership_gallery_links_project_idx on assets.membership_gallery_links (project_id) where deleted_at is null;

do $$
declare t text;
begin
  foreach t in array array[
    'membership_access_rules', 'membership_invoices', 'membership_gallery_links'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

alter table assets.membership_access_rules enable row level security;
alter table assets.membership_activity enable row level security;
alter table assets.membership_invoices enable row level security;
alter table assets.membership_gallery_links enable row level security;

drop policy if exists membership_access_rules_demo_all on assets.membership_access_rules;
create policy membership_access_rules_demo_all on assets.membership_access_rules for all to anon, authenticated using (true) with check (true);
drop policy if exists membership_activity_demo_all on assets.membership_activity;
create policy membership_activity_demo_all on assets.membership_activity for all to anon, authenticated using (true) with check (true);
drop policy if exists membership_invoices_demo_all on assets.membership_invoices;
create policy membership_invoices_demo_all on assets.membership_invoices for all to anon, authenticated using (true) with check (true);
drop policy if exists membership_gallery_links_demo_all on assets.membership_gallery_links;
create policy membership_gallery_links_demo_all on assets.membership_gallery_links for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists membership_gallery_links_demo_all on assets.membership_gallery_links;
drop policy if exists membership_invoices_demo_all on assets.membership_invoices;
drop policy if exists membership_activity_demo_all on assets.membership_activity;
drop policy if exists membership_access_rules_demo_all on assets.membership_access_rules;
drop table if exists assets.membership_gallery_links;
drop table if exists assets.membership_invoices;
drop table if exists assets.membership_activity;
drop table if exists assets.membership_access_rules;
