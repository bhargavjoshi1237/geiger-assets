-- Media screen state for Geiger Assets.
--
-- The nine media screens are type-scoped views over assets.assets; these three
-- tables hold the state that does not belong on the asset row itself:
--   assets.media_annotations  focal points, frame comments, annotations,
--                             watermarks, clip marks, external references
--   assets.media_transcripts  captions, subtitles, transcripts, OCR text
--   assets.media_jobs         image edits, video processing, renditions —
--                             queued work the server fulfils (derivatives via
--                             lib/media/variants.js, transcodes elsewhere)
--
-- Derivatives themselves stay in the metadata bag (see the derivatives
-- migration); jobs only record the request and its status, never the bytes.
--
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

create table if not exists assets.media_annotations (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references public.projects(id) on delete cascade,
  asset_id          uuid not null references assets.assets(id) on delete cascade,
  kind              text not null default 'annotation',
  label             text not null default '',
  body              text not null default '',
  position_x        double precision,
  position_y        double precision,
  timestamp_seconds double precision,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  constraint media_annotations_kind_chk check (
    kind in ('focal_point', 'frame_comment', 'annotation', 'watermark', 'clip', 'reference')
  )
);

create table if not exists assets.media_transcripts (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  asset_id   uuid not null references assets.assets(id) on delete cascade,
  kind       text not null default 'transcript',
  language   text not null default 'en',
  text       text not null default '',
  status     text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata   jsonb not null default '{}'::jsonb,
  constraint media_transcripts_kind_chk check (
    kind in ('caption', 'subtitle', 'transcript', 'ocr')
  ),
  constraint media_transcripts_status_chk check (
    status in ('draft', 'processing', 'ready', 'needs_review')
  )
);

create table if not exists assets.media_jobs (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references public.projects(id) on delete cascade,
  asset_id        uuid not null references assets.assets(id) on delete cascade,
  job_type        text not null default 'rendition',
  operation       text not null default 'preset',
  status          text not null default 'queued',
  progress        integer not null default 0,
  error           text not null default '',
  output_asset_id uuid references assets.assets(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  constraint media_jobs_type_chk check (
    job_type in ('image_edit', 'video_process', 'rendition')
  ),
  constraint media_jobs_status_chk check (
    status in ('queued', 'processing', 'ready', 'failed')
  ),
  constraint media_jobs_progress_chk check (progress >= 0 and progress <= 100)
);

grant all on assets.media_annotations to anon, authenticated, service_role;
grant all on assets.media_transcripts to anon, authenticated, service_role;
grant all on assets.media_jobs to anon, authenticated, service_role;

create index if not exists media_annotations_asset_idx
  on assets.media_annotations (asset_id) where deleted_at is null;
create index if not exists media_annotations_project_idx
  on assets.media_annotations (project_id) where deleted_at is null;
create index if not exists media_transcripts_asset_idx
  on assets.media_transcripts (asset_id) where deleted_at is null;
create index if not exists media_transcripts_project_idx
  on assets.media_transcripts (project_id) where deleted_at is null;
create index if not exists media_jobs_asset_idx
  on assets.media_jobs (asset_id) where deleted_at is null;
create index if not exists media_jobs_project_idx
  on assets.media_jobs (project_id) where deleted_at is null;
create index if not exists media_jobs_status_idx
  on assets.media_jobs (status) where deleted_at is null;

drop trigger if exists media_annotations_set_updated_at on assets.media_annotations;
create trigger media_annotations_set_updated_at
  before update on assets.media_annotations
  for each row execute function assets.set_updated_at();

drop trigger if exists media_transcripts_set_updated_at on assets.media_transcripts;
create trigger media_transcripts_set_updated_at
  before update on assets.media_transcripts
  for each row execute function assets.set_updated_at();

drop trigger if exists media_jobs_set_updated_at on assets.media_jobs;
create trigger media_jobs_set_updated_at
  before update on assets.media_jobs
  for each row execute function assets.set_updated_at();

alter table assets.media_annotations enable row level security;
alter table assets.media_transcripts enable row level security;
alter table assets.media_jobs enable row level security;

drop policy if exists media_annotations_demo_all on assets.media_annotations;
create policy media_annotations_demo_all on assets.media_annotations
  for all to anon, authenticated using (true) with check (true);

drop policy if exists media_transcripts_demo_all on assets.media_transcripts;
create policy media_transcripts_demo_all on assets.media_transcripts
  for all to anon, authenticated using (true) with check (true);

drop policy if exists media_jobs_demo_all on assets.media_jobs;
create policy media_jobs_demo_all on assets.media_jobs
  for all to anon, authenticated using (true) with check (true);

-- @down
drop policy if exists media_jobs_demo_all on assets.media_jobs;
drop policy if exists media_transcripts_demo_all on assets.media_transcripts;
drop policy if exists media_annotations_demo_all on assets.media_annotations;
drop trigger if exists media_jobs_set_updated_at on assets.media_jobs;
drop trigger if exists media_transcripts_set_updated_at on assets.media_transcripts;
drop trigger if exists media_annotations_set_updated_at on assets.media_annotations;
drop index if exists assets.media_jobs_status_idx;
drop index if exists assets.media_jobs_project_idx;
drop index if exists assets.media_jobs_asset_idx;
drop index if exists assets.media_transcripts_project_idx;
drop index if exists assets.media_transcripts_asset_idx;
drop index if exists assets.media_annotations_project_idx;
drop index if exists assets.media_annotations_asset_idx;
drop table if exists assets.media_jobs;
drop table if exists assets.media_transcripts;
drop table if exists assets.media_annotations;
