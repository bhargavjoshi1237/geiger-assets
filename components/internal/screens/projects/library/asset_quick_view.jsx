"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, File, Pencil, Trash2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@geiger/ui/sheet";
import { Button } from "@geiger/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  Field,
  SettingRow,
  SettingsList,
} from "@/components/internal/shared/screen_kit";
import { AssetPreview } from "@/components/internal/shared/asset_preview";
import { cn } from "@/lib/utils";
import { assetFileUrl } from "@/lib/storage/client";
import { listRelationships, listVersions, updateAsset } from "@/lib/supabase/assets";
import { TagInput } from "./tag_input";
import {
  TYPE_ICONS,
  STATUS_META,
  STATUS_OPTIONS,
  formatBytes,
  formatDateTime,
} from "./constants";

function MetaRow({ label, value }) {
  return (
    <SettingRow
      title={label}
      control={
        <span className="max-w-[16rem] break-words text-right text-sm text-foreground">
          {value || <span className="text-text-tertiary">—</span>}
        </span>
      }
    />
  );
}

export function AssetQuickViewSheet({
  asset,
  open,
  onOpenChange,
  onEdit,
  onDuplicate,
  onDelete,
  onUpdate,
}) {
  const [counts, setCounts] = useState(null);

  const assetId = asset?.id;
  useEffect(() => {
    if (!open || !assetId) return undefined;
    let alive = true;
    Promise.all([listRelationships(assetId), listVersions(assetId)]).then(
      ([rels, vers]) => {
        if (!alive) return;
        setCounts({
          id: assetId,
          relationships: (rels ?? []).length,
          versions: (vers ?? []).length,
        });
      },
    );
    return () => {
      alive = false;
    };
  }, [open, assetId]);

  const loaded = counts?.id === assetId ? counts : null;

  if (!asset) return null;

  const Icon = TYPE_ICONS[asset.type] || File;
  const statusMeta = STATUS_META[asset.status] || STATUS_META.draft;
  const hasFile = Boolean(asset.storageKey);

  const persist = async (patch) => {
    const previous = { id: asset.id };
    for (const key of Object.keys(patch)) previous[key] = asset[key];
    onUpdate?.({ id: asset.id, ...patch });
    const updated = await updateAsset(asset.id, patch);
    if (updated) onUpdate?.(updated);
    else {
      onUpdate?.(previous);
      toast.error("Couldn't save that change to the server.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-l border-border bg-surface-subtle p-0 sm:max-w-lg"
      >
        <SheetHeader className="gap-3 border-b border-border p-6 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
              style={{
                background: `${asset.color || "#737373"}15`,
                borderColor: `${asset.color || "#737373"}25`,
              }}
            >
              <Icon className="h-4 w-4" style={{ color: asset.color || "#737373" }} />
            </div>
            <div className="min-w-0 flex-1 pr-6">
              <SheetTitle className="truncate text-base leading-snug">
                {asset.name || "Untitled asset"}
              </SheetTitle>
              <SheetDescription className="truncate text-xs">
                {[asset.format || asset.type, formatBytes(asset.sizeBytes), asset.folder]
                  .filter(Boolean)
                  .join(" · ")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <AssetPreview asset={asset} frameless className="border-b border-border" />

          <div className="grid gap-5 p-6">
            <Field label="Status">
              <Select value={asset.status} onValueChange={(v) => persist({ status: v })}>
                <SelectTrigger
                  className={cn("w-full border-border bg-surface-card", statusMeta.className)}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Tags">
              <TagInput value={asset.tags} onChange={(tags) => persist({ tags })} />
            </Field>

            {asset.description ? (
              <Field label="Description">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {asset.description}
                </p>
              </Field>
            ) : null}

            <Field label="Details">
              <SettingsList className="mt-1 rounded-lg border border-border bg-surface-card px-4 py-3">
                <MetaRow label="Type" value={asset.format || asset.type} />
                <MetaRow label="Dimensions" value={asset.dimensions} />
                <MetaRow label="Folder" value={asset.folder} />
                <MetaRow
                  label="Downloads"
                  value={(asset.downloads ?? 0).toLocaleString("en-US")}
                />
                <MetaRow label="Versions" value={loaded ? String(loaded.versions) : "…"} />
                <MetaRow
                  label="Relationships"
                  value={loaded ? String(loaded.relationships) : "…"}
                />
                <MetaRow label="Modified" value={formatDateTime(asset.updatedAt)} />
              </SettingsList>
            </Field>
          </div>
        </div>

        <SheetFooter className="flex-row items-center gap-2 border-t border-border px-6 py-4">
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onEdit?.(asset)}
          >
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button
            variant="outline"
            aria-label="Download asset"
            disabled={!hasFile}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => window.open(assetFileUrl(asset.id, { download: true }), "_blank")}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            aria-label="Duplicate asset"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onDuplicate?.(asset)}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="ml-auto text-red-400 hover:bg-red-500/10 hover:text-red-400"
            onClick={() => onDelete?.(asset)}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default AssetQuickViewSheet;
