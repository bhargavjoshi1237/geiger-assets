-- Gallery commerce — selling downloads, licences, prints and whole-gallery
-- unlocks from a published gallery, and everything that happens after a sale.
--
-- Owns assets.store_settings, assets.store_products, assets.store_price_sheets,
-- assets.store_discounts, assets.store_customers, assets.store_orders,
-- assets.store_order_items, assets.store_order_events and
-- assets.store_entitlements, plus the galleries.commerce bag.
--
-- Pricing layers, resolved by lib/commerce/pricing.js on both sides of the wire
-- (the checkout route always re-prices server-side — a client total is never
-- trusted):
--   1. store_products — reusable things to sell (a download size, a licence
--      tier backed by a licence template, a print, a bundle, a gallery unlock).
--   2. store_price_sheets — a named set of products with sheet-level prices.
--   3. galleries.commerce — which sheet a gallery sells from, per-asset price
--      overrides and direct per-asset prices, and a flat whole-gallery price.
--
-- After payment the checkout core records the order, grants download
-- entitlements and issues licences for licence products, then fires the
-- order.* workflow triggers — everything beyond that is a workflow ability.
--
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

-- Per-gallery selling config ---------------------------------------------------

alter table assets.galleries add column if not exists commerce jsonb not null default '{}'::jsonb;

-- Store-wide settings (one row per project) -------------------------------------

create table if not exists assets.store_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  -- name, support email, currency, accent
  store jsonb not null default '{}'::jsonb,
  -- guest checkout, collected fields, terms, minimum order, cart limits
  checkout jsonb not null default '{}'::jsonb,
  -- provider mode (auto / stripe / test / manual), statement descriptor
  payments jsonb not null default '{}'::jsonb,
  -- rate, label, inclusive
  taxes jsonb not null default '{}'::jsonb,
  -- default download limit / expiry, receipt copy
  fulfillment jsonb not null default '{}'::jsonb,
  -- terms, refund and privacy policy bodies
  policies jsonb not null default '{}'::jsonb,
  -- order / invoice prefixes, invoice footer, seller details
  invoices jsonb not null default '{}'::jsonb,
  next_order_number integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Catalogue ----------------------------------------------------------------------

create table if not exists assets.store_products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled product',
  description text not null default '',
  kind text not null default 'download' check (kind in ('download', 'license', 'print', 'physical', 'bundle', 'unlock')),
  price_cents integer not null default 0 check (price_cents >= 0),
  compare_at_cents integer not null default 0 check (compare_at_cents >= 0),
  currency text not null default 'usd',
  sku text not null default '',
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  -- download: rendition / format / limit / expiry; license: duration, usage,
  -- territories, channels, include download; print: size, paper, shipping;
  -- bundle: size, rendition. Kind-specific, normalized in the data layer.
  fulfillment jsonb not null default '{}'::jsonb,
  license_template_id uuid references assets.license_templates(id) on delete set null,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.store_price_sheets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled price sheet',
  description text not null default '',
  currency text not null default 'usd',
  -- [{ productId, priceCents|null (null = product price), position }]
  lines jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.store_discounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  code citext not null,
  description text not null default '',
  kind text not null default 'percent' check (kind in ('percent', 'fixed')),
  value integer not null default 0 check (value >= 0),
  min_subtotal_cents integer not null default 0 check (min_subtotal_cents >= 0),
  max_redemptions integer not null default 0 check (max_redemptions >= 0),
  redemptions integer not null default 0 check (redemptions >= 0),
  -- null = every gallery
  gallery_id uuid references assets.galleries(id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Buyers -------------------------------------------------------------------------

create table if not exists assets.store_customers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  email citext not null,
  name text not null default '',
  company text not null default '',
  phone text not null default '',
  country text not null default '',
  address jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  notes text not null default '',
  -- the licensee row licences are issued to, created on the first licence sale
  licensee_id uuid references assets.licensees(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'blocked')),
  marketing_opt_in boolean not null default false,
  orders_count integer not null default 0,
  total_spent_cents integer not null default 0,
  first_order_at timestamptz,
  last_order_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Orders -------------------------------------------------------------------------

