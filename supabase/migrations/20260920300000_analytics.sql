-- Analytics — search-event log plus saved reports and their run ledger.
--
-- Owns assets.search_events, assets.reports, assets.report_runs. The other six
-- analytics screens read tables that already exist (delivery_daily,
-- delivery_events, assets, galleries, licensing, monetization); only Search
-- Analytics and Reports & Exports need new tables, defined here.
--
-- Self-contained + idempotent: safe to re-run. Follows suite conventions
-- (uuid pk, project_id scoping, metadata bag, touch_updated_at, demo-open RLS).

-- @up
create extension if not exists pgcrypto;

create schema if not exists assets;
grant usage on schema assets to anon, authenticated, service_role;

-- Defined locally so this file stands alone, per SUPABASE_CONVENTIONS.md.
create or replace function assets.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Append-only search log ------------------------------------------------------
-- One row per settled library query, written fire-and-forget from the Asset
-- Library (~600ms debounce). normalized_query is the grouping key.

create table if not exists assets.search_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  query text not null default '',
  normalized_query text not null default '',
  result_count integer not null default 0,
  filters jsonb not null default '{}'::jsonb,
  clicked_asset_id uuid references assets.assets(id) on delete set null,
  session_id text not null default '',
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists search_events_project_idx
  on assets.search_events (project_id, occurred_at desc) where deleted_at is null;
create index if not exists search_events_query_idx
  on assets.search_events (project_id, normalized_query) where deleted_at is null;

-- Saved reports ---------------------------------------------------------------

create table if not exists assets.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default '',
  description text not null default '',
  source text not null default 'asset'
    check (source in ('asset', 'search', 'portal', 'health', 'storage', 'commerce', 'license')),
  -- { range: "30", dimensions: [], metrics: [], filters: {} }
  definition jsonb not null default '{}'::jsonb,
  schedule text not null default 'manual'
    check (schedule in ('manual', 'daily', 'weekly', 'monthly')),
  recipients text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active', 'paused')),
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists reports_project_idx
  on assets.reports (project_id) where deleted_at is null;

-- Report run ledger ------------------------------------------------------------

