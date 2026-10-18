-- Project-scoped retention rules and legal holds. Active holds protect assets
-- from soft and hard deletion, regardless of the calling API.

-- @up
create extension if not exists pgcrypto;

create table if not exists assets.retention_policies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  asset_type text not null default 'all'
    check (asset_type in ('all', 'image', 'video', 'audio', 'document', '3d', 'raw', 'pdf', 'archive')),
  age_days integer not null check (age_days > 0),
  action text not null check (action in ('archive', 'trash')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists retention_policies_project_idx
  on assets.retention_policies (project_id, created_at desc) where deleted_at is null;
drop trigger if exists retention_policies_touch on assets.retention_policies;
create trigger retention_policies_touch before update on assets.retention_policies
  for each row execute function assets.touch_updated_at();

create table if not exists assets.legal_holds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  matter_reference text not null default '',
  reason text not null default '',
  custodian text not null default '',
  status text not null default 'active' check (status in ('active', 'released')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references auth.users(id) on delete set null,
  unique (id, project_id)
);
create index if not exists legal_holds_project_idx
  on assets.legal_holds (project_id, created_at desc);
drop trigger if exists legal_holds_touch on assets.legal_holds;
create trigger legal_holds_touch before update on assets.legal_holds
  for each row execute function assets.touch_updated_at();

create or replace function assets.guard_legal_hold_update()
returns trigger language plpgsql set search_path = assets, public as $$
begin
  if old.status = 'released' then
    raise exception 'Released legal holds cannot be changed';
  end if;
  if new.status = 'released' then
    new.released_at = now();
    new.released_by = auth.uid();
  end if;
  return new;
end;
$$;
drop trigger if exists legal_holds_guard on assets.legal_holds;
create trigger legal_holds_guard before update on assets.legal_holds
  for each row execute function assets.guard_legal_hold_update();

create table if not exists assets.legal_hold_assets (
  hold_id uuid not null,
  project_id uuid not null,
  asset_id uuid not null references assets.assets(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (hold_id, asset_id),
  foreign key (hold_id, project_id) references assets.legal_holds(id, project_id) on delete cascade
);
create index if not exists legal_hold_assets_asset_idx
  on assets.legal_hold_assets (asset_id, hold_id);

create table if not exists assets.legal_hold_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  hold_id uuid not null references assets.legal_holds(id) on delete cascade,
  asset_id uuid,
  event_type text not null check (event_type in ('created', 'updated', 'released', 'asset_added', 'asset_removed')),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists legal_hold_events_hold_idx
  on assets.legal_hold_events (hold_id, created_at desc);

create or replace function assets.record_legal_hold_event()
returns trigger language plpgsql security definer set search_path = assets, public as $$
begin
  if tg_table_name = 'legal_holds' then
    if tg_op = 'INSERT' then
      insert into assets.legal_hold_events (project_id, hold_id, event_type, actor_id)
      values (new.project_id, new.id, 'created', auth.uid());
    elsif new.status = 'released' and old.status <> 'released' then
      insert into assets.legal_hold_events (project_id, hold_id, event_type, actor_id)
      values (new.project_id, new.id, 'released', auth.uid());
    else
      insert into assets.legal_hold_events (project_id, hold_id, event_type, actor_id)
      values (new.project_id, new.id, 'updated', auth.uid());
    end if;
  elsif tg_op = 'INSERT' then
    insert into assets.legal_hold_events (project_id, hold_id, asset_id, event_type, actor_id)
    values (new.project_id, new.hold_id, new.asset_id, 'asset_added', auth.uid());
  elsif tg_op = 'DELETE' then
    insert into assets.legal_hold_events (project_id, hold_id, asset_id, event_type, actor_id)
    values (old.project_id, old.hold_id, old.asset_id, 'asset_removed', auth.uid());
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function assets.record_legal_hold_event() from public, anon, authenticated;
drop trigger if exists legal_holds_event on assets.legal_holds;
create trigger legal_holds_event after insert or update on assets.legal_holds
  for each row execute function assets.record_legal_hold_event();
drop trigger if exists legal_hold_assets_event on assets.legal_hold_assets;
create trigger legal_hold_assets_event after insert or delete on assets.legal_hold_assets
  for each row execute function assets.record_legal_hold_event();

create or replace function assets.validate_legal_hold_asset()
returns trigger language plpgsql set search_path = assets, public as $$
begin
  if not exists (
    select 1 from assets.assets a
    where a.id = new.asset_id and a.project_id = new.project_id and a.deleted_at is null
  ) then
    raise exception 'Asset must be a live asset in the hold project';
  end if;
  if not exists (
    select 1 from assets.legal_holds h
    where h.id = new.hold_id and h.project_id = new.project_id and h.status = 'active'
  ) then
    raise exception 'Assets can only be added to active holds';
  end if;
  return new;
end;
$$;
drop trigger if exists legal_hold_asset_validate on assets.legal_hold_assets;
create trigger legal_hold_asset_validate before insert or update on assets.legal_hold_assets
  for each row execute function assets.validate_legal_hold_asset();

create or replace function assets.protect_held_asset()
returns trigger language plpgsql set search_path = assets, public as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from assets.legal_hold_assets l
      join assets.legal_holds h on h.id = l.hold_id
      where l.asset_id = old.id and h.status = 'active'
    ) then
      raise exception 'Asset is under an active legal hold';
    end if;
    return old;
  end if;
  if old.deleted_at is null and new.deleted_at is not null and exists (
    select 1 from assets.legal_hold_assets l
    join assets.legal_holds h on h.id = l.hold_id
    where l.asset_id = old.id and h.status = 'active'
  ) then
    raise exception 'Asset is under an active legal hold';
  end if;
  return new;
end;
$$;
drop trigger if exists assets_protect_held_asset on assets.assets;
create trigger assets_protect_held_asset before update of deleted_at or delete on assets.assets
  for each row execute function assets.protect_held_asset();

grant select, insert, update, delete on assets.retention_policies, assets.legal_holds,
  assets.legal_hold_assets to authenticated;
revoke all on assets.retention_policies, assets.legal_holds, assets.legal_hold_assets from anon;
revoke delete on assets.legal_holds from authenticated;
grant select on assets.legal_hold_events to authenticated;
revoke all on assets.legal_hold_events from anon;
alter table assets.retention_policies enable row level security;
alter table assets.legal_holds enable row level security;
alter table assets.legal_hold_assets enable row level security;
alter table assets.legal_hold_events enable row level security;

drop policy if exists retention_policies_read on assets.retention_policies;
create policy retention_policies_read on assets.retention_policies for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id));
drop policy if exists retention_policies_write on assets.retention_policies;
create policy retention_policies_write on assets.retention_policies for all to authenticated
  using (assets.rbac_allows('assets.settings.manage', project_id))
  with check (assets.rbac_allows('assets.settings.manage', project_id));
