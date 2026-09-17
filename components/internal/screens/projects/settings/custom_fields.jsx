"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Switch } from "@geiger/ui/switch";
import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  ScreenHeader,
  SectionCard,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import {
  createCustomField,
  listCustomFields,
  reorderCustomFields,
  softDeleteCustomField,
  updateCustomField,
} from "@/lib/supabase/settings";
import { CustomFieldDialog } from "./custom_field_dialog";
import { ASSET_TYPE_OPTIONS, FIELD_TYPE_MAP } from "./constants";

// Custom Fields — metadata field definitions (name, key, type, required,
// default, options), manual ordering, and scoping to asset types.
//
// Rows persist through lib/supabase/settings.js optimistically: creates mint
// crypto.randomUUID() up front, and a falsy write rolls the list back with a
// toast. Reorders write positions in one pass.

const TYPE_LABEL = new Map(ASSET_TYPE_OPTIONS.map((o) => [o.value, o.label]));

function scopeText(assetTypes) {
  if (!assetTypes || assetTypes.length === 0) return "All asset types";
  return assetTypes.map((t) => TYPE_LABEL.get(t) || t).join(", ");
}

export function CustomFieldsScreen({ projectId }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dialogToken, setDialogToken] = useState(0);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  useEffect(() => {
    let alive = true;
    listCustomFields(projectId).then((rows) => {
      if (!alive) return;
      setFields(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const openCreate = () => {
    setEditing(null);
    setDialogToken((t) => t + 1);
    setDialogOpen(true);
  };

  const openEdit = (field) => {
    setEditing(field);
    setDialogToken((t) => t + 1);
    setDialogOpen(true);
  };

  const submitField = async (draft) => {
    if (editing) {
      const previous = fields;
      setFields((rows) => rows.map((f) => (f.id === editing.id ? { ...f, ...draft } : f)));
      const saved = await updateCustomField(editing.id, draft);
      if (!saved) {
        setFields(previous);
        toast.error("Couldn't save the field.");
        return false;
      }
      setFields((rows) => rows.map((f) => (f.id === saved.id ? saved : f)));
      toast.success(`Saved “${saved.name}”.`);
      return true;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      position: fields.length,
      options: [],
      assetTypes: [],
      required: false,
      active: true,
      defaultValue: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setFields((rows) => [...rows, optimistic]);
    const created = await createCustomField({ projectId, id, position: fields.length, ...draft });
    if (!created) {
      setFields((rows) => rows.filter((f) => f.id !== id));
      toast.error("Couldn't add the field.");
      return false;
    }
    setFields((rows) => rows.map((f) => (f.id === id ? created : f)));
    toast.success(`Added “${created.name}”.`);
    return true;
  };

  const setActive = async (field, active) => {
    const previous = fields;
    setFields((rows) => rows.map((f) => (f.id === field.id ? { ...f, active } : f)));
    const saved = await updateCustomField(field.id, { active });
    if (!saved) {
      setFields(previous);
      toast.error("Couldn't change that field.");
      return;
    }
    setFields((rows) => rows.map((f) => (f.id === saved.id ? saved : f)));
    toast.success(active ? `“${saved.name}” is live.` : `“${saved.name}” hidden from editors.`);
  };

  const move = async (field, direction) => {
    const index = fields.findIndex((f) => f.id === field.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= fields.length) return;
    const previous = fields;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
    const ok = await reorderCustomFields(
      projectId,
      next.map((f) => f.id),
    );
    if (!ok) {
      setFields(previous);
      toast.error("Couldn't reorder fields.");
    }
  };

  const removeField = async (field) => {
    if (confirmingDeleteId !== field.id) {
      setConfirmingDeleteId(field.id);
      return;
    }
    setConfirmingDeleteId(null);
    const previous = fields;
    setFields((rows) => rows.filter((f) => f.id !== field.id));
    const ok = await softDeleteCustomField(field.id);
    if (!ok) {
      setFields(previous);
      toast.error("Couldn't delete the field.");
      return;
    }
    toast.success(`Deleted “${field.name}”.`);
  };

  const existingKeys = fields.filter((f) => f.id !== editing?.id).map((f) => f.key);

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Custom Fields"
        description={`${fields.length} ${fields.length === 1 ? "field" : "fields"} · order here is the order editors see.`}
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" /> New field
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading custom fields" />
        </div>
      ) : fields.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={SlidersHorizontal}
            title="No custom fields yet"
            description="Define the metadata editors fill in on every asset."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openCreate}
              >
                <Plus className="h-4 w-4" /> New field
              </Button>
            }
          />
        </div>
      ) : (
        <SectionCard
          title="Fields"
          description="Reorder with the arrows — position saves immediately."
        >
          <div className="grid gap-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-lg border border-border bg-surface-card px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{field.name}</span>
                      <Badge variant="neutral" className="font-mono">
                        {field.key}
                      </Badge>
                      <StatusPill status={field.type} map={FIELD_TYPE_MAP} />
                      {field.required ? <Badge variant="warning">Required</Badge> : null}
                      {!field.active ? <Badge variant="neutral">Hidden</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      {scopeText(field.assetTypes)}
                      {field.options?.length ? ` · ${field.options.join(", ")}` : ""}
                      {field.defaultValue ? ` · default “${field.defaultValue}”` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${field.name} up`}
                      className="text-text-secondary hover:text-foreground"
                      disabled={index === 0}
                      onClick={() => move(field, -1)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${field.name} down`}
                      className="text-text-secondary hover:text-foreground"
                      disabled={index === fields.length - 1}
                      onClick={() => move(field, 1)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={field.active}
                      aria-label={`Show ${field.name} to editors`}
                      onCheckedChange={(value) => setActive(field, value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${field.name}`}
                      className="text-text-secondary hover:text-foreground"
                      onClick={() => openEdit(field)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${field.name}`}
                      className={
                        confirmingDeleteId === field.id
                          ? "bg-red-500/10 text-red-400 hover:text-red-400"
                          : "text-text-secondary hover:text-foreground"
                      }
                      onClick={() => removeField(field)}
                      onBlur={() => setConfirmingDeleteId(null)}
                    >
                      {confirmingDeleteId === field.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <CustomFieldDialog
        key={`field:${editing?.id ?? "new"}:${dialogToken}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        field={editing}
        existingKeys={existingKeys}
        onSubmit={submitField}
      />
    </SecondaryScreenWrapper>
  );
}

export default CustomFieldsScreen;
