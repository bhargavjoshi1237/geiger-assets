-- Imported from assets_modules.sql by geiger-orm.
-- No @down section — this migration cannot be rolled back.

-- @up
-- =============================================================================
-- Geiger Assets — supporting module tables
--
-- Runs AFTER assets.sql (filename order: "assets." < "assets_"). Adds the tables
-- behind the Assets sidebar modules: Upload Center, External Uploads, Collections,
-- Folders & Storage, Duplicate Review, and Asset Requests. (Archive & Trash needs
-- no table — it is a filtered view over assets.assets.)
--
-- All objects live in the `assets` schema and reuse assets.set_updated_at()
-- (defined in assets.sql). Idempotent + self-contained. Demo policy: open.
-- =============================================================================

create schema if not exists assets;

-- ---------------------------------------------------------------------------
-- Upload Center — assets.upload_jobs
-- ---------------------------------------------------------------------------

create table if not exists assets.upload_jobs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete cascade,
  filename    text not null default '',
  file_type   text not null default 'image',
  size_bytes  bigint not null default 0,
  status      text not null default 'queued',
  progress    integer not null default 0,
  source      text not null default 'drag-drop',
  error       text not null default '',
  asset_id    uuid references assets.assets(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  metadata    jsonb not null default '{}'::jsonb,
  constraint upload_jobs_status_chk check (
    status in ('queued','uploading','processing','completed','failed')
  ),
  constraint upload_jobs_source_chk check (
    source in ('drag-drop','folder','zip','cloud','url')
  )
);

-- ---------------------------------------------------------------------------
-- External Uploads — assets.upload_portals + assets.upload_submissions
-- ---------------------------------------------------------------------------

create table if not exists assets.upload_portals (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid references public.projects(id) on delete cascade,
  name               text not null default '',
  type               text not null default 'link',
  slug               text not null default '',
  status             text not null default 'active',
  require_metadata   boolean not null default false,
  destination_folder text not null default 'root',
  expires_at         timestamptz,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  metadata           jsonb not null default '{}'::jsonb,
  constraint upload_portals_type_chk check (type in ('link','form')),
  constraint upload_portals_status_chk check (status in ('active','paused','expired'))
);

create table if not exists assets.upload_submissions (
  id              uuid primary key default gen_random_uuid(),
  portal_id       uuid not null references assets.upload_portals(id) on delete cascade,
  submitter_name  text not null default '',
  submitter_email text not null default '',
  file_count      integer not null default 0,
  status          text not null default 'pending',
  note            text not null default '',
  created_at      timestamptz not null default now(),
  metadata        jsonb not null default '{}'::jsonb,
  constraint upload_submissions_status_chk check (status in ('pending','approved','rejected'))
);

-- ---------------------------------------------------------------------------
-- Collections — assets.collections + assets.collection_assets
-- ---------------------------------------------------------------------------

create table if not exists assets.collections (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete cascade,
  name        text not null default '',
  description text not null default '',
  type        text not null default 'manual',
  cover_color text not null default '#737373',
  status      text not null default 'active',
  is_favorite boolean not null default false,
  visibility  text not null default 'private',
  created_by  uuid references auth.users(id) on delete set null,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  metadata    jsonb not null default '{}'::jsonb,
  constraint collections_type_chk check (type in ('manual','smart','album','board')),
  constraint collections_status_chk check (status in ('active','archived')),
  constraint collections_visibility_chk check (visibility in ('private','team','public'))
);

create table if not exists assets.collection_assets (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references assets.collections(id) on delete cascade,
  asset_id      uuid not null references assets.assets(id) on delete cascade,
  position      integer not null default 0,
  added_at      timestamptz not null default now(),
  constraint collection_assets_unique unique (collection_id, asset_id)
);

-- ---------------------------------------------------------------------------
-- Folders & Storage — assets.folders (self-referencing tree)
-- ---------------------------------------------------------------------------

create table if not exists assets.folders (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid references public.projects(id) on delete cascade,
  name             text not null default '',
  parent_id        uuid references assets.folders(id) on delete set null,
  path             text not null default '',
  storage_location text not null default 'hot',
  color            text not null default '#737373',
  size_bytes       bigint not null default 0,
  created_by       uuid references auth.users(id) on delete set null,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  metadata         jsonb not null default '{}'::jsonb,
  constraint folders_storage_chk check (
    storage_location in ('hot','cold','cloud-s3','cloud-gcs')
  )
);

