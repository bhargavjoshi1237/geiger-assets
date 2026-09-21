-- Asset pool placement — point asset rows at dash pool objects.
--
-- Adds the per-object pool locator next to the S3 key. Rows written before
-- this ship keep pool_file_id null and resolve to S3 via refFromAssetRow();
-- new pooled writes fill pool_file_id / pool_url. upload_jobs.pool_upload_id
-- is load-bearing: the browser uploads between issueUploadUrl and
-- commitUpload, so the pool ticket id must survive on the job row.
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm).
--
-- storage_bucket keeps recording provenance — `pool:<provider>` for pooled
-- objects so it stays human-readable in the DB.

-- @up
alter table assets.assets        add column if not exists pool_file_id uuid;
alter table assets.assets        add column if not exists pool_url text;
alter table assets.asset_versions add column if not exists pool_file_id uuid;
alter table assets.asset_versions add column if not exists pool_url text;
alter table assets.upload_jobs   add column if not exists pool_upload_id uuid;
alter table assets.upload_jobs   add column if not exists pool_file_id uuid;

create index if not exists assets_pool_file_idx
  on assets.assets (pool_file_id) where pool_file_id is not null;

-- @down
drop index if exists assets.assets_pool_file_idx;
alter table assets.upload_jobs   drop column if exists pool_file_id;
alter table assets.upload_jobs   drop column if exists pool_upload_id;
alter table assets.asset_versions drop column if exists pool_url;
alter table assets.asset_versions drop column if exists pool_file_id;
alter table assets.assets        drop column if exists pool_url;
alter table assets.assets        drop column if exists pool_file_id;
