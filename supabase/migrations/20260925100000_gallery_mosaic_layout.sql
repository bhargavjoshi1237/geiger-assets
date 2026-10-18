-- Mosaic gallery layout.
--
-- A square grid where every sixth tile is featured at 2×2. Everything else the
-- new layout and theme options need (columns, tile shape, width, hover,
-- entrance, grounds, backdrop, title, header/footer, poster) lives in the
-- galleries.theme jsonb bag, so only the layout check has to widen.
--
-- Self-contained + idempotent: safe to re-run.

-- @up
create schema if not exists assets;

alter table assets.galleries drop constraint if exists galleries_layout_check;
alter table assets.galleries
  add constraint galleries_layout_check
  check (layout in ('grid', 'masonry', 'justified', 'slideshow', 'single', 'mosaic'));

-- @down
update assets.galleries set layout = 'grid' where layout = 'mosaic';
alter table assets.galleries drop constraint if exists galleries_layout_check;
alter table assets.galleries
  add constraint galleries_layout_check
  check (layout in ('grid', 'masonry', 'justified', 'slideshow', 'single'));
