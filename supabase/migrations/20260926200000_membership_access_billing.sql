-- Membership Studio — access control and recurring billing.
--
-- Owns assets.access_rules (tier gates on folders, collections, galleries and
-- assets, including gallery paywalls / login gates) and assets.billing_invoices
-- (renewal invoices with dunning retries against assets.subscriptions).
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

create table if not exists assets.access_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled rule',
  target_type text not null default 'collection' check (target_type in ('folder', 'collection', 'gallery', 'asset')),
  target_id uuid,
  target_label text not null default '',
  min_tier_id uuid references assets.membership_tiers(id) on delete set null,
  gate text not null default 'login' check (gate in ('login', 'paywall', 'preview')),
  access_level text not null default 'standard' check (access_level in ('preview', 'standard', 'full_res')),
  allow_download boolean not null default true,
  bypass_watermark boolean not null default false,
  show_metadata boolean not null default true,
  welcome_message text not null default '',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  number text not null default '',
  member_id uuid references assets.members(id) on delete set null,
  subscription_id uuid references assets.subscriptions(id) on delete set null,
  tier_id uuid references assets.membership_tiers(id) on delete set null,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'open' check (status in ('open', 'paid', 'failed', 'refunded', 'void')),
  period_start timestamptz,
  period_end timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists access_rules_project_idx on assets.access_rules (project_id) where deleted_at is null;
create index if not exists access_rules_target_idx on assets.access_rules (target_type, target_id) where deleted_at is null;
create index if not exists billing_invoices_project_idx on assets.billing_invoices (project_id) where deleted_at is null;
create index if not exists billing_invoices_member_idx on assets.billing_invoices (member_id) where deleted_at is null;
create index if not exists billing_invoices_subscription_idx on assets.billing_invoices (subscription_id) where deleted_at is null;

do $$
declare t text;
begin
  foreach t in array array['access_rules', 'billing_invoices'] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
    execute format('alter table assets.%I enable row level security', t);
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
    execute format(
      'create policy %I_demo_all on assets.%I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
    execute format('grant select, insert, update, delete on assets.%I to anon, authenticated, service_role', t);
  end loop;
end $$;

-- @down
drop policy if exists billing_invoices_demo_all on assets.billing_invoices;
drop policy if exists access_rules_demo_all on assets.access_rules;
drop table if exists assets.billing_invoices;
drop table if exists assets.access_rules;
