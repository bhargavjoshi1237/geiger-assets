-- Collaboration — sharing, approvals, team, and the conversation layer.
--
-- Five surfaces, one domain:
--   share_links        outbound access to an asset or collection, revocable
--   approval_pipelines reusable routing: ordered stages of approvers per subject type
--   approval_reviews   one review in flight (+ items, + decision history)
--   team_invitations   email invites for members, guests, and external reviewers
--   comments           threaded, optionally pinned to a point/time/page on an asset
--   activity_events    append-only feed of what happened across the project
--
-- The spine is `subject_type` + `subject_id`: a polymorphic pointer used by
-- pipelines, reviews, comments, and activity alike. The catalog of valid
-- subject types lives in the UI (collaboration/constants.js) rather than a
-- check constraint, so a subject can be listed before its table exists.
--
-- Self-contained + idempotent: safe to re-run. Follows suite conventions
-- (uuid pk, project_id scoping, metadata bag, touch_updated_at, demo-open RLS).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

-- Defined locally so this file stands alone, per SUPABASE_CONVENTIONS.md.
create or replace function assets.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shared links — every way an asset leaves the workspace, in one revocable place
-- ---------------------------------------------------------------------------
create table if not exists assets.share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled link',
  token text not null unique,
  subject_type text not null default 'asset',
  subject_id uuid,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  password_hash text not null default '',
  expires_at timestamptz,
  allow_download boolean not null default true,
  allow_comments boolean not null default false,
  require_email boolean not null default false,
  status text not null default 'active' check (status in ('active', 'paused', 'expired', 'revoked')),
  view_count integer not null default 0,
  download_count integer not null default 0,
  last_viewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists share_links_project_idx on assets.share_links (project_id) where deleted_at is null;
create index if not exists share_links_status_idx on assets.share_links (status) where deleted_at is null;
create index if not exists share_links_subject_idx on assets.share_links (subject_type, subject_id) where deleted_at is null;
create unique index if not exists share_links_token_uniq on assets.share_links (token) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Approval pipelines — who signs off on what, in which order
--
-- `stages` is the canonical routing logic, an ordered array of:
--   { id, name, approverType: 'role'|'member', roleId, memberIds[],
--     minApprovals: int, advance: 'sequential'|'anytime',
--     allowChangeRequests: bool, slaHours: int|null }
-- `mode` is the pipeline-level default that a stage's `advance` overrides.
-- ---------------------------------------------------------------------------
create table if not exists assets.approval_pipelines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'Untitled pipeline',
  description text not null default '',
  subject_type text not null default 'asset',
  status text not null default 'Draft' check (status in ('Draft', 'Active', 'Paused')),
  mode text not null default 'sequential' check (mode in ('sequential', 'anytime')),
  is_default boolean not null default false,
  stages jsonb not null default '[]'::jsonb,
  auto_lock_version boolean not null default true,
  auto_stamp_status boolean not null default true,
  review_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists approval_pipelines_project_idx on assets.approval_pipelines (project_id) where deleted_at is null;
create index if not exists approval_pipelines_subject_idx on assets.approval_pipelines (subject_type) where deleted_at is null;
-- At most one default pipeline per subject type per project.
create unique index if not exists approval_pipelines_default_uniq
  on assets.approval_pipelines (project_id, subject_type)
  where is_default and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Approval reviews — a named review of N items, walking a pipeline's stages
-- ---------------------------------------------------------------------------
create table if not exists assets.approval_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  pipeline_id uuid references assets.approval_pipelines(id) on delete set null,
  name text not null default 'Untitled review',
  description text not null default '',
  subject_type text not null default 'asset',
  subject_id uuid,
  status text not null default 'Pending'
    check (status in ('Pending', 'In Review', 'Changes Requested', 'Approved', 'Rejected', 'Cancelled')),
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Urgent')),
  current_stage integer not null default 0,
  stage_snapshot jsonb not null default '[]'::jsonb,
  due_at timestamptz,
  completed_at timestamptz,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists approval_reviews_project_idx on assets.approval_reviews (project_id) where deleted_at is null;
create index if not exists approval_reviews_status_idx on assets.approval_reviews (status) where deleted_at is null;
create index if not exists approval_reviews_pipeline_idx on assets.approval_reviews (pipeline_id) where deleted_at is null;
create index if not exists approval_reviews_due_idx on assets.approval_reviews (due_at) where deleted_at is null;