create table if not exists assets.report_runs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references assets.reports(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  status text not null default 'succeeded'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  format text not null default 'csv' check (format in ('csv', 'png')),
  row_count integer not null default 0,
  file_url text not null default '',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists report_runs_report_idx
  on assets.report_runs (report_id, started_at desc) where deleted_at is null;
create index if not exists report_runs_project_idx
  on assets.report_runs (project_id, started_at desc) where deleted_at is null;

-- updated_at triggers ----------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['search_events', 'reports', 'report_runs'] loop
    execute format('drop trigger if exists %I_touch_updated_at on assets.%I', t, t);
    execute format(
      'create trigger %I_touch_updated_at before update on assets.%I for each row execute function assets.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- RLS --------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['search_events', 'reports', 'report_runs'] loop
    execute format('alter table assets.%I enable row level security', t);
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
    execute format(
      'create policy %I_demo_all on assets.%I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- Demo seed --------------------------------------------------------------------
-- Stable content resolved against the oldest project; a no-op when no project
-- exists or the tables are already seeded. Never depended on by the screens.

do $$
declare
  v_project uuid;
  v_queries text[] := array[
    'logo', 'Logo', '  hero banner  ', 'summer campaign', 'brand guidelines',
    'product shot', 'promo video', 'podcast interview', 'social template',
    'annual report', 'icon set', 'chair 3d model', 'press kit', 'Q3 launch assets',
    'onboarding deck', 'BLACK FRIDAY', 'testimonial reel', 'ugiuhiuh', 'zxqv',
    'banner', 'Hero Banner', 'summer  campaign', 'invoice template', 'webinar slides'
  ];
  v_q text;
  v_norm text;
  i integer;
begin
  select id into v_project from public.projects order by created_at limit 1;
  if v_project is null then return; end if;
  if exists (select 1 from assets.search_events limit 1) then return; end if;

  for i in 1..120 loop
    v_q := v_queries[(i * 7 % array_length(v_queries, 1)) + 1];
    v_norm := lower(regexp_replace(btrim(v_q), '\s+', ' ', 'g'));
    insert into assets.search_events
      (id, project_id, query, normalized_query, result_count, filters,
       clicked_asset_id, session_id, occurred_at)
    values (
      ('c0ffee00-0000-4000-8000-' || lpad(to_hex(i), 12, '0'))::uuid,
      v_project,
      v_q,
      v_norm,
      -- ~12% zero-result (every 8th), otherwise a 1–48 long tail.
      case when i % 8 = 0 then 0 else (i * 37 % 48) + 1 end,
      (case (i % 6)
        when 0 then '{"type":"image"}'
        when 1 then '{"status":"approved"}'
        when 2 then '{"type":"video","status":"review"}'
        when 3 then '{"folder":"brand"}'
        when 4 then '{"tags":["summer"]}'
        else '{}'
      end)::jsonb,
      -- ~40% with a click into the seeded assets (a0000000-…-0001 … 0010).
      case when i % 5 < 2
        then ('a0000000-0000-4000-8000-' || lpad(to_hex((i % 10) + 1), 12, '0'))::uuid
        else null
      end,
      'seed-session-' || ((i % 12) + 1),
      now() - ((i * 13 + (i * 7919 % 11)) || ' hours')::interval
    );
  end loop;

  insert into assets.reports
    (id, project_id, name, description, source, definition, schedule, recipients, status, last_run_at)
  values
    ('d0000000-0000-4000-8000-000000000001', v_project, 'Weekly asset performance',
      'Views, downloads, shares and embeds across the library.', 'asset',
      '{"range":"7","dimensions":["asset"],"metrics":["views","downloads"],"filters":{}}',
      'weekly', '{brand@studio.co}', 'active', now() - interval '2 days'),
    ('d0000000-0000-4000-8000-000000000002', v_project, 'Search quality review',
      'Zero-result queries and click-through for the last month.', 'search',
      '{"range":"30","dimensions":["query"],"metrics":["searches","zero_rate"],"filters":{}}',
      'monthly', '{content@studio.co}', 'active', now() - interval '6 days'),
    ('d0000000-0000-4000-8000-000000000003', v_project, 'Portal engagement digest',
      'Visitors, views and conversion per gallery.', 'portal',
      '{"range":"30","dimensions":["gallery"],"metrics":["visitors","conversion"],"filters":{}}',
      'weekly', '{}', 'paused', now() - interval '9 days'),
    ('d0000000-0000-4000-8000-000000000004', v_project, 'Commerce month-end',
      'Revenue, orders and refunds for stakeholder review.', 'commerce',
      '{"range":"30","dimensions":["product"],"metrics":["revenue","orders"],"filters":{}}',
      'monthly', '{finance@studio.co}', 'active', now() - interval '1 day'),
    ('d0000000-0000-4000-8000-000000000005', v_project, 'License expirations watch',
      'Upcoming expirations and renewal rate, ad hoc.', 'license',
      '{"range":"90","dimensions":["license"],"metrics":["expirations","renewal_rate"],"filters":{}}',
      'manual', '{}', 'active', null)
  on conflict (id) do nothing;

  insert into assets.report_runs
    (id, report_id, project_id, status, format, row_count, started_at, finished_at)
  values
    ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', v_project, 'succeeded', 'csv', 42, now() - interval '2 days', now() - interval '2 days' + interval '4 seconds'),
    ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', v_project, 'succeeded', 'png', 4, now() - interval '9 days', now() - interval '9 days' + interval '6 seconds'),
    ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', v_project, 'succeeded', 'csv', 38, now() - interval '16 days', now() - interval '16 days' + interval '3 seconds'),
    ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', v_project, 'failed', 'csv', 0, now() - interval '23 days', now() - interval '23 days' + interval '2 seconds'),
    ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000002', v_project, 'succeeded', 'csv', 96, now() - interval '6 days', now() - interval '6 days' + interval '5 seconds'),
    ('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000002', v_project, 'succeeded', 'csv', 88, now() - interval '36 days', now() - interval '36 days' + interval '5 seconds'),
    ('e0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000002', v_project, 'succeeded', 'png', 3, now() - interval '37 days', now() - interval '37 days' + interval '7 seconds'),
    ('e0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000003', v_project, 'succeeded', 'csv', 12, now() - interval '9 days', now() - interval '9 days' + interval '3 seconds'),
    ('e0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000003', v_project, 'succeeded', 'csv', 11, now() - interval '16 days', now() - interval '16 days' + interval '3 seconds'),
    ('e0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000004', v_project, 'succeeded', 'csv', 64, now() - interval '1 day', now() - interval '1 day' + interval '4 seconds'),
    ('e0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000004', v_project, 'succeeded', 'png', 4, now() - interval '1 day' + interval '1 hour', now() - interval '1 day' + interval '1 hour' + interval '8 seconds'),
    ('e0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000004', v_project, 'running', 'csv', 0, now() - interval '20 minutes', null),
    ('e0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000004', v_project, 'succeeded', 'csv', 59, now() - interval '31 days', now() - interval '31 days' + interval '4 seconds'),
    ('e0000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000005', v_project, 'succeeded', 'csv', 18, now() - interval '12 days', now() - interval '12 days' + interval '3 seconds'),
    ('e0000000-0000-4000-8000-000000000015', 'd0000000-0000-4000-8000-000000000005', v_project, 'queued', 'png', 0, now() - interval '5 minutes', null)
  on conflict (id) do nothing;
end $$;

-- @down
do $$
declare t text;
begin
  foreach t in array array['search_events', 'reports', 'report_runs'] loop
    execute format('drop policy if exists %I_demo_all on assets.%I', t, t);
  end loop;
end $$;

drop table if exists assets.report_runs;
drop table if exists assets.reports;
drop table if exists assets.search_events;
