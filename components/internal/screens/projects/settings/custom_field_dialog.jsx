"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import { ASSET_TYPE_OPTIONS, FIELD_TYPE_OPTIONS, FIELD_TYPES_WITH_OPTIONS } from "./constants";

function keyify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "_$1");
}

// Create / edit a custom metadata field. The screen persists through
// lib/supabase/settings.js; this form only validates shape.

// The caller remounts this on every open (a key carrying the target id and an
// open token), so state seeds from props once and a half-typed definition can
// never survive into the next edit.
export function CustomFieldDialog({ open, onOpenChange, field, existingKeys, onSubmit }) {
  const editing = Boolean(field);
  const [name, setName] = useState(field?.name || "");
  const [key, setKey] = useState(field?.key || "");
  const [keyTouched, setKeyTouched] = useState(Boolean(field));
  const [type, setType] = useState(field?.type || "text");
  const [required, setRequired] = useState(field?.required ?? false);
  const [defaultValue, setDefaultValue] = useState(field?.defaultValue ?? "");
  const [optionsText, setOptionsText] = useState((field?.options || []).join(", "));
  const [assetTypes, setAssetTypes] = useState(field?.assetTypes || []);
  const [active, setActive] = useState(field?.active ?? true);
  const [busy, setBusy] = useState(false);

  const onNameChange = (value) => {
    setName(value);
    if (!keyTouched) setKey(keyify(value));
  };

  const toggleAssetType = (value) =>
    setAssetTypes((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]));

  const needsOptions = FIELD_TYPES_WITH_OPTIONS.includes(type);

  const submit = async () => {
    if (busy) return;
    if (!name.trim()) {
      toast.error("Give the field a name.");
      return;
    }
    const cleanKey = keyify(key);
    if (!/^[a-z][a-z0-9_]*$/.test(cleanKey)) {
      toast.error("The key must start with a letter and hold only a–z, 0–9, _.");
      return;
    }
    if ((existingKeys || []).includes(cleanKey)) {
      toast.error(`The key “${cleanKey}” is already taken.`);
      return;
    }
    const options = optionsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (needsOptions && options.length === 0) {
      toast.error("A select field needs at least one option.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name: name.trim(),
      key: cleanKey,
      type,
      required,
      defaultValue: typeof defaultValue === "boolean" ? String(defaultValue) : String(defaultValue ?? ""),
      options: needsOptions ? options : [],
      assetTypes,
      active,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit field" : "New field"}</DialogTitle>
          <DialogDescription>
            Fields attach to asset metadata. An empty scope means every asset type.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="custom-field-name">
              <Input
                id="custom-field-name"
                className="bg-surface-card"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g. Photographer"
                autoFocus
              />
            </Field>
            <Field label="Key" htmlFor="custom-field-key" hint="Machine name — letters, digits, underscores.">
              <Input
                id="custom-field-key"
                className="bg-surface-card font-mono"
                value={key}
                onChange={(e) => {
                  setKeyTouched(true);
                  setKey(keyify(e.target.value));
                }}
                placeholder="photographer"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="custom-field-type">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="custom-field-type" className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Default value" htmlFor="custom-field-default">
              {type === "boolean" ? (
                <div className="flex h-9 items-center">
                  <Switch
                    id="custom-field-default"
                    checked={defaultValue === true || defaultValue === "true"}
                    onCheckedChange={(value) => setDefaultValue(String(value))}
                  />
                </div>
              ) : (
                <Input
                  id="custom-field-default"
                  type={type === "date" ? "date" : type === "number" ? "number" : "text"}
                  className="bg-surface-card"
                  value={String(defaultValue ?? "")}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder="Optional"
                />
              )}
            </Field>
          </div>

          {needsOptions ? (
            <Field
              label="Options"
              htmlFor="custom-field-options"
              hint="Comma-separated. Order here is the order editors see."
            >
              <Input
                id="custom-field-options"
                className="bg-surface-card"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="Indoor, Outdoor, Studio"
              />
            </Field>
          ) : null}

          <Field label="Asset types" hint="No selection means the field applies to every type.">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setAssetTypes([])} aria-pressed={assetTypes.length === 0}>
                <Badge variant={assetTypes.length === 0 ? "success" : "outline"} className="cursor-pointer">
                  All types
                </Badge>
              </button>
              {ASSET_TYPE_OPTIONS.map((option) => {
                const on = assetTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleAssetType(option.value)}
                    aria-pressed={on}
                  >
                    <Badge variant={on ? "success" : "outline"} className="cursor-pointer">
                      {option.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Required" hint="Editors must fill this in.">
              <div className="flex h-9 items-center">
                <Switch checked={required} onCheckedChange={setRequired} />
              </div>
            </Field>
            <Field label="Active" hint="Inactive fields stay on old assets but hide from editors.">
              <div className="flex h-9 items-center">
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </Field>
          </div>
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
              "Add field"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CustomFieldDialog;
