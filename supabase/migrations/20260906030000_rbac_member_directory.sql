-- Member directory for the Permissions & Security screen
--
-- The screen has to show WHO holds each role, but identity lives in auth.users
-- and this suite has no public.users mirror to join against — the browser client
-- cannot read either. Other products solve it by denormalising email/name onto
-- their own roster table; a read-only security-definer function does the same job
-- without a second table to keep in step with the grants that actually authorize.
--
-- Owns:
--   assets.rbac_list_members(uuid)   grants + identity for one project
--   assets.rbac_org_candidates(uuid) org members who hold no grant yet
--
-- Both are SECURITY DEFINER (they read auth.users) and both refuse to answer for
-- a project the caller is not themselves a member of, so this cannot be used to
-- enumerate another organization's users.

-- @up

create or replace function assets.rbac_list_members(p_project_id uuid)
returns table (
  user_id uuid,
  email text,
  name text,
  avatar_url text,
  role_id uuid,
  role_key text,
  role_name text,
  status text,
  granted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, assets, auth
as $$
begin
  if p_project_id is null or auth.uid() is null then
    return;
  end if;

  -- Only a member of the project may read its roster.
  if not exists (
    select 1 from assets.role_grants g
     where g.project_id = p_project_id
       and g.user_id = auth.uid()
       and g.status = 'active'
       and g.deleted_at is null
  ) then
    return;
  end if;

  return query
  select
    g.user_id,
    coalesce(u.email, '')::text,
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(u.email, ''), '@', 1)
    )::text,
    nullif(u.raw_user_meta_data ->> 'avatar_url', '')::text,
    g.role_id,
    r.key::text,
    r.name::text,
    g.status::text,
    g.created_at
  from assets.role_grants g
  join public.roles r on r.id = g.role_id
  left join auth.users u on u.id = g.user_id
  where g.project_id = p_project_id
    and g.deleted_at is null
  order by r.sort, coalesce(u.email, '');
end;
$$;

grant execute on function assets.rbac_list_members(uuid) to anon, authenticated;

-- Organization members who could be added to this project but hold no grant yet.
-- Feeds the "add teammate" picker so an administrator assigns a role rather than
-- typing an email and hoping it matches.
create or replace function assets.rbac_org_candidates(p_project_id uuid)
returns table (
  user_id uuid,
  email text,
  name text,
  avatar_url text,
  org_role text
)
language plpgsql
stable
security definer
set search_path = public, assets, auth
as $$
begin
  if p_project_id is null or auth.uid() is null then
    return;
  end if;

  if not exists (
    select 1 from assets.role_grants g
     where g.project_id = p_project_id
       and g.user_id = auth.uid()
       and g.status = 'active'
       and g.deleted_at is null
  ) then
    return;
  end if;

  return query
  select
    u.id,
    coalesce(u.email, '')::text,
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(u.email, ''), '@', 1)
    )::text,
    nullif(u.raw_user_meta_data ->> 'avatar_url', '')::text,
    ou.role::text
  from public.projects p
  join public.organization_users ou on ou."organization" = p.organization_id
  join auth.users u on u.id = ou."user"
  where p.id = p_project_id
    and not exists (
      select 1 from assets.role_grants g
       where g.project_id = p_project_id
         and g.user_id = u.id
         and g.deleted_at is null
    )
  order by coalesce(u.email, '');
end;
$$;

grant execute on function assets.rbac_org_candidates(uuid) to anon, authenticated;

-- @down
drop function if exists assets.rbac_org_candidates(uuid);
drop function if exists assets.rbac_list_members(uuid);
