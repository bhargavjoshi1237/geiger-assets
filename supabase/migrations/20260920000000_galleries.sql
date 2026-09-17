-- Galleries domain — hosted galleries, showcases, domains, storefront,
-- downloads, products, checkout, orders, customers.
--
-- Owns assets.galleries, assets.showcases, assets.gallery_domains,
-- assets.storefront_pages, assets.digital_downloads, assets.gallery_products,
-- assets.checkout_configs, assets.gallery_orders, assets.gallery_customers.
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

create table if not exists assets.galleries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  collection_id uuid,
  name text not null default 'Untitled gallery',
  slug text not null default '',
  description text not null default '',
  layout text not null default 'grid' check (layout in ('grid', 'masonry', 'carousel', 'editorial', 'slideshow')),
  theme text not null default 'dark' check (theme in ('light', 'dark', 'auto', 'custom')),
  navigation_style text not null default 'topbar' check (navigation_style in ('topbar', 'sidebar', 'minimal', 'custom')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_published boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.showcases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  gallery_id uuid references assets.galleries(id) on delete set null,
  name text not null default 'Untitled showcase',
  description text not null default '',
  visibility text not null default 'private' check (visibility in ('public', 'private', 'password')),
  status text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  is_password_protected boolean not null default false,
  proofing_enabled boolean not null default false,
  downloads_enabled boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  favorite_count integer not null default 0 check (favorite_count >= 0),
  download_request_count integer not null default 0 check (download_request_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.gallery_domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  domain text not null default '',
  domain_type text not null default 'custom' check (domain_type in ('custom', 'subdomain')),
  ssl_status text not null default 'pending' check (ssl_status in ('pending', 'active', 'error')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified')),
  is_primary boolean not null default false,
  seo_title text not null default '',
  seo_description text not null default '',
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (project_id, domain)
);

create table if not exists assets.storefront_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled page',
  slug text not null default '',
  description text not null default '',
  page_type text not null default 'product' check (page_type in ('product', 'cart', 'checkout', 'policy', 'custom')),
  status text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  cart_enabled boolean not null default true,
  accounts_enabled boolean not null default false,
  is_published boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.digital_downloads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  asset_id uuid references assets.assets(id) on delete set null,
  name text not null default 'Untitled download',
  file_name text not null default '',
  rendition text not null default 'original' check (rendition in ('original', 'preview', 'thumb', 'poster')),
  status text not null default 'active' check (status in ('active', 'fulfilled', 'expired', 'revoked')),
  download_limit integer not null default 5 check (download_limit >= 0),
  download_count integer not null default 0 check (download_count >= 0),
  customer_email text not null default '',
  expires_at timestamptz,
  last_delivered_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.gallery_products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled product',
  description text not null default '',
  product_type text not null default 'digital' check (product_type in ('digital', 'license', 'bundle', 'package')),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'usd',
  license_type text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.checkout_configs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled checkout',
  description text not null default '',
  checkout_mode text not null default 'both' check (checkout_mode in ('guest', 'account', 'both')),
  payment_provider text not null default 'manual' check (payment_provider in ('manual', 'stripe', 'paypal', 'bank')),
  tax_enabled boolean not null default true,
  terms_required boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  is_default boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.gallery_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  customer_id uuid references assets.gallery_customers(id) on delete set null,
  order_number text not null default '',
  customer_name text not null default '',
  customer_email text not null default '',
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'failed', 'cancelled')),
  invoice_status text not null default 'draft' check (invoice_status in ('draft', 'sent', 'paid', 'overdue', 'void')),
  total_cents integer not null default 0 check (total_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  currency text not null default 'usd',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.gallery_customers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  organization text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  total_spent_cents integer not null default 0 check (total_spent_cents >= 0),
  order_count integer not null default 0 check (order_count >= 0),
  download_count integer not null default 0 check (download_count >= 0),
  notes text not null default '',
  last_seen_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists galleries_project_idx on assets.galleries (project_id) where deleted_at is null;
create index if not exists showcases_project_idx on assets.showcases (project_id) where deleted_at is null;
create index if not exists showcases_gallery_idx on assets.showcases (gallery_id) where deleted_at is null;
create index if not exists gallery_domains_project_idx on assets.gallery_domains (project_id) where deleted_at is null;
create index if not exists storefront_pages_project_idx on assets.storefront_pages (project_id) where deleted_at is null;
create index if not exists digital_downloads_project_idx on assets.digital_downloads (project_id) where deleted_at is null;
create index if not exists gallery_products_project_idx on assets.gallery_products (project_id) where deleted_at is null;
create index if not exists checkout_configs_project_idx on assets.checkout_configs (project_id) where deleted_at is null;
create index if not exists gallery_orders_project_idx on assets.gallery_orders (project_id) where deleted_at is null;
create index if not exists gallery_orders_customer_idx on assets.gallery_orders (customer_id) where deleted_at is null;
create index if not exists gallery_customers_project_idx on assets.gallery_customers (project_id) where deleted_at is null;

do $$
declare t text;
begin
  foreach t in array array[
    'galleries', 'showcases', 'gallery_domains', 'storefront_pages',
    'digital_downloads', 'gallery_products', 'checkout_configs',
    'gallery_orders', 'gallery_customers'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

alter table assets.galleries enable row level security;
alter table assets.showcases enable row level security;
alter table assets.gallery_domains enable row level security;
alter table assets.storefront_pages enable row level security;
alter table assets.digital_downloads enable row level security;
alter table assets.gallery_products enable row level security;
alter table assets.checkout_configs enable row level security;
alter table assets.gallery_orders enable row level security;
alter table assets.gallery_customers enable row level security;

drop policy if exists galleries_demo_all on assets.galleries;
create policy galleries_demo_all on assets.galleries for all to anon, authenticated using (true) with check (true);
drop policy if exists showcases_demo_all on assets.showcases;
create policy showcases_demo_all on assets.showcases for all to anon, authenticated using (true) with check (true);
drop policy if exists gallery_domains_demo_all on assets.gallery_domains;
create policy gallery_domains_demo_all on assets.gallery_domains for all to anon, authenticated using (true) with check (true);
drop policy if exists storefront_pages_demo_all on assets.storefront_pages;
create policy storefront_pages_demo_all on assets.storefront_pages for all to anon, authenticated using (true) with check (true);
drop policy if exists digital_downloads_demo_all on assets.digital_downloads;
create policy digital_downloads_demo_all on assets.digital_downloads for all to anon, authenticated using (true) with check (true);
drop policy if exists gallery_products_demo_all on assets.gallery_products;
create policy gallery_products_demo_all on assets.gallery_products for all to anon, authenticated using (true) with check (true);
drop policy if exists checkout_configs_demo_all on assets.checkout_configs;
create policy checkout_configs_demo_all on assets.checkout_configs for all to anon, authenticated using (true) with check (true);
drop policy if exists gallery_orders_demo_all on assets.gallery_orders;
create policy gallery_orders_demo_all on assets.gallery_orders for all to anon, authenticated using (true) with check (true);
drop policy if exists gallery_customers_demo_all on assets.gallery_customers;
create policy gallery_customers_demo_all on assets.gallery_customers for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists gallery_customers_demo_all on assets.gallery_customers;
drop policy if exists gallery_orders_demo_all on assets.gallery_orders;
drop policy if exists checkout_configs_demo_all on assets.checkout_configs;
drop policy if exists gallery_products_demo_all on assets.gallery_products;
drop policy if exists digital_downloads_demo_all on assets.digital_downloads;
drop policy if exists storefront_pages_demo_all on assets.storefront_pages;
drop policy if exists gallery_domains_demo_all on assets.gallery_domains;
drop policy if exists showcases_demo_all on assets.showcases;
drop policy if exists galleries_demo_all on assets.galleries;
drop table if exists assets.gallery_customers;
drop table if exists assets.gallery_orders;
drop table if exists assets.checkout_configs;
drop table if exists assets.gallery_products;
drop table if exists assets.digital_downloads;
drop table if exists assets.storefront_pages;
drop table if exists assets.gallery_domains;
drop table if exists assets.showcases;
drop table if exists assets.galleries;
