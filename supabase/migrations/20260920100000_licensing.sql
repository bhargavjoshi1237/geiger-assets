-- Licensing — inbound rights inventory plus outbound licence issuing, renewals,
-- and royalty accounting.
--
-- Owns assets.rights_holders, assets.rights_records, assets.licensees,
-- assets.license_templates, assets.license_price_rules, assets.license_quotes,
-- assets.licenses, assets.license_items, assets.license_renewals,
-- assets.royalty_rules, assets.royalty_lines, assets.royalty_statements.
-- Self-contained + idempotent: safe to re-run. Follows suite conventions
-- (uuid pk, project_id scoping, metadata bag, touch_updated_at, demo-open RLS).

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

-- Inbound: who we owe, and what we actually control -------------------------

create table if not exists assets.rights_holders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled rights holder',
  kind text not null default 'creator' check (kind in ('creator', 'photographer', 'agency', 'label', 'publisher', 'internal', 'other')),
  email citext,
  default_royalty_rate numeric(6, 3) not null default 0 check (default_royalty_rate >= 0),
  payment_terms text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.rights_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null default 'Untitled right',
  rights_holder_id uuid references assets.rights_holders(id) on delete set null,
  asset_id uuid references assets.assets(id) on delete set null,
  collection_id uuid references assets.collections(id) on delete set null,
  external_ref text not null default '',
  acquisition_type text not null default 'licensed_in' check (acquisition_type in ('owned', 'licensed_in', 'commissioned', 'public_domain', 'unknown')),
  ownership_share numeric(6, 3) not null default 100 check (ownership_share >= 0 and ownership_share <= 100),
  territories text[] not null default '{}',
  channels text[] not null default '{}',
  window_start date,
  window_end date,
  exclusivity text not null default 'non_exclusive' check (exclusivity in ('exclusive', 'sole', 'non_exclusive')),
  status text not null default 'active' check (status in ('draft', 'active', 'expiring', 'expired', 'disputed')),
  document_url text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Outbound: who we grant to, on what terms, at what price --------------------

create table if not exists assets.licensees (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled licensee',
  contact_name text not null default '',
  email citext,
  kind text not null default 'brand' check (kind in ('brand', 'agency', 'publisher', 'broadcaster', 'internal', 'individual', 'other')),
  territory text not null default '',
  website text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.license_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled template',
  description text not null default '',
  usage_type text not null default 'web' check (usage_type in ('advertising', 'editorial', 'social', 'broadcast', 'print', 'web', 'internal', 'merchandise', 'oem')),
  default_territories text[] not null default '{}',
  default_channels text[] not null default '{}',
  default_duration_months integer not null default 12 check (default_duration_months >= 0),
  exclusivity text not null default 'non_exclusive' check (exclusivity in ('exclusive', 'sole', 'non_exclusive')),
  restrictions text[] not null default '{}',
  terms_body text not null default '',
  requires_approval boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  version integer not null default 1,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.license_price_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  template_id uuid references assets.license_templates(id) on delete cascade,
  kind text not null default 'territory' check (kind in ('base', 'territory', 'duration', 'channel', 'exclusivity')),
  rule_key text not null default '',
  label text not null default '',
  multiplier numeric(8, 3) not null default 1 check (multiplier >= 0),
  flat_cents integer not null default 0 check (flat_cents >= 0),
  currency text not null default 'usd',
  position integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.license_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  licensee_id uuid references assets.licensees(id) on delete set null,
  template_id uuid references assets.license_templates(id) on delete set null,
  subject text not null default '',
  scope jsonb not null default '{}'::jsonb,
  computed_cents integer not null default 0 check (computed_cents >= 0),
  quoted_cents integer not null default 0 check (quoted_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'requested' check (status in ('requested', 'quoted', 'accepted', 'declined', 'converted')),
  license_id uuid,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.licenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  reference text not null default '',
  title text not null default 'Untitled licence',
  template_id uuid references assets.license_templates(id) on delete set null,
  licensee_id uuid references assets.licensees(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'pending', 'active', 'expiring', 'expired', 'terminated', 'renewed')),
  usage_type text not null default 'web',
  territories text[] not null default '{}',
  channels text[] not null default '{}',
  exclusivity text not null default 'non_exclusive' check (exclusivity in ('exclusive', 'sole', 'non_exclusive')),
  start_date date,
  end_date date,
  grace_days integer not null default 0 check (grace_days >= 0),
  is_perpetual boolean not null default false,
  auto_renew boolean not null default false,
  fee_cents integer not null default 0 check (fee_cents >= 0),
  currency text not null default 'usd',
  price_breakdown jsonb not null default '{}'::jsonb,
  royalty_rate numeric(6, 3) not null default 0 check (royalty_rate >= 0),
  restrictions text[] not null default '{}',
  terms_body text not null default '',
  document_url text not null default '',
  notes text not null default '',
  issued_at timestamptz,
  renewal_of uuid references assets.licenses(id) on delete set null,
  renewed_to uuid references assets.licenses(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table assets.license_quotes drop constraint if exists license_quotes_license_id_fkey;
alter table assets.license_quotes
  add constraint license_quotes_license_id_fkey
  foreign key (license_id) references assets.licenses(id) on delete set null;

create table if not exists assets.license_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  license_id uuid not null references assets.licenses(id) on delete cascade,
  asset_id uuid references assets.assets(id) on delete set null,
  collection_id uuid references assets.collections(id) on delete set null,
  rights_record_id uuid references assets.rights_records(id) on delete set null,
  external_title text not null default '',
  external_ref text not null default '',
  version_label text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.license_renewals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  license_id uuid not null references assets.licenses(id) on delete cascade,
  action text not null default 'renewed' check (action in ('renewed', 'lapsed', 'terminated', 'grace_extended', 'reminded')),
  previous_end_date date,
  new_end_date date,
  fee_cents integer not null default 0 check (fee_cents >= 0),
  currency text not null default 'usd',
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- Royalties: turning licence revenue into rightsholder obligations ----------

create table if not exists assets.royalty_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  rights_holder_id uuid references assets.rights_holders(id) on delete cascade,
  label text not null default '',
  scope_kind text not null default 'global' check (scope_kind in ('global', 'asset', 'collection', 'rights_record', 'template')),
  scope_id uuid,
  rate_percent numeric(6, 3) not null default 0 check (rate_percent >= 0),
  flat_cents integer not null default 0 check (flat_cents >= 0),
  minimum_guarantee_cents integer not null default 0 check (minimum_guarantee_cents >= 0),
  recoupable boolean not null default false,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.royalty_statements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  rights_holder_id uuid references assets.rights_holders(id) on delete cascade,
  period_start date,
  period_end date,
  gross_cents integer not null default 0,
  royalty_cents integer not null default 0,
  minimum_guarantee_cents integer not null default 0,
  recouped_cents integer not null default 0,
  payable_cents integer not null default 0,
  currency text not null default 'usd',
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'void')),
  issued_at timestamptz,
  paid_at timestamptz,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.royalty_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  license_id uuid references assets.licenses(id) on delete cascade,
  rights_holder_id uuid references assets.rights_holders(id) on delete cascade,
  royalty_rule_id uuid references assets.royalty_rules(id) on delete set null,
  statement_id uuid references assets.royalty_statements(id) on delete set null,
  basis_cents integer not null default 0,
  rate_percent numeric(6, 3) not null default 0,
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  period_start date,
  status text not null default 'accrued' check (status in ('accrued', 'statemented', 'paid', 'void')),
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Indexes -------------------------------------------------------------------

