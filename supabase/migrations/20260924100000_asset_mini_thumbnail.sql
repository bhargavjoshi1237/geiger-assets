-- Store a 96px list thumbnail URL beside the existing 512px preview URL.

-- @up
create schema if not exists assets;

alter table assets.assets
  add column if not exists mini_thumbnail_url text not null default '';

-- @down
alter table assets.assets drop column if exists mini_thumbnail_url;