-- One row per item under review, carrying that item's own decision.
create table if not exists assets.approval_review_items (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references assets.approval_reviews(id) on delete cascade,
  asset_id uuid references assets.assets(id) on delete cascade,
  subject_type text not null default 'asset',
  subject_id uuid,
  label text not null default '',
  decision text not null default 'pending'
    check (decision in ('pending', 'approved', 'rejected', 'changes')),
  note text not null default '',
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists approval_review_items_review_idx on assets.approval_review_items (review_id);
create index if not exists approval_review_items_asset_idx on assets.approval_review_items (asset_id);

-- Append-only decision log — the "approval history" the registry asks for.
create table if not exists assets.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references assets.approval_reviews(id) on delete cascade,
  stage_index integer not null default 0,
  stage_name text not null default '',
  decision text not null default 'approved'
    check (decision in ('approved', 'rejected', 'changes', 'reassigned', 'cancelled', 'reopened')),
  note text not null default '',
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default '',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists approval_decisions_review_idx on assets.approval_decisions (review_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Team invitations — reaches people who aren't yet in the org
-- ---------------------------------------------------------------------------
create table if not exists assets.team_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  email text not null default '',
  name text not null default '',
  role_id uuid references public.roles(id) on delete set null,
  kind text not null default 'member' check (kind in ('member', 'guest', 'reviewer')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token text not null unique,
  message text not null default '',
  scope jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists team_invitations_project_idx on assets.team_invitations (project_id) where deleted_at is null;
create index if not exists team_invitations_status_idx on assets.team_invitations (status) where deleted_at is null;
create unique index if not exists team_invitations_email_uniq
  on assets.team_invitations (project_id, lower(email))
  where status = 'pending' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Comments — threaded, optionally pinned to a spot on the asset
--
-- `anchor` carries the pin: { x, y } for images, { t } seconds for video/audio,
-- { page, x, y } for documents. Null anchor is a plain thread comment.
-- ---------------------------------------------------------------------------
create table if not exists assets.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  parent_id uuid references assets.comments(id) on delete cascade,
  subject_type text not null default 'asset',
  subject_id uuid,
  asset_id uuid references assets.assets(id) on delete cascade,
  review_id uuid references assets.approval_reviews(id) on delete cascade,
  body text not null default '',
  anchor jsonb,
  mentions uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'resolved')),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default '',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists comments_project_idx on assets.comments (project_id, created_at desc) where deleted_at is null;
create index if not exists comments_subject_idx on assets.comments (subject_type, subject_id) where deleted_at is null;
create index if not exists comments_asset_idx on assets.comments (asset_id) where deleted_at is null;
create index if not exists comments_parent_idx on assets.comments (parent_id) where deleted_at is null;
create index if not exists comments_status_idx on assets.comments (status) where deleted_at is null and parent_id is null;

-- ---------------------------------------------------------------------------
-- Activity events — append-only. Written by the data layer on notable writes.
-- ---------------------------------------------------------------------------
create table if not exists assets.activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  verb text not null default '',
  summary text not null default '',
  subject_type text not null default '',
  subject_id uuid,
  subject_label text not null default '',
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default '',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists activity_events_project_idx on assets.activity_events (project_id, created_at desc);
create index if not exists activity_events_verb_idx on assets.activity_events (verb);
create index if not exists activity_events_subject_idx on assets.activity_events (subject_type, subject_id);

-- ---------------------------------------------------------------------------
-- Approved-version locking — the side effect of a passed review
-- ---------------------------------------------------------------------------
alter table assets.asset_versions add column if not exists is_locked boolean not null default false;
alter table assets.asset_versions add column if not exists approved_at timestamptz;
alter table assets.asset_versions add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table assets.asset_versions add column if not exists review_id uuid references assets.approval_reviews(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Triggers, grants, RLS
-- ---------------------------------------------------------------------------
drop trigger if exists share_links_touch_updated_at on assets.share_links;
create trigger share_links_touch_updated_at
  before update on assets.share_links
  for each row execute function assets.touch_updated_at();

drop trigger if exists approval_pipelines_touch_updated_at on assets.approval_pipelines;
create trigger approval_pipelines_touch_updated_at
  before update on assets.approval_pipelines
  for each row execute function assets.touch_updated_at();

drop trigger if exists approval_reviews_touch_updated_at on assets.approval_reviews;
create trigger approval_reviews_touch_updated_at
  before update on assets.approval_reviews
  for each row execute function assets.touch_updated_at();

drop trigger if exists team_invitations_touch_updated_at on assets.team_invitations;
create trigger team_invitations_touch_updated_at
  before update on assets.team_invitations
  for each row execute function assets.touch_updated_at();

drop trigger if exists comments_touch_updated_at on assets.comments;
create trigger comments_touch_updated_at
  before update on assets.comments
  for each row execute function assets.touch_updated_at();

grant all on assets.share_links to anon, authenticated, service_role;
grant all on assets.approval_pipelines to anon, authenticated, service_role;
grant all on assets.approval_reviews to anon, authenticated, service_role;
grant all on assets.approval_review_items to anon, authenticated, service_role;
grant all on assets.approval_decisions to anon, authenticated, service_role;
grant all on assets.team_invitations to anon, authenticated, service_role;
grant all on assets.comments to anon, authenticated, service_role;
grant all on assets.activity_events to anon, authenticated, service_role;

alter table assets.share_links enable row level security;
alter table assets.approval_pipelines enable row level security;
alter table assets.approval_reviews enable row level security;
alter table assets.approval_review_items enable row level security;
alter table assets.approval_decisions enable row level security;
alter table assets.team_invitations enable row level security;
alter table assets.comments enable row level security;
alter table assets.activity_events enable row level security;

drop policy if exists share_links_demo_all on assets.share_links;
create policy share_links_demo_all on assets.share_links for all to anon, authenticated using (true) with check (true);

drop policy if exists approval_pipelines_demo_all on assets.approval_pipelines;
create policy approval_pipelines_demo_all on assets.approval_pipelines for all to anon, authenticated using (true) with check (true);

drop policy if exists approval_reviews_demo_all on assets.approval_reviews;
create policy approval_reviews_demo_all on assets.approval_reviews for all to anon, authenticated using (true) with check (true);

drop policy if exists approval_review_items_demo_all on assets.approval_review_items;
create policy approval_review_items_demo_all on assets.approval_review_items for all to anon, authenticated using (true) with check (true);

drop policy if exists approval_decisions_demo_all on assets.approval_decisions;
create policy approval_decisions_demo_all on assets.approval_decisions for all to anon, authenticated using (true) with check (true);

drop policy if exists team_invitations_demo_all on assets.team_invitations;
create policy team_invitations_demo_all on assets.team_invitations for all to anon, authenticated using (true) with check (true);

drop policy if exists comments_demo_all on assets.comments;
create policy comments_demo_all on assets.comments for all to anon, authenticated using (true) with check (true);

drop policy if exists activity_events_demo_all on assets.activity_events;
create policy activity_events_demo_all on assets.activity_events for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Share-link resolution for the public page. security definer so an anonymous
-- visitor can resolve a token without read access to the whole table.
-- Returns at most one row; expired/revoked/deleted links resolve to nothing.
-- ---------------------------------------------------------------------------
create or replace function assets.resolve_share_link(p_token text)
returns table (
  id uuid,
  name text,
  subject_type text,
  subject_id uuid,
  visibility text,
  allow_download boolean,
  allow_comments boolean,
  has_password boolean,
  expires_at timestamptz
)
language sql
security definer
set search_path = assets, public
as $$
  select s.id, s.name, s.subject_type, s.subject_id, s.visibility,
         s.allow_download, s.allow_comments,
         length(s.password_hash) > 0 as has_password,
         s.expires_at
  from assets.share_links s
  where s.token = p_token
    and s.deleted_at is null
    and s.status = 'active'
    and (s.expires_at is null or s.expires_at > now())
  limit 1;
$$;

grant execute on function assets.resolve_share_link(text) to anon, authenticated, service_role;

-- Bump a link's view counter without granting the visitor table-level update.
create or replace function assets.touch_share_link(p_token text)
returns void
language sql
security definer
set search_path = assets, public
as $$
  update assets.share_links
     set view_count = view_count + 1,
         last_viewed_at = now()
   where token = p_token and deleted_at is null and status = 'active';
$$;

grant execute on function assets.touch_share_link(text) to anon, authenticated, service_role;

-- @down
drop function if exists assets.touch_share_link(text);
drop function if exists assets.resolve_share_link(text);
-- Drop the back-references into approval_reviews before the table itself.
alter table assets.asset_versions drop column if exists review_id;
alter table assets.asset_versions drop column if exists approved_by;
alter table assets.asset_versions drop column if exists approved_at;
alter table assets.asset_versions drop column if exists is_locked;
drop table if exists assets.activity_events;
drop table if exists assets.comments;
drop table if exists assets.team_invitations;
drop table if exists assets.approval_decisions;
drop table if exists assets.approval_review_items;
drop table if exists assets.approval_reviews;
drop table if exists assets.approval_pipelines;
drop table if exists assets.share_links;
