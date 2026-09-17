-- Licensing domain for Geiger Assets (rights inventory, reusable license
-- templates, price rules + custom quote requests, issued licenses, and
-- asset-level revenue/royalties).
--
-- Shape (six tables, each serving its screen):
--   assets.license_rights          rights the organization owns or controls:
--                                  holder, title, right type, ownership share,
--                                  territories, channels/media, rights window,
--                                  and lifecycle status.
--   assets.license_templates       reusable outbound grants: usage type,
--                                  territories, channels, duration, restrictions,
--                                  and a base price feeding the calculator.
--   assets.license_price_rules     base prices per usage type. The pricing
--                                  calculator multiplies a rule's base by the
--                                  territory/duration/channel/exclusivity
--                                  ladders in constants.js — the ladders live in
--                                  the client, not here.
--   assets.license_quote_requests  custom quote requests that fall outside the
--                                  ladders: requester, requested scope, estimate,
--                                  and decision lifecycle.
--   assets.issued_licenses         outbound grants to licensees: licensed asset,
--                                  grant scope, issue/start/end dates, status,
--                                  and a certificate code. The expirations screen
--                                  reads this table — expiry is derived from
--                                  end_date with real date maths, never stored.
--   assets.license_revenues        asset-level income: license fees and
--                                  royalties with rates, shares, minimum
--                                  guarantees, and recoupment.
--
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm). Reuses
-- assets.set_updated_at() from the base assets migration.

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create table if not exists assets.license_rights (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  holder_name        text not null default '',
  title              text not null default '',
  right_type         text not null default 'ownership',
  share_percent      numeric not null default 100,
  territories        text not null default '',
  channels           text not null default '',
  media              text not null default '',
  window_start       timestamptz,
  window_end         timestamptz,
  status             text not null default 'active',
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  metadata           jsonb not null default '{}'::jsonb,
  constraint license_rights_status_chk check (status in ('active', 'pending', 'expired', 'disputed')),
  constraint license_rights_type_chk check (right_type in ('ownership', 'exclusive', 'non_exclusive', 'administration')),
  constraint license_rights_share_chk check (share_percent >= 0 and share_percent <= 100)
);

create table if not exists assets.license_templates (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  name              text not null default '',
  description       text not null default '',
  usage_type        text not null default 'commercial',
  territories       text not null default '',
  channels          text not null default '',
  duration_days     integer not null default 365,
  restrictions      text not null default '',
  base_price_cents  integer not null default 0,
  currency          text not null default 'usd',
  is_active         boolean not null default true,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  constraint license_templates_usage_chk check (usage_type in ('commercial', 'editorial', 'personal', 'broadcast', 'merchandising')),
  constraint license_templates_duration_chk check (duration_days >= 0),
  constraint license_templates_price_chk check (base_price_cents >= 0)
);

create table if not exists assets.license_price_rules (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  name             text not null default '',
  usage_type       text not null default 'commercial',
  base_price_cents integer not null default 0,
  currency         text not null default 'usd',
  notes            text not null default '',
  is_active        boolean not null default true,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  metadata         jsonb not null default '{}'::jsonb,
  constraint license_price_rules_usage_chk check (usage_type in ('commercial', 'editorial', 'personal', 'broadcast', 'merchandising')),
  constraint license_price_rules_price_chk check (base_price_cents >= 0)
);

create table if not exists assets.license_quote_requests (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  requester_name  text not null default '',
  requester_email text not null default '',
  usage_type      text not null default 'commercial',
  territories     text not null default '',
  channels        text not null default '',
  duration_days   integer not null default 30,
  exclusivity     text not null default 'non_exclusive',
  estimated_cents integer not null default 0,
  status          text not null default 'pending',
  decided_at      timestamptz,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  constraint license_quote_requests_status_chk check (status in ('pending', 'quoted', 'approved', 'declined')),
  constraint license_quote_requests_excl_chk check (exclusivity in ('non_exclusive', 'exclusive')),
  constraint license_quote_requests_estimate_chk check (estimated_cents >= 0)
);

create table if not exists assets.issued_licenses (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  licensee_name    text not null default '',
  licensee_email   text not null default '',
  asset_name       text not null default '',
  template_id      uuid references assets.license_templates(id) on delete set null,
  usage_type       text not null default 'commercial',
  territories      text not null default '',
  channels         text not null default '',
  issue_date       timestamptz,
  start_date       timestamptz,
  end_date         timestamptz,
  status           text not null default 'pending',
  certificate_code text not null default '',
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  metadata         jsonb not null default '{}'::jsonb,
  constraint issued_licenses_status_chk check (status in ('pending', 'active', 'suspended', 'expired', 'revoked'))
);

create table if not exists assets.license_revenues (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  asset_name              text not null default '',
  license_id              uuid references assets.issued_licenses(id) on delete set null,
  licensee_name           text not null default '',
  revenue_type            text not null default 'license',
  gross_cents             integer not null default 0,
  royalty_rate_percent    numeric not null default 0,
  share_percent           numeric not null default 100,
  minimum_guarantee_cents integer not null default 0,
  recouped_cents          integer not null default 0,
  period_start            timestamptz,
  period_end              timestamptz,
  status                  text not null default 'pending',
  created_by              uuid,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  metadata                jsonb not null default '{}'::jsonb,
  constraint license_revenues_type_chk check (revenue_type in ('license', 'royalty')),
  constraint license_revenues_status_chk check (status in ('pending', 'collected', 'distributed')),
  constraint license_revenues_gross_chk check (gross_cents >= 0),
  constraint license_revenues_guarantee_chk check (minimum_guarantee_cents >= 0),
  constraint license_revenues_recouped_chk check (recouped_cents >= 0)
);

