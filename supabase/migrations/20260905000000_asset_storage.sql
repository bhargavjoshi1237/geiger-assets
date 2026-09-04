-- Asset storage layer — point asset rows at S3 objects.
--
-- Adds storage columns to assets.assets / assets.asset_versions /
-- assets.upload_jobs plus the indexes the commit path and the Duplicates
-- screen need. Idempotent; safe to re-run via `npm run db:push` (geiger-orm).
--
-- storage_status lifecycle: none -> pending -> stored, with failed / missing
-- as terminal markers set by the commit check and the reconciler.

-- @up
create extension if not exists pgcrypto;

alter table assets.assets
  add column if not exists storage_key       text,
  add column if not exists storage_bucket    text,
  add column if not exists storage_status    text not null default 'none',
  add column if not exists etag              text,
  add column if not exists checksum          text,
  add column if not exists mime_type         text not null default '',
  add column if not exists original_filename text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assets_storage_status_chk'
  ) then
    alter table assets.assets
      add constraint assets_storage_status_chk
      check (storage_status in ('none','pending','stored','failed','missing'));
  end if;
end $$;

create index if not exists assets_checksum_idx
  on assets.assets (project_id, checksum) where checksum is not null;
create unique index if not exists assets_storage_key_idx
  on assets.assets (storage_key) where storage_key is not null;

alter table assets.asset_versions
  add column if not exists storage_key text,
  add column if not exists etag        text,
  add column if not exists checksum    text,
  add column if not exists mime_type   text not null default '';

alter table assets.upload_jobs
  add column if not exists storage_key text,
  add column if not exists upload_mode text not null default 'presigned';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'upload_jobs_mode_chk'
  ) then
    alter table assets.upload_jobs
      add constraint upload_jobs_mode_chk check (upload_mode in ('presigned','proxy'));
  end if;
end $$;

-- The original status check predates the storage layer (it has no 'complete'
-- / 'cancelled'). Widen it while keeping every legacy value valid.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'upload_jobs_status_chk'
  ) then
    alter table assets.upload_jobs drop constraint upload_jobs_status_chk;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'upload_jobs_status_chk'
  ) then
    alter table assets.upload_jobs
      add constraint upload_jobs_status_chk check (
        status in ('queued','uploading','processing','completed','complete','failed','cancelled')
      );
  end if;
end $$;

-- @down
alter table assets.upload_jobs drop constraint if exists upload_jobs_status_chk;
alter table assets.upload_jobs
  add constraint upload_jobs_status_chk check (
    status in ('queued','uploading','processing','completed','failed')
  );
alter table assets.upload_jobs drop constraint if exists upload_jobs_mode_chk;
alter table assets.upload_jobs drop column if exists upload_mode;
alter table assets.upload_jobs drop column if exists storage_key;
drop index if exists assets.assets_storage_key_idx;
drop index if exists assets.assets_checksum_idx;
alter table assets.assets drop constraint if exists assets_storage_status_chk;
alter table assets.assets drop column if exists original_filename;
alter table assets.assets drop column if exists mime_type;
alter table assets.assets drop column if exists checksum;
alter table assets.assets drop column if exists etag;
alter table assets.assets drop column if exists storage_status;
alter table assets.assets drop column if exists storage_bucket;
alter table assets.assets drop column if exists storage_key;
alter table assets.asset_versions drop column if exists mime_type;
alter table assets.asset_versions drop column if exists checksum;
alter table assets.asset_versions drop column if exists etag;
alter table assets.asset_versions drop column if exists storage_key;
