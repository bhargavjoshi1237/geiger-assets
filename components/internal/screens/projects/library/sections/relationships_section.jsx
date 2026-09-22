"use client";

import React, { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, Repeat2, X, File } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@geiger/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  EditorSectionHeader,
  EmptyState,
  Field,
} from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { TYPE_ICONS, RELATION_META, RELATION_OPTIONS, formatBytes } from "../constants";

function TypeGlyph({ type, color, className }) {
  const Icon = TYPE_ICONS[type] || File;
  return <Icon className={className} style={{ color: color || "#737373" }} />;
}

function AssetPicker({ value, candidates, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates.slice(0, 50);
    return candidates
      .filter((a) => `${a.name} ${a.format || a.type}`.toLowerCase().includes(q))
      .slice(0, 50);
  }, [candidates, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-border bg-surface-card font-normal text-foreground hover:bg-surface-hover"
        >
          <span className="truncate">{value ? value.name : "Choose an asset…"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-text-tertiary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] border-border bg-surface-subtle p-0"
      >
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets…"
            className="border-border bg-surface-card"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {matches.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onChange?.(a);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-hover"
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  a.id === value?.id ? "text-primary" : "text-transparent",
                )}
              />
              <TypeGlyph type={a.type} color={a.color} className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{a.name}</span>
              <span className="shrink-0 text-xs text-text-tertiary">
                {a.format || a.type} · {formatBytes(a.sizeBytes)}
              </span>
            </button>
          ))}
          {!matches.length ? (
            <p className="px-2 py-3 text-center text-sm text-text-tertiary">
              {candidates.length ? "No assets match that search." : "No other assets to link."}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RelationshipsSection({
  asset,
  headerItem,
  relationships = [],
  candidates = [],
  onAdd,
  onRemove,
}) {
  const [adding, setAdding] = useState(false);
  const [relationType, setRelationType] = useState("derived");
  const [target, setTarget] = useState(null);
  const [byName, setByName] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const linkable = useMemo(() => {
    const taken = new Set(relationships.map((r) => r.relatedAssetId).filter(Boolean));
    return candidates.filter((a) => a.id !== asset?.id && !taken.has(a.id));
  }, [candidates, relationships, asset]);

  const reset = () => {
    setTarget(null);
    setLabel("");
    setByName(false);
    setRelationType("derived");
    setAdding(false);
  };

  const ready = byName ? Boolean(label.trim()) : Boolean(target);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    await onAdd?.(
      byName
        ? { relationType, label: label.trim(), relatedAssetId: null }
        : { relationType, label: target.name, relatedAssetId: target.id },
    );
    setBusy(false);
    reset();
  };

  return (
    <div className="space-y-5">
      <EditorSectionHeader
        title={headerItem?.label || "Relationships"}
        description={
          headerItem?.desc || "Originals, derivatives, variants, and related records."
        }
        action={
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => (adding ? reset() : setAdding(true))}
          >
            {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {adding ? "Cancel" : "Add relationship"}
          </Button>
        }
      />

      {adding ? (
        <div className="rounded-xl border border-border bg-surface-subtle p-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <Field label="Relation">
              <Select value={relationType} onValueChange={setRelationType}>
                <SelectTrigger className="w-full border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {RELATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={byName ? "Name" : "Asset"}>
              {byName ? (
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Campaign, product, or record name"
                  className="border-border bg-surface-card"
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              ) : (
                <AssetPicker value={target} candidates={linkable} onChange={setTarget} />
              )}
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={submit}
              disabled={busy || !ready}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-text-secondary hover:text-foreground"
              onClick={() => {
                setByName((v) => !v);
                setTarget(null);
                setLabel("");
              }}
            >
              {byName ? "Link an asset instead" : "Link by name instead"}
            </Button>
          </div>
        </div>
      ) : null}

      {relationships.length === 0 ? (
        adding ? null : (
          <EmptyState
            icon={Repeat2}
            title="No relationships"
            description="Link this asset to its originals, variants, or campaigns."
            className="rounded-xl border border-dashed border-border py-12"
            action={
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                onClick={() => setAdding(true)}
              >
                <Plus className="h-4 w-4" />
                Add relationship
              </Button>
            }
          />
        )
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {relationships.map((rel) => {
            const meta = RELATION_META[rel.relationType] || RELATION_META.derived;
            const name = rel.related?.name || rel.label || "Untitled";
            return (
              <div key={rel.id} className="group flex items-center gap-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
                  <TypeGlyph
                    type={rel.related?.type}
                    color={rel.related?.color}
                    className="h-4 w-4"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{name}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge className={cn("border px-1.5 py-0 text-[10px]", meta.className)}>
                      {meta.label}
                    </Badge>
                    {!rel.relatedAssetId ? (
                      <span className="text-xs text-text-tertiary">Linked by name</span>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${name}`}
                  className="shrink-0 text-text-tertiary opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => onRemove?.(rel.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RelationshipsSection;
