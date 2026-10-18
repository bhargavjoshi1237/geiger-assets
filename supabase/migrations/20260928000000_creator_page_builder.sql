-- Membership — the creator page builder and the fan lifecycle around it.
--
-- assets.creator_profiles gains a versioned page: page_draft is what the
-- workspace editor saves, page_config is what fans see, and publishing copies
-- one onto the other (page_published_at records when). Both hold the same JSON
-- shape — { theme, header, nav, sections[] } — see lib/creator/page_config.js.
--
-- assets.creator_follows is the free "follow" rung below a paid tier: a signed-in
-- fan who wants updates without subscribing. Follows reference the fan account,
-- so like fan_payments they are server (service role) only.
--
-- Self-contained + idempotent: safe to re-run.

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

alter table assets.creator_profiles add column if not exists page_draft jsonb;
alter table assets.creator_profiles add column if not exists page_config jsonb;
alter table assets.creator_profiles add column if not exists page_published_at timestamptz;

create table if not exists assets.creator_follows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  fan_account_id uuid not null references assets.fan_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (project_id, fan_account_id)
);

create index if not exists creator_follows_project_idx on assets.creator_follows (project_id);

alter table assets.creator_follows enable row level security;
revoke all on assets.creator_follows from anon, authenticated;
grant select, insert, update, delete on assets.creator_follows to service_role;

-- @down
drop table if exists assets.creator_follows;
alter table assets.creator_profiles drop column if exists page_published_at;
alter table assets.creator_profiles drop column if exists page_config;
alter table assets.creator_profiles drop column if exists page_draft;
