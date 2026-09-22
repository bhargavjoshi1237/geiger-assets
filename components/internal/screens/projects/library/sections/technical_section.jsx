"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { SectionCard, Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { STORAGE_STATUS_META, formatBytes, formatDateTime } from "../constants";
import { useCopied } from "@/lib/use-copied";

function DetailRow({ label, value, mono = false, copyable = false }) {
  const [copied, flashCopied] = useCopied(2000);
  const text = value == null || value === "" ? "" : String(value);

  const copy = () => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    flashCopied();
  };

  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="w-40 shrink-0 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 break-all text-sm text-foreground",
          mono && "font-mono text-xs",
        )}
      >
        {text || <span className="text-text-tertiary">—</span>}
      </span>
      {copyable && text ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Copy ${label}`}
          className="h-6 w-6 shrink-0 text-text-tertiary hover:bg-surface-active hover:text-foreground"
          onClick={copy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      ) : null}
    </div>
  );
}

export function TechnicalSection({ asset, onPatch }) {
  if (!asset) return null;
  const patch = onPatch || (() => {});
  const storage = STORAGE_STATUS_META[asset.storageStatus] || STORAGE_STATUS_META.none;

  return (
    <div className="space-y-4">
      <SectionCard title="File" description="What was uploaded, as the pipeline recorded it.">
        <div className="divide-y divide-border">
          <DetailRow label="Original filename" value={asset.originalFilename} />
          <DetailRow label="MIME type" value={asset.mimeType} mono />
          <DetailRow label="Format" value={asset.format || asset.type} />
          <DetailRow label="Dimensions" value={asset.dimensions} />
          <DetailRow label="Size" value={formatBytes(asset.sizeBytes)} />
        </div>
      </SectionCard>

      <SectionCard title="Storage" description="Where the object lives and whether it landed.">
        <div className="divide-y divide-border">
          <div className="flex items-center gap-3 py-2.5">
            <span className="w-40 shrink-0 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              Status
            </span>
            <Badge className={cn("border px-1.5 py-0 text-[10px]", storage.className)}>
              {storage.label}
            </Badge>
          </div>
          <DetailRow label="Bucket" value={asset.storageBucket} mono />
          <DetailRow label="Object key" value={asset.storageKey} mono copyable />
          <DetailRow label="Checksum" value={asset.checksum} mono copyable />
          <DetailRow label="ETag" value={asset.etag} mono copyable />
        </div>
      </SectionCard>

      <SectionCard title="Record" description="Identity and audit trail for this row.">
        <div className="divide-y divide-border">
          <DetailRow label="Asset ID" value={asset.id} mono copyable />
          <DetailRow label="Project ID" value={asset.projectId} mono copyable />
          <DetailRow label="Created by" value={asset.createdBy} mono />
          <DetailRow label="Created" value={formatDateTime(asset.createdAt)} />
          <DetailRow label="Last modified" value={formatDateTime(asset.updatedAt)} />
          <DetailRow
            label="Downloads"
            value={(asset.downloads ?? 0).toLocaleString("en-US")}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Appearance"
        description="The accent colour behind this asset's type glyph across the library."
      >
        <Field label="Accent colour" htmlFor="asset-color">
          <div className="flex items-center gap-3">
            <input
              id="asset-color"
              type="color"
              value={asset.color || "#737373"}
              onChange={(e) => patch({ color: e.target.value })}
              className="h-9 w-14 cursor-pointer rounded-md border border-border bg-surface-card p-1"
            />
            <span className="font-mono text-xs uppercase text-text-secondary">
              {asset.color || "#737373"}
            </span>
          </div>
        </Field>
      </SectionCard>
    </div>
  );
}

export default TechnicalSection;
