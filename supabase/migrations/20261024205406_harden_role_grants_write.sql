-- Harden role grants write
--
-- assets.role_grants_write (20260906010000_adopt_rbac) is `for all to authenticated using (true) with check (true)`, so
-- any signed-in user can insert, rewrite or revoke any grant in any project, an Assets Owner ('*') grant for
-- themselves included. It now runs assets.rbac_can_write_grant on the existing row (using) and on the new row (check):
--   - the granted role must belong to the grant's project;
--   - an owner-grade role ('*' or 'assets.*') is granted, changed or revoked only by an owner-grade caller: the owner
--     of the project's organization, the creator of an org-less project, or a project member holding an active
--     owner-grade Assets grant;
--   - any other role also by a project admin (public.can_administer_project_roles), or by a project member holding
--     assets.team.assign or assets.role.manage, who may not write their own grant and may only hand out (or take
--     away) a role whose assets.* permissions they hold themselves;
--   - below owner grade, never for a user who already holds a live grant the caller could not write, so a Manager
--     can't re-role or add grants to an Admin or Owner.
-- First-run seeding and membership (rbac_seed_roles, rbac_ensure_membership, sync_project_team) are SECURITY DEFINER
-- and bypass RLS, so they are unaffected.
--
-- Owns (new): assets.rbac_can_write_grant(uuid, uuid, uuid)
-- Becomes the owner of: role_grants_write on assets.role_grants, from 20260906010000_adopt_rbac.
-- Depends on (owned by geiger-dash): public.org_role(uuid) from 20260629212507_org_abilities_rls,
-- public.can_administer_project_roles(uuid) and public.is_project_member(uuid) from 20261024195500_harden_org_and_roles_rls.
-- @down restores the open policy exactly (reopening the hole) and drops the function.

-- @up

-- Whether the caller may write (create, change or revoke) a grant of p_role to p_user in p_project.
create or replace function assets.rbac_can_write_grant(p_project uuid, p_user uuid, p_role uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_creator uuid;
  v_delegate boolean := false;
begin
  if v_uid is null or p_project is null or p_role is null then
    return false;
  end if;

  select p.organization_id, p.created_by
    into v_org, v_creator
    from public.projects p
   where p.id = p_project
     and p.deleted_at is null;
  if not found then
    return false;
  end if;

  -- The granted role must belong to this project.
  if not exists (select 1 from public.roles r where r.id = p_role and r.project_id = p_project) then
    return false;
  end if;

  -- Owner-grade callers may write any grant.
  if (v_org is not null and public.org_role(v_org) = 'owner')
     or (v_org is null and v_creator = v_uid)
     or (public.is_project_member(p_project) and assets.rbac_allows('assets.*', p_project)) then
    return true;
  end if;

  if not public.can_administer_project_roles(p_project) then
    if p_user = v_uid
       or not public.is_project_member(p_project)
       or not (
         assets.rbac_allows('assets.team.assign', p_project)
         or assets.rbac_allows('assets.role.manage', p_project)
       ) then
      return false;
    end if;
    v_delegate := true;
  end if;

  -- The granted role and every live grant the user already holds here must be within reach: never owner-grade, and
  -- for a delegate only assets.* permissions the caller holds.
  return not exists (
    select 1
      from public.roles r
     where (
             r.id = p_role
             or r.id in (
               select g.role_id
                 from assets.role_grants g
                where g.project_id = p_project
                  and g.user_id = p_user
                  and g.status = 'active'
                  and g.deleted_at is null
             )
           )
       and (
             coalesce(r.permissions, '{}'::text[]) && array['*', 'assets.*']::text[]
             or (
               v_delegate
               and exists (
                 select 1
                   from unnest(r.permissions) as k
                  where k like 'assets.%'
                    and not assets.rbac_allows(k, p_project)
               )
             )
           )
  );
end;
$$;

revoke all on function assets.rbac_can_write_grant(uuid, uuid, uuid) from public, anon;
grant execute on function assets.rbac_can_write_grant(uuid, uuid, uuid) to authenticated, service_role;

drop policy if exists role_grants_write on assets.role_grants;
create policy role_grants_write on assets.role_grants
  for all to authenticated
  using (assets.rbac_can_write_grant(project_id, user_id, role_id))
  with check (assets.rbac_can_write_grant(project_id, user_id, role_id));

-- @down

drop policy if exists role_grants_write on assets.role_grants;
create policy role_grants_write on assets.role_grants
  for all to authenticated using (true) with check (true);

drop function if exists assets.rbac_can_write_grant(uuid, uuid, uuid);