-- ---------------------------------------------------------------------------
-- Duplicate Review — assets.duplicate_groups + assets.duplicate_members
-- ---------------------------------------------------------------------------

create table if not exists assets.duplicate_groups (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid references public.projects(id) on delete cascade,
  match_type         text not null default 'exact',
  similarity         numeric(5,2) not null default 100,
  status             text not null default 'open',
  recommended_action text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  metadata           jsonb not null default '{}'::jsonb,
  constraint duplicate_groups_match_chk check (match_type in ('exact','near','visual')),
  constraint duplicate_groups_status_chk check (status in ('open','resolved','ignored'))
);

create table if not exists assets.duplicate_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references assets.duplicate_groups(id) on delete cascade,
  asset_id   uuid not null references assets.assets(id) on delete cascade,
  is_keeper  boolean not null default false,
  created_at timestamptz not null default now(),
  constraint duplicate_members_unique unique (group_id, asset_id)
);

-- ---------------------------------------------------------------------------
-- Asset Requests — assets.asset_requests
-- ---------------------------------------------------------------------------

create table if not exists assets.asset_requests (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid references public.projects(id) on delete cascade,
  title              text not null default '',
  description        text not null default '',
  requester          text not null default '',
  assignee           text not null default '',
  priority           text not null default 'medium',
  status             text not null default 'open',
  due_date           date,
  reference_asset_id uuid references assets.assets(id) on delete set null,
  created_by         uuid references auth.users(id) on delete set null,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  metadata           jsonb not null default '{}'::jsonb,
  constraint asset_requests_priority_chk check (priority in ('low','medium','high','urgent')),
  constraint asset_requests_status_chk check (
    status in ('open','in_progress','submitted','approved','closed')
  )
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant all on assets.upload_jobs        to anon, authenticated, service_role;
grant all on assets.upload_portals     to anon, authenticated, service_role;
grant all on assets.upload_submissions to anon, authenticated, service_role;
grant all on assets.collections        to anon, authenticated, service_role;
grant all on assets.collection_assets  to anon, authenticated, service_role;
grant all on assets.folders            to anon, authenticated, service_role;
grant all on assets.duplicate_groups   to anon, authenticated, service_role;
grant all on assets.duplicate_members  to anon, authenticated, service_role;
grant all on assets.asset_requests     to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists upload_jobs_status_idx on assets.upload_jobs (status, created_at desc);
create index if not exists upload_jobs_project_idx on assets.upload_jobs (project_id);
create index if not exists upload_jobs_asset_idx on assets.upload_jobs (asset_id);

create unique index if not exists upload_portals_slug_idx on assets.upload_portals (slug) where slug <> '';
create index if not exists upload_portals_status_idx on assets.upload_portals (status, updated_at desc);
create index if not exists upload_submissions_portal_idx on assets.upload_submissions (portal_id, created_at desc);

create index if not exists collections_active_idx on assets.collections (updated_at desc) where deleted_at is null;
create index if not exists collections_type_idx on assets.collections (type) where deleted_at is null;
create index if not exists collection_assets_collection_idx on assets.collection_assets (collection_id, position);
create index if not exists collection_assets_asset_idx on assets.collection_assets (asset_id);

create index if not exists folders_parent_idx on assets.folders (parent_id) where deleted_at is null;
create index if not exists folders_project_idx on assets.folders (project_id) where deleted_at is null;

create index if not exists duplicate_groups_status_idx on assets.duplicate_groups (status, created_at desc);
create index if not exists duplicate_members_group_idx on assets.duplicate_members (group_id);
create index if not exists duplicate_members_asset_idx on assets.duplicate_members (asset_id);

create index if not exists asset_requests_status_idx on assets.asset_requests (status, due_date) where deleted_at is null;
create index if not exists asset_requests_assignee_idx on assets.asset_requests (assignee) where deleted_at is null;
create index if not exists asset_requests_ref_idx on assets.asset_requests (reference_asset_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse assets.set_updated_at from assets.sql)
-- ---------------------------------------------------------------------------

drop trigger if exists upload_jobs_set_updated_at on assets.upload_jobs;
create trigger upload_jobs_set_updated_at before update on assets.upload_jobs
  for each row execute function assets.set_updated_at();

drop trigger if exists upload_portals_set_updated_at on assets.upload_portals;
create trigger upload_portals_set_updated_at before update on assets.upload_portals
  for each row execute function assets.set_updated_at();

drop trigger if exists collections_set_updated_at on assets.collections;
create trigger collections_set_updated_at before update on assets.collections
  for each row execute function assets.set_updated_at();

drop trigger if exists folders_set_updated_at on assets.folders;
create trigger folders_set_updated_at before update on assets.folders
  for each row execute function assets.set_updated_at();

drop trigger if exists duplicate_groups_set_updated_at on assets.duplicate_groups;
create trigger duplicate_groups_set_updated_at before update on assets.duplicate_groups
  for each row execute function assets.set_updated_at();

drop trigger if exists asset_requests_set_updated_at on assets.asset_requests;
create trigger asset_requests_set_updated_at before update on assets.asset_requests
  for each row execute function assets.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security — demo-open policies (replace with org-scoped when auth lands)
-- ---------------------------------------------------------------------------

alter table assets.upload_jobs        enable row level security;
alter table assets.upload_portals     enable row level security;
alter table assets.upload_submissions enable row level security;
alter table assets.collections        enable row level security;
alter table assets.collection_assets  enable row level security;
alter table assets.folders            enable row level security;
alter table assets.duplicate_groups   enable row level security;
alter table assets.duplicate_members  enable row level security;
alter table assets.asset_requests     enable row level security;

drop policy if exists upload_jobs_demo_all on assets.upload_jobs;
create policy upload_jobs_demo_all on assets.upload_jobs for all to anon, authenticated using (true) with check (true);
drop policy if exists upload_portals_demo_all on assets.upload_portals;
create policy upload_portals_demo_all on assets.upload_portals for all to anon, authenticated using (true) with check (true);
drop policy if exists upload_submissions_demo_all on assets.upload_submissions;
create policy upload_submissions_demo_all on assets.upload_submissions for all to anon, authenticated using (true) with check (true);
drop policy if exists collections_demo_all on assets.collections;
create policy collections_demo_all on assets.collections for all to anon, authenticated using (true) with check (true);
drop policy if exists collection_assets_demo_all on assets.collection_assets;
create policy collection_assets_demo_all on assets.collection_assets for all to anon, authenticated using (true) with check (true);
drop policy if exists folders_demo_all on assets.folders;
create policy folders_demo_all on assets.folders for all to anon, authenticated using (true) with check (true);
drop policy if exists duplicate_groups_demo_all on assets.duplicate_groups;
create policy duplicate_groups_demo_all on assets.duplicate_groups for all to anon, authenticated using (true) with check (true);
drop policy if exists duplicate_members_demo_all on assets.duplicate_members;
create policy duplicate_members_demo_all on assets.duplicate_members for all to anon, authenticated using (true) with check (true);
drop policy if exists asset_requests_demo_all on assets.asset_requests;
create policy asset_requests_demo_all on assets.asset_requests for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Demo seed (stable UUIDs; project_id/created_by null). References the asset
-- UUIDs seeded in assets.sql (a0000000-…-0001 … 0010).
-- ---------------------------------------------------------------------------

insert into assets.upload_jobs (id, filename, file_type, size_bytes, status, progress, source, asset_id) values
  ('10000000-0000-4000-8000-000000000001','behind-the-scenes-bts.mov','video',2250000000,'processing',62,'drag-drop',null),
  ('10000000-0000-4000-8000-000000000002','raw-photo-sunset.arw','raw',44700000,'completed',100,'folder','a0000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000003','campaign-assets.zip','archive',680000000,'uploading',38,'zip',null),
  ('10000000-0000-4000-8000-000000000004','product-render-v2.png','image',8400000,'queued',0,'url',null),
  ('10000000-0000-4000-8000-000000000005','interview-master.wav','audio',128000000,'failed',74,'cloud',null)
on conflict (id) do nothing;

insert into assets.upload_portals (id, name, type, slug, status, require_metadata, destination_folder) values
  ('20000000-0000-4000-8000-000000000001','Agency Photo Drop','link','agency-photo-drop','active',true,'photography'),
  ('20000000-0000-4000-8000-000000000002','Press Kit Submissions','form','press-kit','active',true,'brand'),
  ('20000000-0000-4000-8000-000000000003','Contractor Uploads','link','contractor-uploads','paused',false,'root')
on conflict (id) do nothing;

insert into assets.upload_submissions (id, portal_id, submitter_name, submitter_email, file_count, status) values
  ('21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Dana Whitfield','dana@studio.co',12,'pending'),
  ('21000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Lee Park','lee@studio.co',5,'approved'),
  ('21000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','PR Agency','hello@pr.co',3,'pending')
on conflict (id) do nothing;

insert into assets.collections (id, name, description, type, cover_color, is_favorite, visibility) values
  ('30000000-0000-4000-8000-000000000001','Summer 2026 Launch','Hero and supporting assets for the summer campaign.','manual','#3b82f6',true,'team'),
  ('30000000-0000-4000-8000-000000000002','Approved Logos','All current, approved brand logos.','smart','#10b981',true,'public'),
  ('30000000-0000-4000-8000-000000000003','Social Templates','Reusable templates for social channels.','board','#ec4899',false,'team'),
  ('30000000-0000-4000-8000-000000000004','Q1 Archive','Archived campaign material from Q1.','album','#737373',false,'private')
on conflict (id) do nothing;

insert into assets.collection_assets (id, collection_id, asset_id, position) values
  ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',0),
  ('31000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000005',1),
  ('31000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003',0),
  ('31000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000008',0)
on conflict (id) do nothing;

insert into assets.folders (id, name, parent_id, path, storage_location, color, size_bytes) values
  ('40000000-0000-4000-8000-000000000001','Brand Assets',null,'/Brand Assets','hot','#10b981',42000000),
  ('40000000-0000-4000-8000-000000000002','Logos','40000000-0000-4000-8000-000000000001','/Brand Assets/Logos','hot','#10b981',12000),
  ('40000000-0000-4000-8000-000000000003','Campaigns',null,'/Campaigns','hot','#3b82f6',2400000000),
  ('40000000-0000-4000-8000-000000000004','Q1 Archive','40000000-0000-4000-8000-000000000003','/Campaigns/Q1 Archive','cold','#737373',900000000),
  ('40000000-0000-4000-8000-000000000005','Photography',null,'/Photography','cloud-s3','#f59e0b',5700000000)
on conflict (id) do nothing;

insert into assets.duplicate_groups (id, match_type, similarity, status, recommended_action) values
  ('50000000-0000-4000-8000-000000000001','exact',100,'open','Keep the highest-resolution copy and trash the rest.'),
  ('50000000-0000-4000-8000-000000000002','near',92.5,'open','Review variants before merging.'),
  ('50000000-0000-4000-8000-000000000003','visual',87,'resolved','Resolved — kept the approved version.')
on conflict (id) do nothing;

insert into assets.duplicate_members (id, group_id, asset_id, is_keeper) values
  ('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003',true),
  ('51000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000008',false),
  ('51000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000004',true),
  ('51000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001',false)
on conflict (id) do nothing;

insert into assets.asset_requests (id, title, description, requester, assignee, priority, status, due_date, reference_asset_id) values
  ('60000000-0000-4000-8000-000000000001','New hero banner for fall campaign','Need a 4K hero banner aligned with the fall palette.','Marketing','Sarah Chen','high','in_progress','2026-07-15','a0000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000002','Product shots for new chair line','Studio shots, 6 angles, white background.','Ecommerce','Alex Kim','urgent','open','2026-07-02',null),
  ('60000000-0000-4000-8000-000000000003','Updated brand guidelines PDF','Refresh the guidelines with new typography.','Brand','Marcus Rivera','medium','submitted','2026-06-30','a0000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000004','Podcast cover art','Cover art for the new podcast series.','Content','Jordan Lee','low','closed','2026-06-10',null)
on conflict (id) do nothing;
