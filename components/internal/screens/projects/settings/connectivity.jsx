"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  FlaskConical,
  Link,
  Loader2,
  Pencil,
  Plug,
  Plus,
  Trash2,
  Webhook,
} from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SectionCard,
  SettingRow,
  SettingsList,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookEndpoints,
  updateWebhookEndpoint,
} from "@/lib/supabase/settings";
import { useProjectSettings } from "./use_project_settings";
import { WebhookDialog } from "./webhook_dialog";
import { CONNECTED_SERVICES, WEBHOOK_STATUS_MAP } from "./constants";

// Connectivity — connected services, API base URLs, and outbound webhooks.
//
// Webhook CRUD and signed dispatch live server-side in lib/media/webhooks.js
// (server-only: it signs and delivers to attacker-controlled URLs), reached
// from here through /api/webhooks/endpoints via lib/supabase/settings.js.
// The create response carries the endpoint secret exactly once — it is shown
// below until dismissed and never readable again.

// A browser reachability probe: with `no-cors` the status is opaque, so a
// resolved fetch means the host answered and a rejection means it is
// unreachable. The copy says so rather than claiming a health check.
async function probeUrl(raw, label) {
  let parsed = null;
  try {
    parsed = new URL(String(raw || "").trim());
  } catch {
    parsed = null;
  }
  if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
    toast.error(`${label} isn't a valid URL yet.`);
    return false;
  }
  try {
    await fetch(parsed.toString(), { mode: "no-cors", signal: AbortSignal.timeout(10000) });
    toast.success(`${label} answered.`);
    return true;
  } catch {
    toast.error(`${label} couldn't be reached.`);
    return false;
  }
}

