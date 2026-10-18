-- Governance read access
--
-- Add `-- @no-transaction` above @up only if this migration needs to run
-- outside a transaction (e.g. create index concurrently).

-- @up
-- A project settings manager can write governance records, so they also need
-- to read the returned rows and the history their changes create.
drop policy if exists retention_policies_read on assets.retention_policies;
create policy retention_policies_read on assets.retention_policies for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id)
    or assets.rbac_allows('assets.settings.manage', project_id));
drop policy if exists legal_holds_read on assets.legal_holds;
create policy legal_holds_read on assets.legal_holds for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id)
    or assets.rbac_allows('assets.settings.manage', project_id));
drop policy if exists legal_hold_assets_read on assets.legal_hold_assets;
create policy legal_hold_assets_read on assets.legal_hold_assets for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id)
    or assets.rbac_allows('assets.settings.manage', project_id));
drop policy if exists legal_hold_events_read on assets.legal_hold_events;
create policy legal_hold_events_read on assets.legal_hold_events for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id)
    or assets.rbac_allows('assets.settings.manage', project_id));

-- @down
drop policy if exists retention_policies_read on assets.retention_policies;
create policy retention_policies_read on assets.retention_policies for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id));
drop policy if exists legal_holds_read on assets.legal_holds;
create policy legal_holds_read on assets.legal_holds for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id));
drop policy if exists legal_hold_assets_read on assets.legal_hold_assets;
create policy legal_hold_assets_read on assets.legal_hold_assets for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id));
drop policy if exists legal_hold_events_read on assets.legal_hold_events;
create policy legal_hold_events_read on assets.legal_hold_events for select to authenticated
  using (assets.rbac_allows('assets.governance.view', project_id));
