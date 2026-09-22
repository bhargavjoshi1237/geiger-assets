-- Galleries — hosted, branded pages that publish a collection or a curated set
-- of assets outside the workspace, plus the audience trail they generate.
--
-- Owns assets.galleries, assets.gallery_items, assets.gallery_domains,
-- assets.gallery_visitors, assets.gallery_favorites,
-- assets.gallery_download_requests, assets.gallery_events.
--
-- Distinct from assets.share_links: a share link is transient delivery keyed by
-- a random token, a gallery is a persistent branded page at a chosen slug with
-- layout, theme, navigation and SEO. The overlapping access columns (password,
-- expiry) are duplicated deliberately rather than shared.
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

-- The published page ---------------------------------------------------------

create table if not exists assets.galleries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  slug text not null default '',
  name text not null default 'Untitled gallery',
  headline text not null default '',
  description text not null default '',
  -- collection = live view of a collection; curated = explicit gallery_items list
  source_kind text not null default 'collection' check (source_kind in ('collection', 'curated')),
  collection_id uuid references assets.collections(id) on delete set null,
  cover_asset_id uuid references assets.assets(id) on delete set null,
  layout text not null default 'grid' check (layout in ('grid', 'masonry', 'justified', 'slideshow', 'single')),
  -- accent, ground, typography, thumb gap/radius, caption position
  theme jsonb not null default '{}'::jsonb,
  -- custom navigation links rendered in the public header
  nav jsonb not null default '[]'::jsonb,
  visibility text not null default 'private' check (visibility in ('public', 'unlisted', 'private')),
  -- Plaintext today, like assets.share_links. The compare happens server-side in
  -- the /g/<slug> route handler so it never reaches the client; hash it before
  -- treating this as real protection.
  password_hash text not null default '',
  require_email boolean not null default false,
  download_mode text not null default 'off' check (download_mode in ('open', 'request', 'off')),
  allow_favorites boolean not null default true,
  -- title, description, og image
  seo jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.gallery_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  gallery_id uuid not null references assets.galleries(id) on delete cascade,
  asset_id uuid references assets.assets(id) on delete cascade,
  position integer not null default 0,
  caption text not null default '',
  is_hidden boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Branded hosting ------------------------------------------------------------

create table if not exists assets.gallery_domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  -- null = project-wide domain available to every gallery
  gallery_id uuid references assets.galleries(id) on delete cascade,
  hostname citext not null,
  kind text not null default 'subdomain' check (kind in ('subdomain', 'custom')),
  verification_token text not null default '',
  dns_record_type text not null default 'TXT' check (dns_record_type in ('TXT', 'CNAME', 'A')),
  dns_record_name text not null default '',
  dns_record_value text not null default '',
  status text not null default 'pending' check (status in ('pending', 'verifying', 'active', 'failed')),
  ssl_status text not null default 'none' check (ssl_status in ('none', 'pending', 'issued', 'error')),
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- The audience ---------------------------------------------------------------

create table if not exists assets.gallery_visitors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  gallery_id uuid not null references assets.galleries(id) on delete cascade,
  -- anonymous browser identity, upgraded with name/email when the gallery asks
  token text not null,
  name text not null default '',
  email citext,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.gallery_favorites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  gallery_id uuid not null references assets.galleries(id) on delete cascade,
  visitor_id uuid not null references assets.gallery_visitors(id) on delete cascade,
  asset_id uuid not null references assets.assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.gallery_download_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  gallery_id uuid not null references assets.galleries(id) on delete cascade,
  visitor_id uuid references assets.gallery_visitors(id) on delete set null,
  scope text not null default 'gallery' check (scope in ('gallery', 'selection', 'asset')),
  asset_ids uuid[] not null default '{}',
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  decision_note text not null default '',
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Raw event rows. Deliberately not denormalized into counters — the Showcase
-- screen aggregates these so it can show trends, top assets and per-visitor
-- detail rather than a single number.
create table if not exists assets.gallery_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  gallery_id uuid not null references assets.galleries(id) on delete cascade,
  visitor_id uuid references assets.gallery_visitors(id) on delete set null,
  asset_id uuid references assets.assets(id) on delete set null,
  kind text not null default 'view' check (kind in ('view', 'item_view', 'favorite', 'unfavorite', 'download', 'request')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- Indexes --------------------------------------------------------------------

create index if not exists galleries_project_idx on assets.galleries (project_id) where deleted_at is null;
create index if not exists galleries_collection_idx on assets.galleries (collection_id) where deleted_at is null;
create index if not exists galleries_status_idx on assets.galleries (status) where deleted_at is null;
create unique index if not exists galleries_slug_key on assets.galleries (project_id, slug) where deleted_at is null and slug <> '';
create index if not exists gallery_items_gallery_idx on assets.gallery_items (gallery_id, position) where deleted_at is null;
create index if not exists gallery_items_asset_idx on assets.gallery_items (asset_id) where deleted_at is null;
create index if not exists gallery_domains_project_idx on assets.gallery_domains (project_id) where deleted_at is null;
create index if not exists gallery_domains_gallery_idx on assets.gallery_domains (gallery_id) where deleted_at is null;
create unique index if not exists gallery_domains_hostname_key on assets.gallery_domains (hostname) where deleted_at is null;
create index if not exists gallery_visitors_gallery_idx on assets.gallery_visitors (gallery_id) where deleted_at is null;
create unique index if not exists gallery_visitors_token_key on assets.gallery_visitors (gallery_id, token) where deleted_at is null;
create index if not exists gallery_favorites_gallery_idx on assets.gallery_favorites (gallery_id) where deleted_at is null;
create index if not exists gallery_favorites_visitor_idx on assets.gallery_favorites (visitor_id) where deleted_at is null;
create unique index if not exists gallery_favorites_key on assets.gallery_favorites (gallery_id, visitor_id, asset_id) where deleted_at is null;
create index if not exists gallery_download_requests_gallery_idx on assets.gallery_download_requests (gallery_id) where deleted_at is null;
create index if not exists gallery_download_requests_status_idx on assets.gallery_download_requests (status) where deleted_at is null;
create index if not exists gallery_events_gallery_idx on assets.gallery_events (gallery_id, occurred_at) where deleted_at is null;
create index if not exists gallery_events_asset_idx on assets.gallery_events (asset_id) where deleted_at is null;

-- Triggers -------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'galleries', 'gallery_items', 'gallery_domains', 'gallery_visitors',
    'gallery_favorites', 'gallery_download_requests', 'gallery_events'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- RLS ------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'galleries', 'gallery_items', 'gallery_domains', 'gallery_visitors',
    'gallery_favorites', 'gallery_download_requests', 'gallery_events'
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
    'galleries', 'gallery_items', 'gallery_domains', 'gallery_visitors',
    'gallery_favorites', 'gallery_download_requests', 'gallery_events'
  ] loop
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
  end loop;
end $$;

drop table if exists assets.gallery_events;
drop table if exists assets.gallery_download_requests;
drop table if exists assets.gallery_favorites;
drop table if exists assets.gallery_visitors;
drop table if exists assets.gallery_domains;
drop table if exists assets.gallery_items;
drop table if exists assets.galleries;