export function ConnectivityScreen({ projectId }) {
  const { settings, loading, save } = useProjectSettings(projectId);
  const [urlDraft, setUrlDraft] = useState({ apiBaseUrl: "", cdnBaseUrl: "" });
  const [seededFor, setSeededFor] = useState(null);
  const [savingUrls, setSavingUrls] = useState(false);
  const [testingKey, setTestingKey] = useState(null);

  const [endpoints, setEndpoints] = useState([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dialogToken, setDialogToken] = useState(0);
  const [secretReveal, setSecretReveal] = useState(null); // { url, secret }
  const [copied, setCopied] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  // Seed the URL form from the fetched row once per project (render-phase
  // adjustment, not an effect — it runs only until seededFor catches up).
  if (!loading && seededFor !== projectId) {
    setSeededFor(projectId);
    setUrlDraft({ apiBaseUrl: settings.apiBaseUrl, cdnBaseUrl: settings.cdnBaseUrl });
  }
  const urlsSeeded = !loading && seededFor === projectId;

  useEffect(() => {
    let alive = true;
    listWebhookEndpoints(projectId).then((rows) => {
      if (!alive) return;
      setEndpoints(rows ?? []);
      setWebhooksLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stats = useMemo(
    () => ({
      services: CONNECTED_SERVICES.filter((s) => settings.services?.[s.id]).length,
      webhooks: endpoints.filter((e) => e.active).length,
    }),
    [settings, endpoints],
  );

  const test = async (key, url, label) => {
    setTestingKey(key);
    await probeUrl(url, label);
    setTestingKey(null);
  };

  const setService = async (id, enabled) => {
    await save(
      { services: { ...(settings.services || {}), [id]: enabled } },
      { error: "Couldn't save that service." },
    );
  };

  const saveUrls = async () => {
    setSavingUrls(true);
    const saved = await save(
      { apiBaseUrl: urlDraft.apiBaseUrl.trim(), cdnBaseUrl: urlDraft.cdnBaseUrl.trim() },
      { success: "Base URLs saved.", error: "Couldn't save the URLs." },
    );
    setSavingUrls(false);
    if (saved) setUrlDraft({ apiBaseUrl: saved.apiBaseUrl, cdnBaseUrl: saved.cdnBaseUrl });
  };

  const openCreate = () => {
    setEditing(null);
    setDialogToken((t) => t + 1);
    setDialogOpen(true);
  };

  const openEdit = (endpoint) => {
    setEditing(endpoint);
    setDialogToken((t) => t + 1);
    setDialogOpen(true);
  };

  const submitEndpoint = async (draft) => {
    if (editing) {
      const previous = endpoints;
      setEndpoints((rows) => rows.map((e) => (e.id === editing.id ? { ...e, ...draft } : e)));
      const saved = await updateWebhookEndpoint(editing.id, draft);
      if (!saved) {
        setEndpoints(previous);
        toast.error("Couldn't save the endpoint.");
        return false;
      }
      setEndpoints((rows) => rows.map((e) => (e.id === saved.id ? saved : e)));
      toast.success("Endpoint saved.");
      return true;
    }
    const created = await createWebhookEndpoint({ projectId, ...draft });
    if (!created) {
      toast.error("Couldn't add the endpoint.");
      return false;
    }
    const { secret, ...pub } = created;
    setEndpoints((rows) => [pub, ...rows]);
    if (secret) {
      setSecretReveal({ url: pub.url, secret });
      setCopied(false);
    }
    toast.success("Endpoint added.");
    return true;
  };

  const setEndpointActive = async (endpoint, active) => {
    const previous = endpoints;
    setEndpoints((rows) => rows.map((e) => (e.id === endpoint.id ? { ...e, active } : e)));
    const saved = await updateWebhookEndpoint(endpoint.id, { active });
    if (!saved) {
      setEndpoints(previous);
      toast.error("Couldn't change that endpoint.");
      return;
    }
    setEndpoints((rows) => rows.map((e) => (e.id === saved.id ? saved : e)));
    toast.success(active ? "Endpoint resumed." : "Endpoint paused.");
  };

  const removeEndpoint = async (endpoint) => {
    if (confirmingDeleteId !== endpoint.id) {
      setConfirmingDeleteId(endpoint.id);
      return;
    }
    setConfirmingDeleteId(null);
    const previous = endpoints;
    setEndpoints((rows) => rows.filter((e) => e.id !== endpoint.id));
    const ok = await deleteWebhookEndpoint(endpoint.id);
    if (!ok) {
      setEndpoints(previous);
      toast.error("Couldn't delete the endpoint.");
      return;
    }
    toast.success("Endpoint deleted.");
  };

  const copySecret = async () => {
    if (!secretReveal?.secret) return;
    try {
      await navigator.clipboard.writeText(secretReveal.secret);
      setCopied(true);
      toast.success("Secret copied.");
    } catch {
      toast.error("Couldn't copy — select it manually.");
    }
  };

  const urlsDirty =
    urlsSeeded &&
    (urlDraft.apiBaseUrl !== settings.apiBaseUrl || urlDraft.cdnBaseUrl !== settings.cdnBaseUrl);

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Connectivity"
        description={`${stats.services} of ${CONNECTED_SERVICES.length} services on · ${stats.webhooks} live webhook ${stats.webhooks === 1 ? "endpoint" : "endpoints"}.`}
      />

      {loading || !urlsSeeded ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading connectivity settings" />
        </div>
      ) : (
        <>
          <SectionCard
            title="API base URLs"
            description="Where this project's API and CDN answer. Tests ping the URL from this browser."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={saveUrls}
                disabled={savingUrls || !urlsDirty}
              >
                {savingUrls ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save URLs"
                )}
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="API base URL" htmlFor="connectivity-api-url">
                <div className="flex items-center gap-2">
                  <Input
                    id="connectivity-api-url"
                    className="bg-surface-card"
                    value={urlDraft.apiBaseUrl}
                    onChange={(e) => setUrlDraft((d) => ({ ...d, apiBaseUrl: e.target.value }))}
                    placeholder="https://api.example.com"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-border bg-surface-card text-foreground hover:bg-surface-active"
                    disabled={testingKey === "api"}
                    onClick={() => test("api", urlDraft.apiBaseUrl, "API base URL")}
                  >
                    {testingKey === "api" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FlaskConical className="h-4 w-4" />
                    )}
                    Test
                  </Button>
                </div>
              </Field>
              <Field label="CDN base URL" htmlFor="connectivity-cdn-url">
                <div className="flex items-center gap-2">
                  <Input
                    id="connectivity-cdn-url"
                    className="bg-surface-card"
                    value={urlDraft.cdnBaseUrl}
                    onChange={(e) => setUrlDraft((d) => ({ ...d, cdnBaseUrl: e.target.value }))}
                    placeholder="https://cdn.example.com"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-border bg-surface-card text-foreground hover:bg-surface-active"
                    disabled={testingKey === "cdn"}
                    onClick={() => test("cdn", urlDraft.cdnBaseUrl, "CDN base URL")}
                  >
                    {testingKey === "cdn" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FlaskConical className="h-4 w-4" />
                    )}
                    Test
                  </Button>
                </div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Connected services"
            description="Vendors this project talks to. Toggling persists immediately."
          >
            <SettingsList>
              {CONNECTED_SERVICES.map((service) => {
                const enabled = Boolean(settings.services?.[service.id]);
                const testing = testingKey === `service:${service.id}`;
                return (
                  <SettingRow
                    key={service.id}
                    title={service.label}
                    description={service.description}
                    icon={Plug}
                    control={
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                          disabled={testing}
                          onClick={() =>
                            test(`service:${service.id}`, service.defaultUrl, service.label)
                          }
                        >
                          {testing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FlaskConical className="h-4 w-4" />
                          )}
                          Test
                        </Button>
                        <Switch
                          checked={enabled}
                          aria-label={`Enable ${service.label}`}
                          onCheckedChange={(value) => setService(service.id, value)}
                        />
                      </div>
                    }
                  />
                );
              })}
            </SettingsList>
          </SectionCard>

          <SectionCard
            title="Outbound webhooks"
            description="Signed POSTs on asset and upload lifecycle events."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openCreate}
              >
                <Plus className="h-4 w-4" /> Add endpoint
              </Button>
            }
          >
            {secretReveal ? (
              <div className="mb-4 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                <p className="text-xs font-medium text-emerald-300">
                  Endpoint secret for {secretReveal.url} — shown once, never readable again.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs text-foreground">
                    {secretReveal.secret}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-border bg-surface-card text-foreground hover:bg-surface-active"
                    onClick={copySecret}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setSecretReveal(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}

            {webhooksLoading ? (
              <div className="flex items-center justify-center px-6 py-10">
                <LogoLoading size={40} aria-label="Loading webhook endpoints" />
              </div>
            ) : endpoints.length === 0 ? (
              <EmptyState
                icon={Webhook}
                title="No webhook endpoints yet"
                description="Subscribe a URL and it starts receiving signed lifecycle events."
                action={
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={openCreate}
                  >
                    <Plus className="h-4 w-4" /> Add endpoint
                  </Button>
                }
              />
            ) : (
              <SettingsList>
                {endpoints.map((endpoint) => (
                  <SettingRow
                    key={endpoint.id}
                    title={endpoint.url}
                    description={`${endpoint.events.length} ${endpoint.events.length === 1 ? "event" : "events"} · ${endpoint.events.slice(0, 3).join(", ")}${endpoint.events.length > 3 ? "…" : ""}`}
                    icon={Link}
                    control={
                      <div className="flex items-center gap-2">
                        <StatusPill
                          status={endpoint.active ? "active" : "paused"}
                          map={WEBHOOK_STATUS_MAP}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                          disabled={testingKey === `ping:${endpoint.id}`}
                          onClick={() => test(`ping:${endpoint.id}`, endpoint.url, "Endpoint")}
                        >
                          {testingKey === `ping:${endpoint.id}` ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FlaskConical className="h-4 w-4" />
                          )}
                          Test
                        </Button>
                        <Switch
                          checked={endpoint.active}
                          aria-label={`Enable ${endpoint.url}`}
                          onCheckedChange={(value) => setEndpointActive(endpoint, value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${endpoint.url}`}
                          className="text-text-secondary hover:text-foreground"
                          onClick={() => openEdit(endpoint)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${endpoint.url}`}
                          className={
                            confirmingDeleteId === endpoint.id
                              ? "bg-red-500/10 text-red-400 hover:text-red-400"
                              : "text-text-secondary hover:text-foreground"
                          }
                          onClick={() => removeEndpoint(endpoint)}
                          onBlur={() => setConfirmingDeleteId(null)}
                        >
                          {confirmingDeleteId === endpoint.id ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    }
                  />
                ))}
              </SettingsList>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-text-tertiary">Signed events:</span>
              {["asset.created", "upload.completed", "upload.failed"].map((event) => (
                <Badge key={event} variant="neutral">
                  {event}
                </Badge>
              ))}
            </div>
          </SectionCard>
        </>
      )}

      <WebhookDialog
        key={`webhook:${editing?.id ?? "new"}:${dialogToken}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        endpoint={editing}
        onSubmit={submitEndpoint}
      />
    </SecondaryScreenWrapper>
  );
}

export default ConnectivityScreen;
