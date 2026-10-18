"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Globe, ShieldCheck } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  Field,
  LoadingArea,
  ScreenHeader,
  SectionCard,
  SettingRow,
  SettingsList,
} from "@/components/internal/shared/screen_kit";
import { EditorSaveActions } from "@/components/internal/shared/unsaved_changes";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { Textarea } from "@geiger/ui/textarea";
import { cn } from "@/lib/utils";
import { EFFECT_OPTIONS, FORMAT_OPTIONS } from "./constants";
import { Notice } from "./platform_kit";
import { getDeliverySettings, saveDeliverySettings } from "@/lib/supabase/platform";

const DEFAULT_SETTINGS_FORM = {
  maxWidth: 4000,
  maxHeight: 4000,
  maxMegapixels: 25,
  allowedFormats: FORMAT_OPTIONS.map((o) => o.value),
  allowedEffects: EFFECT_OPTIONS.map((o) => o.value),
  referrerText: "",
  requireSignedUrls: false,
};

const LIMIT_FIELDS = [
  { key: "maxWidth", label: "Max width", unit: "px", inputMode: "numeric", hint: "Widest output a URL can ask for." },
  { key: "maxHeight", label: "Max height", unit: "px", inputMode: "numeric", hint: "Tallest output a URL can ask for." },
  { key: "maxMegapixels", label: "Max area", unit: "MP", inputMode: "decimal", hint: "Width × height ceiling." },
];

// The allowlist is edited as free text (one host per line) and only split
// into an array on save, so typing a newline isn't swallowed mid-edit.
function parseHosts(text) {
  return String(text || "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fromSettings(settings) {
  if (!settings) return { ...DEFAULT_SETTINGS_FORM };
  return {
    maxWidth: settings.maxWidth,
    maxHeight: settings.maxHeight,
    maxMegapixels: settings.maxMegapixels,
    allowedFormats: settings.allowedFormats?.length ? settings.allowedFormats : [...DEFAULT_SETTINGS_FORM.allowedFormats],
    allowedEffects: settings.allowedEffects?.length ? settings.allowedEffects : [...DEFAULT_SETTINGS_FORM.allowedEffects],
    referrerText: (settings.referrerAllowlist || []).join("\n"),
    requireSignedUrls: Boolean(settings.requireSignedUrls),
  };
}

function comparable(form) {
  return JSON.stringify({
    maxWidth: String(form.maxWidth),
    maxHeight: String(form.maxHeight),
    maxMegapixels: String(form.maxMegapixels),
    allowedFormats: [...form.allowedFormats].sort(),
    allowedEffects: [...form.allowedEffects].sort(),
    referrers: parseHosts(form.referrerText),
    requireSignedUrls: form.requireSignedUrls,
  });
}

function ToggleChips({ label, options, selected, onChange }) {
  const set = new Set(selected || []);
  const toggle = (value) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(options.map((o) => o.value).filter((v) => next.has(v)));
  };
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          {label} <span className="text-text-tertiary">· {set.size} of {options.length}</span>
        </p>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={() => onChange(options.map((o) => o.value))}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={() => onChange([])}
          >
            None
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = set.has(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              aria-pressed={on}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
                on
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border bg-surface-card text-text-tertiary hover:bg-surface-hover hover:text-text-secondary",
              )}
            >
              {on ? <Check className="h-3 w-3" /> : null}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DeliverySettingsScreen({ projectId }) {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS_FORM });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getDeliverySettings(projectId).then((s) => {
      if (!alive) return;
      setSettings(s);
      setForm(fromSettings(s));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const dirty = useMemo(
    () => !loading && comparable(fromSettings(settings)) !== comparable(form),
    [loading, settings, form],
  );

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const hosts = parseHosts(form.referrerText);

  const handleSave = async () => {
    if (!form.allowedFormats.length) {
      toast.error("Allow at least one output format.");
      return;
    }
    setSaving(true);
    const saved = await saveDeliverySettings(projectId, {
      maxWidth: Number(form.maxWidth) || 4000,
      maxHeight: Number(form.maxHeight) || 4000,
      maxMegapixels: Number(form.maxMegapixels) || 25,
      allowedFormats: form.allowedFormats,
      allowedEffects: form.allowedEffects,
      referrerAllowlist: hosts,
      requireSignedUrls: form.requireSignedUrls,
    });
    setSaving(false);
    if (saved) {
      setSettings(saved);
      setForm(fromSettings(saved));
      toast.success("Delivery policy saved.");
    } else {
      toast.error("Couldn't save the delivery policy.");
    }
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Delivery Settings"
        description="The transform policy every public delivery URL renders under."
        actions={
          loading ? null : (
            <EditorSaveActions
              dirty={dirty}
              saving={saving}
              onSave={handleSave}
              onDiscard={() => setForm(fromSettings(settings))}
            />
          )
        }
      />

      {loading ? (
        <LoadingArea panel size={56} label="Loading delivery settings" />
      ) : (
        <div className="space-y-6">
          <SectionCard
            title="Output limits"
            description="Upper bounds for any size a delivery URL requests."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {LIMIT_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  <div className="flex items-center rounded-md border border-border bg-surface-card pr-3 focus-within:border-border-strong">
                    <Input
                      value={form[f.key]}
                      onChange={(e) => set(f.key)(e.target.value.replace(/[^\d.]/g, ""))}
                      inputMode={f.inputMode}
                      aria-label={f.label}
                      className="border-0 bg-transparent tabular-nums focus-visible:ring-0"
                    />
                    <span className="shrink-0 text-xs font-medium text-text-tertiary">{f.unit}</span>
                  </div>
                </Field>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Formats & effects"
            description="Which f_ and e_ transform values the engine will render."
          >
            <div className="space-y-6">
              <ToggleChips
                label="Output formats"
                options={FORMAT_OPTIONS}
                selected={form.allowedFormats}
                onChange={set("allowedFormats")}
              />
              <div className="border-t border-border" />
              <ToggleChips
                label="Effects"
                options={EFFECT_OPTIONS}
                selected={form.allowedEffects}
                onChange={set("allowedEffects")}
              />
            </div>
          </SectionCard>

          <SectionCard title="Access" description="Control who can load delivery URLs.">
            <SettingsList>
              <SettingRow
                icon={ShieldCheck}
                title="Require signed URLs"
                description="When on, /d/ URLs need a valid signature minted through the delivery API."
                control={
                  <Switch
                    checked={form.requireSignedUrls}
                    onCheckedChange={set("requireSignedUrls")}
                    aria-label="Require signed URLs"
                  />
                }
              />
              <div className="flex items-start gap-3 pt-3.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Referrer allowlist</p>
                    <p className="text-xs text-text-secondary">
                      One hostname per line. Leave empty to allow every site to embed delivery URLs.
                    </p>
                  </div>
                  <Textarea
                    rows={4}
                    value={form.referrerText}
                    onChange={(e) => set("referrerText")(e.target.value)}
                    placeholder={"example.com\nshop.example.com"}
                    aria-label="Referrer allowlist"
                    className="resize-y bg-surface-card font-mono text-xs"
                  />
                  <p className="text-xs text-text-tertiary">
                    {hosts.length
                      ? `${hosts.length} host${hosts.length === 1 ? "" : "s"} allowed`
                      : "Open to every referrer"}
                  </p>
                </div>
              </div>
            </SettingsList>
          </SectionCard>

          {form.requireSignedUrls && !settings?.requireSignedUrls ? (
            <Notice tone="warning">
              Existing unsigned delivery links stop working once you save with signing required.
            </Notice>
          ) : null}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default DeliverySettingsScreen;
