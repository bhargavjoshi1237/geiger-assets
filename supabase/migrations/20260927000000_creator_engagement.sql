-- Membership — engagement on the public creator page.
--
-- Two-way chat (fan replies land in assets.paid_messages as inbound rows),
-- multi-media posts and bundles of pay-per-view posts sold at one price, likes,
-- bookmarks and moderated comments on posts, and one-time password reset links
-- for fan accounts (issued by staff until email sending lands).
--
-- Reset tokens are server-only (no anon policy); everything else follows the
-- suite's demo-open RLS. Self-contained + idempotent: safe to re-run.

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

-- Chat -----------------------------------------------------------------------

alter table assets.paid_messages add column if not exists direction text not null default 'outbound';
alter table assets.paid_messages add column if not exists read_at timestamptz;
alter table assets.paid_messages drop constraint if exists paid_messages_direction_check;
alter table assets.paid_messages add constraint paid_messages_direction_check check (direction in ('outbound', 'inbound'));
create index if not exists paid_messages_thread_idx on assets.paid_messages (member_id, created_at) where deleted_at is null;

-- Posts: multi-media and engagement counters --------------------------------

alter table assets.ppv_posts add column if not exists asset_ids uuid[] not null default '{}';
alter table assets.ppv_posts add column if not exists like_count integer not null default 0;
alter table assets.ppv_posts add column if not exists comment_count integer not null default 0;

create table if not exists assets.post_likes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  post_id uuid not null references assets.ppv_posts(id) on delete cascade,
  fan_account_id uuid not null references assets.fan_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, fan_account_id)
);

create table if not exists assets.post_bookmarks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  post_id uuid not null references assets.ppv_posts(id) on delete cascade,
  fan_account_id uuid not null references assets.fan_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, fan_account_id)
);

create table if not exists assets.post_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  post_id uuid not null references assets.ppv_posts(id) on delete cascade,
  fan_account_id uuid references assets.fan_accounts(id) on delete set null,
  member_id uuid references assets.members(id) on delete set null,
  author_name text not null default '',
  is_creator boolean not null default false,
  body text not null default '',
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists post_likes_fan_idx on assets.post_likes (fan_account_id);
create index if not exists post_bookmarks_fan_idx on assets.post_bookmarks (fan_account_id);
create index if not exists post_comments_post_idx on assets.post_comments (post_id, created_at) where deleted_at is null;

-- Bundles ---------------------------------------------------------------------

create table if not exists assets.post_bundles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null default 'Untitled bundle',
  description text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'usd',
  post_ids uuid[] not null default '{}',
  cover_asset_id uuid references assets.assets(id) on delete set null,
  is_active boolean not null default true,
  sales_count integer not null default 0,
  revenue_cents integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists post_bundles_project_idx on assets.post_bundles (project_id) where deleted_at is null;

alter table assets.fan_payments drop constraint if exists fan_payments_kind_check;
alter table assets.fan_payments add constraint fan_payments_kind_check
  check (kind in ('subscription', 'tip', 'post_unlock', 'message_unlock', 'bundle_unlock'));

-- Password resets (server only) ------------------------------------------------

create table if not exists assets.fan_password_resets (
  id uuid primary key default gen_random_uuid(),
  fan_account_id uuid not null references assets.fan_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['post_comments', 'post_bundles'] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;

  foreach t in array array['post_likes', 'post_bookmarks', 'post_comments', 'post_bundles'] loop
    execute format('alter table assets.%I enable row level security', t);
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
    execute format(
      'create policy %I_demo_all on assets.%I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
    execute format('grant select, insert, update, delete on assets.%I to anon, authenticated, service_role', t);
  end loop;

  alter table assets.fan_password_resets enable row level security;
  revoke all on assets.fan_password_resets from anon, authenticated;
  grant select, insert, update, delete on assets.fan_password_resets to service_role;
end $$;

-- @down
drop table if exists assets.fan_password_resets;
alter table assets.fan_payments drop constraint if exists fan_payments_kind_check;
alter table assets.fan_payments add constraint fan_payments_kind_check
  check (kind in ('subscription', 'tip', 'post_unlock', 'message_unlock'));
drop table if exists assets.post_bundles;
drop table if exists assets.post_comments;
drop table if exists assets.post_bookmarks;
drop table if exists assets.post_likes;
alter table assets.ppv_posts drop column if exists comment_count;
alter table assets.ppv_posts drop column if exists like_count;
alter table assets.ppv_posts drop column if exists asset_ids;
drop index if exists assets.paid_messages_thread_idx;
alter table assets.paid_messages drop constraint if exists paid_messages_direction_check;
alter table assets.paid_messages drop column if exists read_at;
alter table assets.paid_messages drop column if exists direction;
