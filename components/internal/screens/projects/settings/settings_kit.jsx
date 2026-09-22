"use client";

// Shared hook + presentational helpers for the five settings screens, so the
// optimistic/persist/toast dance is written once. Screens fetch through
// lib/supabase/project_settings.js and render loading → data; every patch is
// optimistic into local state, then persisted, rolling back with a toast.error
// on a falsy write. The data layer never throws and never toasts.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@geiger/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  Field,
  SectionCard,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import {
  defaultProjectSettings,
  getProjectSettings,
  mergeProjectSettings,
  updateProjectRecord,
  updateProjectSettingsColumns,
} from "@/lib/supabase/project_settings";

export function useProjectSettings(projectId) {
  const [settings, setSettings] = useState(() =>
    defaultProjectSettings(projectId),
  );
  const [loading, setLoading] = useState(true);
  const currentRef = useRef(settings);
  useEffect(() => {
    currentRef.current = settings;
  });

  useEffect(() => {
    let alive = true;
    getProjectSettings(projectId).then((row) => {
      if (!alive) return;
      setSettings(row ?? defaultProjectSettings(projectId));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Optimistic merge of one metadata section. Object bags (addons, security,
  // advanced, usage, brandKit) shallow-merge the partial; array sections
  // (variables, watermarks, contactSheets) replace wholesale — callers pass
  // the full next array.
  const patchSection = useCallback(
    async (key, partial) => {
      const prev = currentRef.current;
      if (!projectId) {
        toast.error("Couldn't save the setting.");
        return null;
      }
      const next =
        Array.isArray(partial) ? partial : { ...(prev?.[key] ?? {}), ...partial };
      setSettings({ ...prev, [key]: next });
      const saved = await mergeProjectSettings(projectId, { [key]: next });
      if (saved) {
        setSettings(saved);
        return saved;
      }
      setSettings(prev);
      toast.error("Couldn't save the setting.");
      return null;
    },
    [projectId],
  );

  // Optimistic write of promoted columns (visibility, region, default page
  // size/tab, usage limits).
  const patchColumns = useCallback(
    async (partial) => {
      const prev = currentRef.current;
      if (!projectId) {
        toast.error("Couldn't save the setting.");
        return null;
      }
      setSettings({ ...prev, ...partial });
      const saved = await updateProjectSettingsColumns(projectId, partial);
      if (saved) {
        setSettings(saved);
        return saved;
      }
      setSettings(prev);
      toast.error("Couldn't save the setting.");
      return null;
    },
    [projectId],
  );

  // Name/slug/description on public.projects. The project record lives in
  // ProjectContext, not here, so there is nothing optimistic to roll back —
  // the screen keeps its own draft and reverts it on a falsy return.
  const patchProject = useCallback(
    async (partial) => {
      if (!projectId) {
        toast.error("Couldn't save the project.");
        return null;
      }
      const saved = await updateProjectRecord(projectId, partial);
      if (!saved) toast.error("Couldn't save the project.");
      return saved;
    },
    [projectId],
  );

  return { settings, loading, patchColumns, patchSection, patchProject };
}

// Danger zone ---------------------------------------------------------------

export function DangerZoneCard({ title, description, children, className }) {
  return (
    <SectionCard
      title={title || "Danger zone"}
      description={description || "Irreversible and destructive actions."}
      className={cn("border-red-500/20", className)}
    >
      {children}
    </SectionCard>
  );
}

// Type-to-confirm dialog for destructive actions. Confirm stays disabled
// until the input exactly matches requireText.
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  requireText,
  confirmLabel = "Delete",
  onConfirm,
  pending = false,
}) {
  const [input, setInput] = useState("");
  const matches = (input || "").trim() === (requireText || "").trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setInput("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-muted-foreground">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <Field
          label={`Type "${requireText}" to confirm`}
          hint="This can't be undone."
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={requireText}
            className="border-border bg-surface-card font-mono text-foreground"
          />
        </Field>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!matches || pending}
            className="bg-red-500/90 text-white hover:bg-red-500"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Setting rows -----------------------------------------------------------------

export function NumberSettingRow({
  title,
  description,
  value,
  onSave,
  min,
  max,
  step = 1,
  suffix,
  disabled = false,
}) {
  // Uncontrolled input keyed by the saved value: typing never fights the
  // parent, and an external change (load, rollback) remounts it fresh. While
  // focused the key holds steady so a background update can't steal focus.
  const [focused, setFocused] = useState(false);

  const commit = (raw) => {
    setFocused(false);
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    let clamped = next;
    if (min !== undefined) clamped = Math.max(Number(min), clamped);
    if (max !== undefined) clamped = Math.min(Number(max), clamped);
    if (clamped === Number(value)) return;
    onSave(clamped);
  };

  return (
    <SettingRow
      title={title}
      description={description}
      control={
        <div className="flex items-center gap-1.5">
          <Input
            key={focused ? "editing" : `saved-${String(value ?? "")}`}
            type="number"
            defaultValue={value ?? ""}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onFocus={() => setFocused(true)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label={title}
            className="h-9 w-28 border-border bg-surface-card text-right tabular-nums text-foreground"
          />
          {suffix ? (
            <span className="w-10 shrink-0 text-xs text-text-tertiary">
              {suffix}
            </span>
          ) : null}
        </div>
      }
    />
  );
}

export function SelectSettingRow({
  title,
  description,
  value,
  options,
  onSave,
  placeholder,
  disabled = false,
}) {
  return (
    <SettingRow
      title={title}
      description={description}
      control={
        <Select
          value={value == null ? "" : String(value)}
          onValueChange={onSave}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label={title}
            className="h-9 w-auto min-w-[160px] border-border bg-surface-card text-sm text-foreground"
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="border-border bg-surface-subtle">
            {(options || []).map((option) => (
              <SelectItem key={String(option.value)} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
