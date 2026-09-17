"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound, RotateCcw } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { Field } from "@/components/internal/shared/screen_kit";
import { BACKEND_FIELDS, BACKEND_FIELD_KINDS } from "@/lib/storage/backends/fields";
import { BACKEND_KIND_MAP } from "./constants";

// Create / edit a storage backend.
//
// The form is rendered from BACKEND_FIELDS, never hardcoded per kind: adding a
// provider to the catalog is all it should take to get a form for it.
//
// Secrets are the part that has to be exactly right. A read never returns a
// credential — a configured one comes back as a `<name>Set: true` flag — so an
// already-configured secret renders as "Configured" with a Replace affordance
// and is *omitted from the submitted config* unless the operator typed a new
// value. The store reads an absent (or empty) secret key as "leave unchanged",
// which is what stops an edit from blanking a live credential.

function fieldsFor(kind) {
  return BACKEND_FIELDS[kind] || [];
}

function defaultValueFor(field) {
  if (field.default !== undefined) return field.default;
  return field.type === "boolean" ? false : "";
}

// Non-secret values only; secrets are tracked separately because their state is
// "configured / replacing / typed", not a value.
function initialValues(kind, config) {
  const out = {};
  for (const field of fieldsFor(kind)) {
    if (field.secret) continue;
    const stored = config?.[field.name];
    if (stored === undefined || stored === null || stored === "") {
      out[field.name] = defaultValueFor(field);
    } else {
      out[field.name] = field.type === "boolean" ? Boolean(stored) : String(stored);
    }
  }
  return out;
}

function isSecretConfigured(config, name) {
  return config?.[`${name}Set`] === true;
}