grant all on assets.license_rights to anon, authenticated, service_role;
grant all on assets.license_templates to anon, authenticated, service_role;
grant all on assets.license_price_rules to anon, authenticated, service_role;
grant all on assets.license_quote_requests to anon, authenticated, service_role;
grant all on assets.issued_licenses to anon, authenticated, service_role;
grant all on assets.license_revenues to anon, authenticated, service_role;

-- Screen lists: live rows of one project. Issued lookups: live licenses about
-- to end, ordered by end date.
create index if not exists license_rights_project_idx
  on assets.license_rights (project_id) where deleted_at is null;
create index if not exists license_templates_project_idx
  on assets.license_templates (project_id) where deleted_at is null;
create index if not exists license_price_rules_project_idx
  on assets.license_price_rules (project_id) where deleted_at is null;
create index if not exists license_quote_requests_project_idx
  on assets.license_quote_requests (project_id) where deleted_at is null;
create index if not exists issued_licenses_project_idx
  on assets.issued_licenses (project_id) where deleted_at is null;
create index if not exists issued_licenses_end_idx
  on assets.issued_licenses (end_date) where deleted_at is null;
create index if not exists license_revenues_project_idx
  on assets.license_revenues (project_id) where deleted_at is null;

drop trigger if exists license_rights_set_updated_at on assets.license_rights;
create trigger license_rights_set_updated_at
  before update on assets.license_rights
  for each row execute function assets.set_updated_at();

drop trigger if exists license_templates_set_updated_at on assets.license_templates;
create trigger license_templates_set_updated_at
  before update on assets.license_templates
  for each row execute function assets.set_updated_at();

drop trigger if exists license_price_rules_set_updated_at on assets.license_price_rules;
create trigger license_price_rules_set_updated_at
  before update on assets.license_price_rules
  for each row execute function assets.set_updated_at();

drop trigger if exists license_quote_requests_set_updated_at on assets.license_quote_requests;
create trigger license_quote_requests_set_updated_at
  before update on assets.license_quote_requests
  for each row execute function assets.set_updated_at();

drop trigger if exists issued_licenses_set_updated_at on assets.issued_licenses;
create trigger issued_licenses_set_updated_at
  before update on assets.issued_licenses
  for each row execute function assets.set_updated_at();

drop trigger if exists license_revenues_set_updated_at on assets.license_revenues;
create trigger license_revenues_set_updated_at
  before update on assets.license_revenues
  for each row execute function assets.set_updated_at();

alter table assets.license_rights enable row level security;
alter table assets.license_templates enable row level security;
alter table assets.license_price_rules enable row level security;
alter table assets.license_quote_requests enable row level security;
alter table assets.issued_licenses enable row level security;
alter table assets.license_revenues enable row level security;

drop policy if exists license_rights_demo_all on assets.license_rights;
create policy license_rights_demo_all on assets.license_rights
  for all to anon, authenticated using (true) with check (true);

drop policy if exists license_templates_demo_all on assets.license_templates;
create policy license_templates_demo_all on assets.license_templates
  for all to anon, authenticated using (true) with check (true);

drop policy if exists license_price_rules_demo_all on assets.license_price_rules;
create policy license_price_rules_demo_all on assets.license_price_rules
  for all to anon, authenticated using (true) with check (true);

drop policy if exists license_quote_requests_demo_all on assets.license_quote_requests;
create policy license_quote_requests_demo_all on assets.license_quote_requests
  for all to anon, authenticated using (true) with check (true);

drop policy if exists issued_licenses_demo_all on assets.issued_licenses;
create policy issued_licenses_demo_all on assets.issued_licenses
  for all to anon, authenticated using (true) with check (true);

drop policy if exists license_revenues_demo_all on assets.license_revenues;
create policy license_revenues_demo_all on assets.license_revenues
  for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists license_revenues_demo_all on assets.license_revenues;
drop policy if exists issued_licenses_demo_all on assets.issued_licenses;
drop policy if exists license_quote_requests_demo_all on assets.license_quote_requests;
drop policy if exists license_price_rules_demo_all on assets.license_price_rules;
drop policy if exists license_templates_demo_all on assets.license_templates;
drop policy if exists license_rights_demo_all on assets.license_rights;
drop index if exists assets.license_revenues_project_idx;
drop index if exists assets.issued_licenses_end_idx;
drop index if exists assets.issued_licenses_project_idx;
drop index if exists assets.license_quote_requests_project_idx;
drop index if exists assets.license_price_rules_project_idx;
drop index if exists assets.license_templates_project_idx;
drop index if exists assets.license_rights_project_idx;
drop table if exists assets.license_revenues;
drop table if exists assets.issued_licenses;
drop table if exists assets.license_quote_requests;
drop table if exists assets.license_price_rules;
drop table if exists assets.license_templates;
drop table if exists assets.license_rights;