create table if not exists assets.store_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  number text not null default '',
  gallery_id uuid references assets.galleries(id) on delete set null,
  customer_id uuid references assets.store_customers(id) on delete set null,
  email citext,
  name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'paid', 'fulfilled', 'partially_refunded', 'refunded', 'cancelled', 'failed')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled', 'partial', 'fulfilled')),
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  refunded_cents integer not null default 0,
  currency text not null default 'usd',
  discount_code text not null default '',
  provider text not null default 'test' check (provider in ('stripe', 'test', 'manual')),
  provider_ref text not null default '',
  -- opaque secret in the buyer's order / download page URL
  access_token text not null default encode(gen_random_bytes(18), 'hex'),
  billing jsonb not null default '{}'::jsonb,
  customer_note text not null default '',
  staff_note text not null default '',
  terms_accepted_at timestamptz,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  refunded_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.store_order_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  order_id uuid not null references assets.store_orders(id) on delete cascade,
  product_id uuid references assets.store_products(id) on delete set null,
  -- null for a whole-gallery unlock or a bundle's slot
  asset_id uuid references assets.assets(id) on delete set null,
  kind text not null default 'download',
  title text not null default '',
  product_name text not null default '',
  unit_cents integer not null default 0,
  quantity integer not null default 1 check (quantity > 0),
  total_cents integer not null default 0,
  -- product fulfilment config as it was at purchase time
  fulfillment jsonb not null default '{}'::jsonb,
  license_id uuid references assets.licenses(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'refunded', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.store_order_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  order_id uuid not null references assets.store_orders(id) on delete cascade,
  kind text not null default 'note',
  summary text not null default '',
  actor text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Digital downloads --------------------------------------------------------------

create table if not exists assets.store_entitlements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  order_id uuid references assets.store_orders(id) on delete cascade,
  order_item_id uuid references assets.store_order_items(id) on delete cascade,
  customer_id uuid references assets.store_customers(id) on delete set null,
  asset_id uuid not null references assets.assets(id) on delete cascade,
  token text not null default encode(gen_random_bytes(18), 'hex'),
  rendition text not null default 'original',
  max_downloads integer not null default 0 check (max_downloads >= 0),
  downloads_count integer not null default 0 check (downloads_count >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_downloaded_at timestamptz,
  source text not null default 'order' check (source in ('order', 'workflow', 'manual')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Indexes ------------------------------------------------------------------------

create unique index if not exists store_settings_project_key on assets.store_settings (project_id) where deleted_at is null;
create index if not exists store_products_project_idx on assets.store_products (project_id) where deleted_at is null;
create index if not exists store_price_sheets_project_idx on assets.store_price_sheets (project_id) where deleted_at is null;
create index if not exists store_discounts_project_idx on assets.store_discounts (project_id) where deleted_at is null;
create unique index if not exists store_discounts_code_key on assets.store_discounts (project_id, code) where deleted_at is null;
create index if not exists store_customers_project_idx on assets.store_customers (project_id) where deleted_at is null;
create unique index if not exists store_customers_email_key on assets.store_customers (project_id, email) where deleted_at is null;
create index if not exists store_orders_project_idx on assets.store_orders (project_id, created_at desc) where deleted_at is null;
create index if not exists store_orders_gallery_idx on assets.store_orders (gallery_id) where deleted_at is null;
create index if not exists store_orders_customer_idx on assets.store_orders (customer_id) where deleted_at is null;
create index if not exists store_orders_provider_ref_idx on assets.store_orders (provider_ref) where provider_ref <> '';
create index if not exists store_order_items_order_idx on assets.store_order_items (order_id) where deleted_at is null;
create index if not exists store_order_items_project_idx on assets.store_order_items (project_id) where deleted_at is null;
create index if not exists store_order_events_order_idx on assets.store_order_events (order_id, occurred_at) where deleted_at is null;
create index if not exists store_entitlements_project_idx on assets.store_entitlements (project_id) where deleted_at is null;
create index if not exists store_entitlements_order_idx on assets.store_entitlements (order_id) where deleted_at is null;
create unique index if not exists store_entitlements_token_key on assets.store_entitlements (token);

-- Order numbers ------------------------------------------------------------------

-- Hands out the next order number for a project atomically, creating the
-- settings row on first use. Returns the bare integer; the prefix is applied
-- by the caller from store_settings.invoices.
create or replace function assets.store_next_order_number(p_project_id uuid)
returns integer
language plpgsql
as $$
declare n integer;
begin
  insert into assets.store_settings (project_id)
  select p_project_id
  where not exists (
    select 1 from assets.store_settings where project_id = p_project_id and deleted_at is null
  );
  update assets.store_settings
     set next_order_number = next_order_number + 1
   where project_id = p_project_id and deleted_at is null
  returning next_order_number - 1 into n;
  return coalesce(n, 1);
end;
$$;

grant execute on function assets.store_next_order_number(uuid) to anon, authenticated, service_role;

-- Triggers -----------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'store_settings', 'store_products', 'store_price_sheets', 'store_discounts',
    'store_customers', 'store_orders', 'store_order_items', 'store_order_events',
    'store_entitlements'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- RLS ----------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'store_settings', 'store_products', 'store_price_sheets', 'store_discounts',
    'store_customers', 'store_orders', 'store_order_items', 'store_order_events',
    'store_entitlements'
  ] loop
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
do $$
declare t text;
begin
  foreach t in array array[
    'store_settings', 'store_products', 'store_price_sheets', 'store_discounts',
    'store_customers', 'store_orders', 'store_order_items', 'store_order_events',
    'store_entitlements'
  ] loop
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
  end loop;
end $$;

drop function if exists assets.store_next_order_number(uuid);
drop table if exists assets.store_entitlements;
drop table if exists assets.store_order_events;
drop table if exists assets.store_order_items;
drop table if exists assets.store_orders;
drop table if exists assets.store_customers;
drop table if exists assets.store_discounts;
drop table if exists assets.store_price_sheets;
drop table if exists assets.store_products;
drop table if exists assets.store_settings;
alter table assets.galleries drop column if exists commerce;