// The caller remounts this on every open (a key carrying the target id and an
// open token), so state seeds from props once and a half-typed credential can
// never survive into the next edit.
export function BackendDialog({ open, onOpenChange, backend, onSubmit }) {
  const editing = Boolean(backend);
  const [kind, setKind] = useState(backend?.kind || BACKEND_FIELD_KINDS[0]);
  const [label, setLabel] = useState(backend?.label || "");
  const [maxUploadMb, setMaxUploadMb] = useState(
    backend?.maxUploadBytes ? String(Math.round(backend.maxUploadBytes / (1024 * 1024))) : "",
  );
  const [enabled, setEnabled] = useState(backend?.enabled ?? true);
  const [values, setValues] = useState(() =>
    initialValues(backend?.kind || BACKEND_FIELD_KINDS[0], backend?.config),
  );
  // Typed replacements, keyed by field name. A name absent from here is a
  // secret the operator did not touch.
  const [secrets, setSecrets] = useState({});
  const [replacing, setReplacing] = useState({});
  const [busy, setBusy] = useState(false);

  const config = backend?.config || {};
  const fields = useMemo(() => fieldsFor(kind), [kind]);

  const switchKind = (next) => {
    setKind(next);
    setValues(initialValues(next, null));
    setSecrets({});
    setReplacing({});
  };

  const setValue = (name) => (value) => setValues((v) => ({ ...v, [name]: value }));

  const startReplacing = (name) => {
    setReplacing((r) => ({ ...r, [name]: true }));
    setSecrets((s) => ({ ...s, [name]: "" }));
  };

  const keepCurrent = (name) => {
    setReplacing((r) => {
      const next = { ...r };
      delete next[name];
      return next;
    });
    setSecrets((s) => {
      const next = { ...s };
      delete next[name];
      return next;
    });
  };

  const buildConfig = () => {
    const out = {};
    for (const field of fields) {
      if (field.secret) {
        const typed = secrets[field.name];
        // Untouched secret: omit the key entirely. The store merges the patch
        // onto the stored config, so omission keeps the live credential.
        if (typeof typed === "string" && typed !== "") out[field.name] = typed;
        continue;
      }
      const value = values[field.name];
      if (field.type === "boolean") {
        out[field.name] = Boolean(value);
      } else if (value !== "" && value !== undefined && value !== null) {
        out[field.name] = value;
      }
    }
    return out;
  };

  const missingRequired = () => {
    for (const field of fields) {
      if (!field.required) continue;
      if (field.secret) {
        const typed = secrets[field.name];
        const provided = typeof typed === "string" && typed !== "";
        // On an edit, an already-stored credential satisfies the requirement
        // without being re-typed.
        if (provided) continue;
        if (editing && isSecretConfigured(config, field.name)) continue;
        return field.label;
      }
      const value = values[field.name];
      if (field.type === "boolean") continue;
      if (value === "" || value === undefined || value === null) return field.label;
    }
    return null;
  };

  const submit = async () => {
    if (busy) return;
    if (!label.trim()) {
      toast.error("Give the backend a label.");
      return;
    }
    const missing = missingRequired();
    if (missing) {
      toast.error(`${missing} is required.`);
      return;
    }
    const mb = Number(maxUploadMb);
    if (maxUploadMb !== "" && (!Number.isFinite(mb) || mb < 0)) {
      toast.error("Max upload size must be a positive number of MB.");
      return;
    }

    setBusy(true);
    const ok = await onSubmit({
      kind,
      label: label.trim(),
      enabled,
      maxUploadBytes: maxUploadMb === "" ? 0 : Math.round(mb * 1024 * 1024),
      config: buildConfig(),
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const renderControl = (field) => {
    if (field.secret) {
      const configured = editing && isSecretConfigured(config, field.name);
      if (configured && !replacing[field.name]) {
        return (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-card px-3 py-2">
            <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
              <KeyRound className="h-3.5 w-3.5 text-text-tertiary" />
              Configured
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-text-secondary hover:text-foreground"
              onClick={() => startReplacing(field.name)}
            >
              Replace
            </Button>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <Input
            id={`backend-${field.name}`}
            type="password"
            autoComplete="new-password"
            className="bg-surface-card"
            value={secrets[field.name] ?? ""}
            placeholder={field.placeholder || "Enter a new value"}
            onChange={(e) => setSecrets((s) => ({ ...s, [field.name]: e.target.value }))}
          />
          {configured ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Keep the current ${field.label}`}
              className="text-text-secondary hover:text-foreground"
              onClick={() => keepCurrent(field.name)}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      );
    }

    if (field.type === "boolean") {
      return (
        <div className="flex h-9 items-center">
          <Switch
            id={`backend-${field.name}`}
            checked={Boolean(values[field.name])}
            onCheckedChange={setValue(field.name)}
          />
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <Select value={String(values[field.name] ?? "")} onValueChange={setValue(field.name)}>
          <SelectTrigger id={`backend-${field.name}`} className="bg-surface-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        id={`backend-${field.name}`}
        className="bg-surface-card"
        value={String(values[field.name] ?? "")}
        placeholder={field.placeholder || ""}
        onChange={(e) => setValue(field.name)(e.target.value)}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit backend" : "Add backend"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update how this provider is reached. Stored credentials stay untouched unless you replace them."
              : "Credentials are encrypted before they are stored and are never sent back to the browser."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label" htmlFor="backend-label">
              <Input
                id="backend-label"
                className="bg-surface-card"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Frankfurt R2"
                autoFocus
              />
            </Field>
            <Field
              label="Kind"
              htmlFor="backend-kind"
              hint={
                editing
                  ? "A backend's kind can't change — add a new backend instead."
                  : BACKEND_KIND_MAP[kind]?.description
              }
            >
              <Select value={kind} onValueChange={switchKind} disabled={editing}>
                <SelectTrigger id="backend-kind" className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BACKEND_FIELD_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {BACKEND_KIND_MAP[k]?.label || k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Max upload size (MB)"
              htmlFor="backend-max-upload"
              hint="Blank or 0 means no per-backend cap."
            >
              <Input
                id="backend-max-upload"
                className="bg-surface-card"
                inputMode="numeric"
                value={maxUploadMb}
                onChange={(e) => setMaxUploadMb(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
              />
            </Field>
            <Field label="Enabled" hint="A disabled backend is skipped by placement.">
              <div className="flex h-9 items-center">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </Field>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              {BACKEND_KIND_MAP[kind]?.label || kind} connection
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <Field
                  key={field.name}
                  label={field.required ? `${field.label} *` : field.label}
                  htmlFor={`backend-${field.name}`}
                  hint={
                    field.secret && isSecretConfigured(config, field.name) && !replacing[field.name]
                      ? "Stored and encrypted — it is never sent back to this form."
                      : field.hint
                  }
                >
                  {renderControl(field)}
                </Field>
              ))}
            </div>
          </div>

          {editing ? (
            <Badge variant="neutral" className="w-fit">
              Leave a secret as “Configured” and it stays exactly as it is.
            </Badge>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : editing ? (
              "Save changes"
            ) : (
              "Add backend"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BackendDialog;
