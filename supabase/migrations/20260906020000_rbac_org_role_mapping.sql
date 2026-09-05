-- Derive an assets role from the suite ORG role, and grant it
--
-- 20260906010000 created the authorization storage but nothing fills it, so on
-- its own it changes nothing: assets.rbac_allows() still finds no grant and every
-- upload is still a 403. This migration is the half that actually issues grants.
--
-- Ownership in this suite is held at the organization
-- (public.organization_users.role), not by whoever happened to create the project
-- row — public.projects.created_by is null on several projects and points at a
-- non-member on others. geiger-events learned this the hard way in its own
-- 20260809135817; the mapping below is deliberately the same one.
--
-- Owns:
--   assets.rbac_role_for_member(uuid, uuid)   suite org role -> assets role id
--   assets.rbac_ensure_membership(uuid)       grant the caller their mapped role
--   assets.sync_project_team(uuid)            grant every org member theirs
--
-- The mapping lands on the five seeded roles:
--
--   Owner            -> owner    (holds "*")
--   ADMIN / Admin    -> admin
--   Manager          -> manager
--   any other role   -> member   (holds assets.asset.edit: can upload, cannot delete)
--   not in the org   -> nothing  (403, as it should be)
--
-- public.organization_users.role carries both legacy shouty labels (ADMIN, USER)
-- and title-case ones (Manager, User, Leader), so the match is lower-cased rather
-- than enumerated.
--
-- NOTE. assets.project_members (20260906000000) is left in place but is no longer
-- consulted by anything: lib/storage/auth.js now authorizes through
-- assets.rbac_allows. It was never written to by any code path, so there is
-- nothing in it to migrate.

-- @up

-- The assets role a person should hold in a project, from their suite org role.
-- Returns null when they are not a member of the project's org and did not
-- create the project.
create or replace function assets.rbac_role_for_member(
  p_project_id uuid,
  p_user uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, assets, auth
as $$
declare
  v_org uuid;
  v_creator uuid;
  v_org_role text;
  v_key text;
  v_role uuid;
begin
  if p_project_id is null or p_user is null then
    return null;
  end if;

  select organization_id, created_by
    into v_org, v_creator
    from public.projects
   where id = p_project_id;

  if v_org is not null then
    select lower(ou.role::text) into v_org_role
      from public.organization_users ou
     where ou."organization" = v_org
       and ou."user" = p_user
     limit 1;
  end if;

  v_key := case
    when v_org_role = 'owner' then 'owner'
    when v_org_role in ('admin') then 'admin'
    when v_org_role in ('manager') then 'manager'
    when v_org_role is not null then 'member'
    else null
  end;

  -- Creating the project still earns Owner: a project with no organization has
  -- no suite role to read, and its creator is the only sensible administrator.
  if v_key is null and v_creator = p_user then
    v_key := 'owner';
  end if;

  if v_key is null then
    return null;
  end if;

  select r.id into v_role
    from public.roles r
   where r.project_id = p_project_id
     and r.key = v_key
     and r.deleted_at is null
   limit 1;

  -- The mapped role may not be seeded yet. Fall back to member, then to nothing.
  if v_role is null and v_key <> 'member' then
    select r.id into v_role
      from public.roles r
     where r.project_id = p_project_id
       and r.key = 'member'
       and r.deleted_at is null
     limit 1;
  end if;

  return v_role;
end;
$$;

grant execute on function assets.rbac_role_for_member(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The caller's own membership. Called on workspace load so a user who joins the
-- org later does not have to wait for an administrator to press anything.
-- ---------------------------------------------------------------------------
create or replace function assets.rbac_ensure_membership(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, assets, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_role uuid;
  v_existing uuid;
  v_ever integer;
begin
  if p_project_id is null or v_uid is null then
    return null;
  end if;

  select role_id into v_existing
    from assets.role_grants
   where project_id = p_project_id
     and user_id = v_uid
     and deleted_at is null
     and status = 'active'
   limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  -- A revoked grant is a decision, not a gap. Never hand one back.
  select count(*) into v_ever
    from assets.role_grants
   where project_id = p_project_id
     and user_id = v_uid;

  if v_ever > 0 then
    return null;
  end if;

  -- Seed the catalog first: a project created after the adopt migration ran has
  -- no roles yet, and the mapping would otherwise resolve to nothing.
  perform assets.rbac_seed_roles(p_project_id);

  v_role := assets.rbac_role_for_member(p_project_id, v_uid);

  if v_role is null then
    return null;   -- not an org member: correctly unauthorized
  end if;

  insert into assets.role_grants (project_id, user_id, role_id, status)
  values (p_project_id, v_uid, v_role, 'active')
  on conflict do nothing;

  return v_role;
end;
$$;

grant execute on function assets.rbac_ensure_membership(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bulk grant for a whole project, used by the backfill below and by the
-- Permissions & Security screen's "sync from organization" action.
-- ---------------------------------------------------------------------------
create or replace function assets.sync_project_team(p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, assets, auth
as $$
declare
  v_count integer := 0;
begin
  if p_project_id is null then
    return 0;
  end if;

  perform assets.rbac_seed_roles(p_project_id);

  insert into assets.role_grants (project_id, user_id, role_id, status)
  select p_project_id, u.id, assets.rbac_role_for_member(p_project_id, u.id), 'active'
    from public.organization_users ou
    join public.projects p on p.id = p_project_id
    join auth.users u on u.id = ou."user"
   where ou."organization" = p.organization_id
     and assets.rbac_role_for_member(p_project_id, u.id) is not null
     and not exists (
       select 1 from assets.role_grants g
        where g.project_id = p_project_id
          and g.user_id = u.id
     );

  get diagnostics v_count = row_count;

  -- The creator of an organization-less project, who has no org role to read.
  insert into assets.role_grants (project_id, user_id, role_id, status)
  select p_project_id, p.created_by, assets.rbac_role_for_member(p_project_id, p.created_by), 'active'
    from public.projects p
   where p.id = p_project_id
     and p.created_by is not null
     and assets.rbac_role_for_member(p_project_id, p.created_by) is not null
     and not exists (
       select 1 from assets.role_grants g
        where g.project_id = p_project_id
          and g.user_id = p.created_by
     );

  return v_count;
end;
$$;

grant execute on function assets.sync_project_team(uuid) to anon, authenticated;

-- Backfill every project that exists today, so storage works immediately rather
-- than on each user's next workspace load.
do $$
declare
  p record;
begin
  for p in select id from public.projects where deleted_at is null loop
    perform assets.sync_project_team(p.id);
  end loop;
end;
$$;

-- @down
drop function if exists assets.sync_project_team(uuid);
drop function if exists assets.rbac_ensure_membership(uuid);
drop function if exists assets.rbac_role_for_member(uuid, uuid);

-- The grants issued by the backfill are deliberately left in place. They mirror
-- organization membership rather than encoding anything this migration invented,
-- and deleting them would lock every user out of storage on a rollback — the
-- exact failure this migration exists to repair.
