-- Project membership + atomic download counter for the storage layer.
--
-- assets.project_members links auth users to projects with a role_key drawn
-- from the geiger-rbac.config.js system roles (owner/admin/manager/member/
-- viewer). Storage routes enforce it: membership for reads, role-checked
-- assets.asset.edit for uploads, assets.asset.delete for deletes.
-- assets.increment_downloads() makes the file-route counter race-free.

-- @up
create table if not exists assets.project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_key    text not null default 'member',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint project_members_unique unique (project_id, user_id),
  constraint project_members_role_chk check (
    role_key in ('owner','admin','manager','member','viewer')
  )
);

grant all on assets.project_members to anon, authenticated, service_role;

create index if not exists project_members_project_idx
  on assets.project_members (project_id);
create index if not exists project_members_user_idx
  on assets.project_members (user_id);

drop trigger if exists project_members_set_updated_at on assets.project_members;
create trigger project_members_set_updated_at
  before update on assets.project_members
  for each row execute function assets.set_updated_at();

alter table assets.project_members enable row level security;

drop policy if exists project_members_demo_all on assets.project_members;
create policy project_members_demo_all on assets.project_members
  for all to anon, authenticated using (true) with check (true);

create or replace function assets.increment_downloads(p_asset_id uuid)
returns integer
language plpgsql
set search_path = assets
as $$
declare v integer;
begin
  update assets.assets
    set downloads = downloads + 1
    where id = p_asset_id and deleted_at is null
    returning downloads into v;
  return coalesce(v, 0);
end;
$$;

grant execute on function assets.increment_downloads(uuid)
  to anon, authenticated, service_role;

-- @down
revoke execute on function assets.increment_downloads(uuid)
  from anon, authenticated, service_role;
drop function if exists assets.increment_downloads(uuid);
drop policy if exists project_members_demo_all on assets.project_members;
drop table if exists assets.project_members;
