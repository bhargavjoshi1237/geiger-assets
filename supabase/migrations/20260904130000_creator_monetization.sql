-- Creator monetization — Patreon-style tiers + OnlyFans-style PPV, paid DMs, tips, payouts.
--
-- Owns assets.membership_tiers, assets.members, assets.subscriptions,
-- assets.ppv_posts, assets.ppv_unlocks, assets.paid_messages,
-- assets.tips, assets.payouts, assets.promo_codes, assets.promo_redemptions.
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

create table if not exists assets.membership_tiers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled tier',
  description text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'usd',
  interval text not null default 'month' check (interval in ('month', 'year', 'one_time')),
  is_free boolean not null default false,
  is_active boolean not null default true,
  position integer not null default 0,
  perks jsonb not null default '[]'::jsonb,
  stripe_price_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  fan_name text not null default '',
  fan_email citext,
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled', 'blocked')),
  total_spent_cents integer not null default 0,
  last_seen_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.subscriptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  member_id uuid not null references assets.members(id) on delete cascade,
  tier_id uuid references assets.membership_tiers(id) on delete set null,
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.ppv_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null default 'Untitled PPV',
  teaser_text text not null default '',
  asset_id uuid references assets.assets(id) on delete set null,
  price_cents integer not null default 500 check (price_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  unlock_count integer not null default 0,
  revenue_cents integer not null default 0,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.ppv_unlocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  ppv_post_id uuid not null references assets.ppv_posts(id) on delete cascade,
  member_id uuid not null references assets.members(id) on delete cascade,
  price_cents integer not null default 0,
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (ppv_post_id, member_id)
);

create table if not exists assets.paid_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  member_id uuid references assets.members(id) on delete cascade,
  batch_id uuid,
  body text not null default '',
  attachment_asset_id uuid references assets.assets(id) on delete set null,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'locked' check (status in ('draft', 'locked', 'unlocked', 'expired')),
  sent_at timestamptz,
  unlocked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.tips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  member_id uuid references assets.members(id) on delete set null,
  target_type text not null default 'profile' check (target_type in ('profile', 'post', 'message', 'stream')),
  target_id uuid,
  amount_cents integer not null default 0 check (amount_cents > 0),
  currency text not null default 'usd',
  note text not null default '',
  status text not null default 'succeeded' check (status in ('pending', 'succeeded', 'refunded')),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.payouts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  period_start timestamptz,
  period_end timestamptz,
  gross_cents integer not null default 0,
  fees_cents integer not null default 0,
  net_cents integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed')),
  destination text not null default '',
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists assets.promo_codes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  code citext not null,
  kind text not null default 'discount' check (kind in ('discount', 'trial', 'free_month')),
  percent_off integer check (percent_off is null or (percent_off >= 1 and percent_off <= 100)),
  amount_off_cents integer check (amount_off_cents is null or amount_off_cents >= 0),
  duration_months integer not null default 1,
  max_redemptions integer,
  redeemed_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (project_id, code)
);

create table if not exists assets.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  promo_id uuid not null references assets.promo_codes(id) on delete cascade,
  member_id uuid not null references assets.members(id) on delete cascade,
  subscription_id uuid references assets.subscriptions(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (promo_id, member_id)
);

create index if not exists membership_tiers_project_idx on assets.membership_tiers (project_id) where deleted_at is null;
create index if not exists members_project_idx on assets.members (project_id) where deleted_at is null;
create index if not exists subscriptions_member_idx on assets.subscriptions (member_id) where deleted_at is null;
create index if not exists subscriptions_tier_idx on assets.subscriptions (tier_id) where deleted_at is null;
create index if not exists ppv_posts_project_idx on assets.ppv_posts (project_id) where deleted_at is null;
create index if not exists paid_messages_member_idx on assets.paid_messages (member_id) where deleted_at is null;
create index if not exists paid_messages_batch_idx on assets.paid_messages (batch_id) where deleted_at is null;
create index if not exists tips_member_idx on assets.tips (member_id);
create index if not exists payouts_project_idx on assets.payouts (project_id) where deleted_at is null;

do $$
declare t text;
begin
  foreach t in array array[
    'membership_tiers', 'members', 'subscriptions', 'ppv_posts',
    'paid_messages', 'payouts', 'promo_codes'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

alter table assets.membership_tiers enable row level security;
alter table assets.members enable row level security;
alter table assets.subscriptions enable row level security;
alter table assets.ppv_posts enable row level security;
alter table assets.ppv_unlocks enable row level security;
alter table assets.paid_messages enable row level security;
alter table assets.tips enable row level security;
alter table assets.payouts enable row level security;
alter table assets.promo_codes enable row level security;
alter table assets.promo_redemptions enable row level security;

drop policy if exists membership_tiers_demo_all on assets.membership_tiers;
create policy membership_tiers_demo_all on assets.membership_tiers for all to anon, authenticated using (true) with check (true);
drop policy if exists members_demo_all on assets.members;
create policy members_demo_all on assets.members for all to anon, authenticated using (true) with check (true);
drop policy if exists subscriptions_demo_all on assets.subscriptions;
create policy subscriptions_demo_all on assets.subscriptions for all to anon, authenticated using (true) with check (true);
drop policy if exists ppv_posts_demo_all on assets.ppv_posts;
create policy ppv_posts_demo_all on assets.ppv_posts for all to anon, authenticated using (true) with check (true);
drop policy if exists ppv_unlocks_demo_all on assets.ppv_unlocks;
create policy ppv_unlocks_demo_all on assets.ppv_unlocks for all to anon, authenticated using (true) with check (true);
drop policy if exists paid_messages_demo_all on assets.paid_messages;
create policy paid_messages_demo_all on assets.paid_messages for all to anon, authenticated using (true) with check (true);
drop policy if exists tips_demo_all on assets.tips;
create policy tips_demo_all on assets.tips for all to anon, authenticated using (true) with check (true);
drop policy if exists payouts_demo_all on assets.payouts;
create policy payouts_demo_all on assets.payouts for all to anon, authenticated using (true) with check (true);
drop policy if exists promo_codes_demo_all on assets.promo_codes;
create policy promo_codes_demo_all on assets.promo_codes for all to anon, authenticated using (true) with check (true);
drop policy if exists promo_redemptions_demo_all on assets.promo_redemptions;
create policy promo_redemptions_demo_all on assets.promo_redemptions for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists promo_redemptions_demo_all on assets.promo_redemptions;
drop policy if exists promo_codes_demo_all on assets.promo_codes;
drop policy if exists payouts_demo_all on assets.payouts;
drop policy if exists tips_demo_all on assets.tips;
drop policy if exists paid_messages_demo_all on assets.paid_messages;
drop policy if exists ppv_unlocks_demo_all on assets.ppv_unlocks;
drop policy if exists ppv_posts_demo_all on assets.ppv_posts;
drop policy if exists subscriptions_demo_all on assets.subscriptions;
drop policy if exists members_demo_all on assets.members;
drop policy if exists membership_tiers_demo_all on assets.membership_tiers;
drop table if exists assets.promo_redemptions;
drop table if exists assets.promo_codes;
drop table if exists assets.payouts;
drop table if exists assets.tips;
drop table if exists assets.paid_messages;
drop table if exists assets.ppv_unlocks;
drop table if exists assets.ppv_posts;
drop table if exists assets.subscriptions;
drop table if exists assets.members;
drop table if exists assets.membership_tiers;
