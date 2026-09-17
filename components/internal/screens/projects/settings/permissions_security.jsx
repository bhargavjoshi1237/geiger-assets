"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Network, ShieldCheck, Timer } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SectionCard,
  SettingRow,
  SettingsList,
} from "@/components/internal/shared/screen_kit";
import { WORKSPACE_PERMISSIONS } from "@/lib/rbac";
import { listRoles } from "@/lib/supabase/rbac";
import { useProjectSettings } from "./use_project_settings";
import { SESSION_TIMEOUT_OPTIONS, parseIpAllowlist } from "./constants";

// Permissions & Security — role list with their permission sets, session
// policy, 2FA requirement, and IP allowlist.
//
// Roles and the permission catalog are read-only here: the catalog is driven
// off WORKSPACE_PERMISSIONS in lib/rbac.js (dot-namespaced keys) and the rows
// off lib/supabase/rbac.js. Gating is advisory UI only — it hides and disables
// controls; it does not secure data. Session policy, 2FA, and the allowlist
// persist through lib/supabase/settings.js.

const CATALOG_LABEL = new Map(WORKSPACE_PERMISSIONS.map((p) => [p.key, p.label]));
const CATALOG_GROUP = new Map(WORKSPACE_PERMISSIONS.map((p) => [p.key, p.group || "Other"]));

function groupedPermissions(keys) {
  const groups = new Map();
  for (const key of keys) {
    const group = CATALOG_GROUP.get(key) || "Other";
    const list = groups.get(group) || [];
    list.push({ key, label: CATALOG_LABEL.get(key) || key });
    groups.set(group, list);
  }
  return [...groups.entries()];
}