create index if not exists rights_holders_project_idx on assets.rights_holders (project_id) where deleted_at is null;
create index if not exists rights_records_project_idx on assets.rights_records (project_id) where deleted_at is null;
create index if not exists rights_records_holder_idx on assets.rights_records (rights_holder_id) where deleted_at is null;
create index if not exists rights_records_asset_idx on assets.rights_records (asset_id) where deleted_at is null;
create index if not exists licensees_project_idx on assets.licensees (project_id) where deleted_at is null;
create index if not exists license_templates_project_idx on assets.license_templates (project_id) where deleted_at is null;
create index if not exists license_price_rules_project_idx on assets.license_price_rules (project_id) where deleted_at is null;
create index if not exists license_price_rules_template_idx on assets.license_price_rules (template_id) where deleted_at is null;
create index if not exists license_quotes_project_idx on assets.license_quotes (project_id) where deleted_at is null;
create index if not exists licenses_project_idx on assets.licenses (project_id) where deleted_at is null;
create index if not exists licenses_licensee_idx on assets.licenses (licensee_id) where deleted_at is null;
create index if not exists licenses_end_date_idx on assets.licenses (end_date) where deleted_at is null;
create unique index if not exists licenses_reference_key on assets.licenses (project_id, reference) where deleted_at is null and reference <> '';
create index if not exists license_items_license_idx on assets.license_items (license_id) where deleted_at is null;
create index if not exists license_items_asset_idx on assets.license_items (asset_id) where deleted_at is null;
create index if not exists license_renewals_license_idx on assets.license_renewals (license_id);
create index if not exists royalty_rules_project_idx on assets.royalty_rules (project_id) where deleted_at is null;
create index if not exists royalty_lines_project_idx on assets.royalty_lines (project_id) where deleted_at is null;
create index if not exists royalty_lines_statement_idx on assets.royalty_lines (statement_id) where deleted_at is null;
create index if not exists royalty_statements_project_idx on assets.royalty_statements (project_id) where deleted_at is null;

-- Triggers ------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'rights_holders', 'rights_records', 'licensees', 'license_templates',
    'license_price_rules', 'license_quotes', 'licenses', 'license_items',
    'royalty_rules', 'royalty_lines', 'royalty_statements'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- RLS -----------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'rights_holders', 'rights_records', 'licensees', 'license_templates',
    'license_price_rules', 'license_quotes', 'licenses', 'license_items',
    'license_renewals', 'royalty_rules', 'royalty_lines', 'royalty_statements'
  ] loop
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
  foreach t in array array[
    'rights_holders', 'rights_records', 'licensees', 'license_templates',
    'license_price_rules', 'license_quotes', 'licenses', 'license_items',
    'license_renewals', 'royalty_rules', 'royalty_lines', 'royalty_statements'
  ] loop
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
  end loop;
end $$;

drop table if exists assets.royalty_lines;
drop table if exists assets.royalty_statements;
drop table if exists assets.royalty_rules;
drop table if exists assets.license_renewals;
drop table if exists assets.license_items;
drop table if exists assets.license_quotes;
drop table if exists assets.licenses;
drop table if exists assets.license_price_rules;
drop table if exists assets.license_templates;
drop table if exists assets.licensees;
drop table if exists assets.rights_records;
drop table if exists assets.rights_holders;
