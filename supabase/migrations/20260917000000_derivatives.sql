-- Derivative manifest merge for Geiger Assets.
--
-- Derivatives (thumb/preview/poster, per encoding) are regenerable cache state,
-- so they live in the assets.assets.metadata expansion bag under a "derivatives"
-- key rather than in a table of their own — no indexes, constraints or RLS of
-- their own are needed, and a lost manifest costs a re-derive, never data.
--
-- The one thing the bag cannot do safely from the application is merge. Two
-- requests negotiating different encodings of the same asset (one AVIF, one
-- WebP) derive concurrently and both write back; a read-modify-write in JS
-- would let the slower writer drop the faster one's slot. This function does
-- the merge inside a single statement, so the row lock serialises them and
-- each slot survives.
--
-- p_patch is shallow-merged into metadata.derivatives ("thumb.avif" -> {...}),
-- so a caller only ever sends the slots it produced. p_thumbnail_url is folded
-- in here too, as the commit path sets it in the same breath as the manifest.
--
-- Idempotent; safe to re-run via `npm run db:push` (geiger-orm).

-- @up
create or replace function assets.asset_merge_derivatives(
  p_asset_id uuid,
  p_patch jsonb,
  p_thumbnail_url text default null
)
returns jsonb
language plpgsql
set search_path = assets
as $$
declare
  v_meta jsonb;
begin
  if p_asset_id is null or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    return null;
  end if;

  update assets.assets a
     set metadata = jsonb_set(
           coalesce(a.metadata, '{}'::jsonb),
           '{derivatives}',
           coalesce(a.metadata -> 'derivatives', '{}'::jsonb) || p_patch,
           true
         ),
         -- Only overwrite the thumbnail when the caller actually has one, so a
         -- later AVIF-only merge never blanks the URL the commit path set.
         thumbnail_url = case
           when p_thumbnail_url is null or length(p_thumbnail_url) = 0 then a.thumbnail_url
           else p_thumbnail_url
         end,
         updated_at = now()
   where a.id = p_asset_id
     and a.deleted_at is null
  returning a.metadata -> 'derivatives' into v_meta;

  return v_meta;
end;
$$;

grant execute on function assets.asset_merge_derivatives(uuid, jsonb, text)
  to anon, authenticated, service_role;

-- @down
revoke execute on function assets.asset_merge_derivatives(uuid, jsonb, text)
  from anon, authenticated, service_role;
drop function if exists assets.asset_merge_derivatives(uuid, jsonb, text);