export function PermissionsSecurityScreen({ projectId }) {
  const { settings, loading: settingsLoading, save } = useProjectSettings(projectId);
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [idleDraft, setIdleDraft] = useState("");
  const [savingIdle, setSavingIdle] = useState(false);
  const [allowlistDraft, setAllowlistDraft] = useState("");
  const [policyFor, setPolicyFor] = useState(null);
  const [savingAllowlist, setSavingAllowlist] = useState(false);

  useEffect(() => {
    let alive = true;
    listRoles(projectId).then((rows) => {
      if (!alive) return;
      setRoles(rows ?? []);
      setRolesLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Seed the policy forms from the fetched row once per project (render-phase
  // adjustment, not an effect — it runs only until policyFor catches up).
  if (!settingsLoading && policyFor !== projectId) {
    setPolicyFor(projectId);
    setIdleDraft(String(settings.idleTimeoutMinutes));
    setAllowlistDraft(settings.ipAllowlist);
  }
  const seeded = !settingsLoading && policyFor === projectId;

  const allowlistCount = useMemo(() => parseIpAllowlist(allowlistDraft).length, [allowlistDraft]);

  const saveIdle = async () => {
    const minutes = Math.floor(Number(idleDraft));
    if (!Number.isFinite(minutes) || minutes < 1) {
      toast.error("Idle timeout must be at least 1 minute.");
      return;
    }
    setSavingIdle(true);
    const saved = await save(
      { idleTimeoutMinutes: minutes },
      { success: "Idle timeout saved.", error: "Couldn't save the idle timeout." },
    );
    setSavingIdle(false);
    if (saved) setIdleDraft(String(saved.idleTimeoutMinutes));
  };

  const saveAllowlist = async () => {
    setSavingAllowlist(true);
    const saved = await save(
      { ipAllowlist: allowlistDraft },
      { success: "IP allowlist saved.", error: "Couldn't save the allowlist." },
    );
    setSavingAllowlist(false);
    if (saved) setAllowlistDraft(saved.ipAllowlist);
  };

  const loading = rolesLoading || !seeded;

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Permissions & Security"
        description={`${roles.length} ${roles.length === 1 ? "role" : "roles"} · gating here is advisory UI only.`}
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading permissions and security" />
        </div>
      ) : (
        <>
          <SectionCard
            title="Roles"
            description="What each role may do. Owners hold every permission through a wildcard."
          >
            {roles.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No roles yet"
                description="Roles are seeded on workspace setup — nothing to gate against until then."
              />
            ) : (
              <div className="grid gap-3">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="rounded-lg border border-border bg-surface-card px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{role.name}</span>
                      {role.isSystem ? <Badge variant="info">System</Badge> : null}
                      {role.isWildcard ? (
                        <Badge variant="purple">Full access</Badge>
                      ) : (
                        <Badge variant="neutral">
                          {role.productPermissions.length}{" "}
                          {role.productPermissions.length === 1 ? "permission" : "permissions"}
                        </Badge>
                      )}
                    </div>
                    {role.description ? (
                      <p className="mt-0.5 text-xs text-text-secondary">{role.description}</p>
                    ) : null}
                    {role.isWildcard ? (
                      <p className="mt-2 text-xs text-text-tertiary">
                        Wildcard holder — every current and future permission key applies.
                      </p>
                    ) : role.productPermissions.length === 0 ? (
                      <p className="mt-2 text-xs text-text-tertiary">
                        No Assets permissions granted.
                      </p>
                    ) : (
                      <div className="mt-2 grid gap-2">
                        {groupedPermissions(role.productPermissions).map(([group, perms]) => (
                          <div key={group}>
                            <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                              {group} · {perms.length}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {perms.map((perm) => (
                                <Badge key={perm.key} variant="neutral" title={perm.key}>
                                  {perm.label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Session policy"
            description="How long signed-in sessions last."
          >
            <SettingsList>
              <SettingRow
                title="Session timeout"
                description="Absolute lifetime of a session before re-authentication."
                icon={Timer}
                control={
                  <Select
                    value={String(settings.sessionTimeoutMinutes)}
                    onValueChange={(value) =>
                      save(
                        { sessionTimeoutMinutes: Number(value) },
                        { error: "Couldn't save the session timeout." },
                      )
                    }
                  >
                    <SelectTrigger className="w-48 bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TIMEOUT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <SettingRow
                title="Two-factor requirement"
                description="Require every member to enroll a second factor."
                icon={KeyRound}
                checked={settings.require2fa}
                onCheckedChange={(value) =>
                  save(
                    { require2fa: value },
                    {
                      success: value ? "Two-factor required." : "Two-factor optional.",
                      error: "Couldn't save the 2FA requirement.",
                    },
                  )
                }
              />
            </SettingsList>
            <div className="mt-4">
              <Field
                label="Idle timeout (minutes)"
                htmlFor="security-idle"
                hint="Lock the session after this long without activity."
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="security-idle"
                    className="bg-surface-card"
                    inputMode="numeric"
                    value={idleDraft}
                    onChange={(e) => setIdleDraft(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="15"
                  />
                  <Button
                    className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={saveIdle}
                    disabled={savingIdle || idleDraft === String(settings.idleTimeoutMinutes)}
                  >
                    {savingIdle ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="IP allowlist"
            description={
              allowlistCount === 0
                ? "Empty means every network may connect."
                : `${allowlistCount} ${allowlistCount === 1 ? "entry" : "entries"} may connect; everything else is refused.`
            }
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={saveAllowlist}
                disabled={savingAllowlist || allowlistDraft === settings.ipAllowlist}
              >
                {savingAllowlist ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save allowlist"
                )}
              </Button>
            }
          >
            <Field
              label="Allowed IPs / CIDRs"
              htmlFor="security-allowlist"
              hint="One per line, e.g. 203.0.113.0/24. Applies at the edge; advisory here until enforced."
            >
              <Textarea
                id="security-allowlist"
                className="bg-surface-card font-mono"
                value={allowlistDraft}
                onChange={(e) => setAllowlistDraft(e.target.value)}
                placeholder={"203.0.113.0/24\n198.51.100.23"}
              />
            </Field>
            <div className="mt-3 flex items-start gap-2 text-xs text-text-tertiary">
              <Network className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Entries are matched as written — a bare IP allows exactly that host.
            </div>
          </SectionCard>
        </>
      )}
    </SecondaryScreenWrapper>
  );
}

export default PermissionsSecurityScreen;
