"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Copy,
  FileText,
  KeyRound,
  Loader2,
  RefreshCw,
  ScrollText,
} from "lucide-react";
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
  Field,
  ScreenHeader,
  SectionCard,
  SettingRow,
  SettingsList,
} from "@/components/internal/shared/screen_kit";
import { useProjectSettings } from "./use_project_settings";
import { CONTRACT_TIER_OPTIONS, SSO_PROVIDER_OPTIONS } from "./constants";

// Enterprise — SSO and SAML configuration, SCIM provisioning, audit log
// retention, legal holds, and the contract tier.
//
// Configuration surfaces only: nothing here implements an identity provider.
// Every value persists through lib/supabase/settings.js optimistically and
// toasts only from this screen.

export function EnterpriseScreen({ projectId }) {
  const { settings, loading, save } = useProjectSettings(projectId);
  const [ssoDraft, setSsoDraft] = useState({ entityId: "", url: "", certificate: "" });
  const [savingSso, setSavingSso] = useState(false);
  const [complianceDraft, setComplianceDraft] = useState({ auditDays: "", legalNote: "" });
  const [seededFor, setSeededFor] = useState(null);
  const [savingCompliance, setSavingCompliance] = useState(false);
  const [copied, setCopied] = useState(false);

  // Seed the forms from the fetched row once per project (render-phase
  // adjustment, not an effect — it runs only until seededFor catches up).
  if (!loading && seededFor !== projectId) {
    setSeededFor(projectId);
    setSsoDraft({
      entityId: settings.ssoEntityId,
      url: settings.ssoUrl,
      certificate: settings.ssoCertificate,
    });
    setComplianceDraft({
      auditDays: String(settings.auditRetentionDays),
      legalNote: settings.legalHoldNote,
    });
  }
  const seeded = !loading && seededFor === projectId;

  const saveSso = async () => {
    if (settings.ssoEnabled && !ssoDraft.entityId.trim()) {
      toast.error("An entity ID is required while SSO is on.");
      return;
    }
    setSavingSso(true);
    const saved = await save(
      {
        ssoEntityId: ssoDraft.entityId.trim(),
        ssoUrl: ssoDraft.url.trim(),
        ssoCertificate: ssoDraft.certificate,
      },
      { success: "Single sign-on saved.", error: "Couldn't save single sign-on." },
    );
    setSavingSso(false);
    if (saved) {
      setSsoDraft({ entityId: saved.ssoEntityId, url: saved.ssoUrl, certificate: saved.ssoCertificate });
    }
  };

  const saveCompliance = async () => {
    const auditRetentionDays = Math.floor(Number(complianceDraft.auditDays));
    if (!Number.isFinite(auditRetentionDays) || auditRetentionDays < 1) {
      toast.error("Audit retention must be at least 1 day.");
      return;
    }
    setSavingCompliance(true);
    const saved = await save(
      { auditRetentionDays, legalHoldNote: complianceDraft.legalNote },
      { success: "Compliance settings saved.", error: "Couldn't save compliance settings." },
    );
    setSavingCompliance(false);
    if (saved) {
      setComplianceDraft({ auditDays: String(saved.auditRetentionDays), legalNote: saved.legalHoldNote });
    }
  };

  const rotateScimToken = async () => {
    const scimToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const saved = await save(
      { scimToken },
      {
        success: "New SCIM token issued — the old one stops working.",
        error: "Couldn't issue a SCIM token.",
      },
    );
    if (saved) setCopied(false);
  };

  const copyScimToken = async () => {
    if (!settings.scimToken) return;
    try {
      await navigator.clipboard.writeText(settings.scimToken);
      setCopied(true);
      toast.success("SCIM token copied.");
    } catch {
      toast.error("Couldn't copy — select it manually.");
    }
  };

  const ssoDirty =
    seeded &&
    (ssoDraft.entityId !== settings.ssoEntityId ||
      ssoDraft.url !== settings.ssoUrl ||
      ssoDraft.certificate !== settings.ssoCertificate);

  const complianceDirty =
    seeded &&
    (complianceDraft.auditDays !== String(settings.auditRetentionDays) ||
      complianceDraft.legalNote !== settings.legalHoldNote);

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Enterprise"
        description="Identity, provisioning, and compliance posture. Configuration only — no identity provider runs here."
      />

      {loading || !seeded ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading enterprise settings" />
        </div>
      ) : (
        <>
          <SectionCard
            title="Single sign-on"
            description="Members authenticate at your identity provider, then land back here."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={saveSso}
                disabled={savingSso || !ssoDirty}
              >
                {savingSso ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save SSO"
                )}
              </Button>
            }
          >
            <SettingsList>
              <SettingRow
                title="Require single sign-on"
                description="Password sign-in stops working for members once enabled."
                icon={Building2}
                checked={settings.ssoEnabled}
                onCheckedChange={(value) =>
                  save(
                    { ssoEnabled: value },
                    {
                      success: value ? "SSO required." : "SSO optional.",
                      error: "Couldn't save single sign-on.",
                    },
                  )
                }
              />
              <SettingRow
                title="Protocol"
                description="How this workspace talks to your identity provider."
                icon={KeyRound}
                control={
                  <Select
                    value={settings.ssoProvider}
                    onValueChange={(value) =>
                      save({ ssoProvider: value }, { error: "Couldn't save the protocol." })
                    }
                  >
                    <SelectTrigger className="w-48 bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SSO_PROVIDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
            </SettingsList>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Entity ID" htmlFor="enterprise-entity-id">
                  <Input
                    id="enterprise-entity-id"
                    className="bg-surface-card"
                    value={ssoDraft.entityId}
                    onChange={(e) => setSsoDraft((d) => ({ ...d, entityId: e.target.value }))}
                    placeholder="urn:example:assets"
                  />
                </Field>
                <Field label="Sign-in URL" htmlFor="enterprise-sso-url">
                  <Input
                    id="enterprise-sso-url"
                    className="bg-surface-card"
                    value={ssoDraft.url}
                    onChange={(e) => setSsoDraft((d) => ({ ...d, url: e.target.value }))}
                    placeholder="https://idp.example.com/sso"
                  />
                </Field>
              </div>
              <Field
                label="Signing certificate"
                htmlFor="enterprise-certificate"
                hint="PEM-encoded public certificate used to verify assertions."
              >
                <Textarea
                  id="enterprise-certificate"
                  className="bg-surface-card font-mono"
                  value={ssoDraft.certificate}
                  onChange={(e) => setSsoDraft((d) => ({ ...d, certificate: e.target.value }))}
                  placeholder="-----BEGIN CERTIFICATE-----"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="SCIM provisioning"
            description="Let your identity provider create and suspend seats."
            action={
              <Badge variant={settings.scimEnabled ? "success" : "neutral"}>
                {settings.scimEnabled ? "Provisioning on" : "Provisioning off"}
              </Badge>
            }
          >
            <SettingsList>
              <SettingRow
                title="Enable SCIM"
                description="Accepts user sync from the configured provider."
                icon={RefreshCw}
                checked={settings.scimEnabled}
                onCheckedChange={(value) =>
                  save(
                    { scimEnabled: value },
                    {
                      success: value ? "SCIM provisioning on." : "SCIM provisioning off.",
                      error: "Couldn't save SCIM provisioning.",
                    },
                  )
                }
              />
            </SettingsList>
            <div className="mt-4">
              <Field
                label="SCIM bearer token"
                htmlFor="enterprise-scim-token"
                hint="Sent as the Authorization bearer on every SCIM call. Rotating revokes the old token immediately."
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="enterprise-scim-token"
                    className="bg-surface-card font-mono"
                    value={settings.scimToken || ""}
                    readOnly
                    placeholder="No token issued yet"
                  />
                  {settings.scimToken ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-border bg-surface-card text-foreground hover:bg-surface-active"
                      onClick={copyScimToken}
                    >
                      <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-border bg-surface-card text-foreground hover:bg-surface-active"
                    onClick={rotateScimToken}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {settings.scimToken ? "Rotate" : "Issue"}
                  </Button>
                </div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Compliance"
            description="How long the paper trail lives, and whether deletion is frozen."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={saveCompliance}
                disabled={savingCompliance || !complianceDirty}
              >
                {savingCompliance ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save compliance"
                )}
              </Button>
            }
          >
            <SettingsList>
              <SettingRow
                title="Legal hold"
                description="While held, retention sweeps and hard deletes are suspended."
                icon={ScrollText}
                control={
                  <div className="flex items-center gap-2">
                    <Badge variant={settings.legalHold ? "warning" : "neutral"}>
                      {settings.legalHold ? "Held" : "Clear"}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={
                        settings.legalHold
                          ? "shrink-0 border-border bg-surface-card text-foreground hover:bg-surface-active"
                          : "shrink-0 border-amber-500/20 text-amber-300 hover:bg-amber-500/10 hover:text-amber-300"
                      }
                      onClick={() =>
                        save(
                          { legalHold: !settings.legalHold },
                          {
                            success: settings.legalHold ? "Legal hold released." : "Legal hold placed.",
                            error: "Couldn't change the legal hold.",
                          },
                        )
                      }
                    >
                      {settings.legalHold ? "Release" : "Place hold"}
                    </Button>
                  </div>
                }
              />
              <SettingRow
                title="Contract tier"
                description="Drives limits and support elsewhere in the suite."
                icon={FileText}
                control={
                  <Select
                    value={settings.contractTier}
                    onValueChange={(value) =>
                      save({ contractTier: value }, { error: "Couldn't save the contract tier." })
                    }
                  >
                    <SelectTrigger className="w-48 bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TIER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
            </SettingsList>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Audit log retention (days)"
                htmlFor="enterprise-audit"
                hint="Auth, role, and settings changes stay queryable this long."
              >
                <Input
                  id="enterprise-audit"
                  className="bg-surface-card"
                  inputMode="numeric"
                  value={complianceDraft.auditDays}
                  onChange={(e) =>
                    setComplianceDraft((d) => ({ ...d, auditDays: e.target.value.replace(/[^\d]/g, "") }))
                  }
                  placeholder="365"
                />
              </Field>
              <Field
                label="Hold note"
                htmlFor="enterprise-hold-note"
                hint="Matter reference for the hold, if any."
              >
                <Input
                  id="enterprise-hold-note"
                  className="bg-surface-card"
                  value={complianceDraft.legalNote}
                  onChange={(e) => setComplianceDraft((d) => ({ ...d, legalNote: e.target.value }))}
                  placeholder="e.g. Matter 2026-118"
                />
              </Field>
            </div>
          </SectionCard>
        </>
      )}
    </SecondaryScreenWrapper>
  );
}

export default EnterpriseScreen;