drop policy if exists legal_holds_read on assets.legal_holds;
create policy legal_holds_read on assets.legal_holds for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id));
drop policy if exists legal_holds_write on assets.legal_holds;
create policy legal_holds_write on assets.legal_holds for insert to authenticated
  with check (assets.rbac_allows('assets.settings.manage', project_id));
drop policy if exists legal_holds_update on assets.legal_holds;
create policy legal_holds_update on assets.legal_holds for update to authenticated
  using (assets.rbac_allows('assets.settings.manage', project_id))
  with check (assets.rbac_allows('assets.settings.manage', project_id));
drop policy if exists legal_hold_assets_read on assets.legal_hold_assets;
create policy legal_hold_assets_read on assets.legal_hold_assets for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id));
drop policy if exists legal_hold_assets_write on assets.legal_hold_assets;
create policy legal_hold_assets_write on assets.legal_hold_assets for all to authenticated
  using (assets.rbac_allows('assets.settings.manage', project_id))
  with check (assets.rbac_allows('assets.settings.manage', project_id));
drop policy if exists legal_hold_events_read on assets.legal_hold_events;
create policy legal_hold_events_read on assets.legal_hold_events for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id));

-- @down
drop trigger if exists assets_protect_held_asset on assets.assets;
drop function if exists assets.protect_held_asset();
drop trigger if exists legal_hold_asset_validate on assets.legal_hold_assets;
drop function if exists assets.validate_legal_hold_asset();
drop trigger if exists legal_hold_assets_event on assets.legal_hold_assets;
drop trigger if exists legal_holds_event on assets.legal_holds;
drop function if exists assets.record_legal_hold_event();
drop table if exists assets.legal_hold_events;
drop table if exists assets.legal_hold_assets;
drop trigger if exists legal_holds_guard on assets.legal_holds;
drop function if exists assets.guard_legal_hold_update();
drop table if exists assets.legal_holds;
drop table if exists assets.retention_policies;
