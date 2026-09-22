"use client";

import React from "react";
import { Download, ExternalLink } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { SectionCard, StatusPill } from "@/components/internal/shared/screen_kit";
import { AssetPreview } from "@/components/internal/shared/asset_preview";
import { assetFileUrl } from "@/lib/storage/client";
import { STATUS_META, formatBytes, formatDate } from "../constants";

export function OverviewSection({ asset, relationships = [], versions = [] }) {
  if (!asset) return null;

  const hasFile = Boolean(asset.storageKey);
  const facts = [
    asset.format || asset.type,
    formatBytes(asset.sizeBytes),
    asset.dimensions,
    asset.folder,
  ].filter(Boolean);
  const counts = [
    `${(asset.downloads ?? 0).toLocaleString("en-US")} downloads`,
    `${versions.length} ${versions.length === 1 ? "version" : "versions"}`,
    `${relationships.length} ${relationships.length === 1 ? "link" : "links"}`,
    `Modified ${formatDate(asset.updatedAt)}`,
  ];

  return (
    <SectionCard bodyPadding={false}>
      <AssetPreview asset={asset} frameless />

      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
            <StatusPill status={asset.status} map={STATUS_META} className="text-[10px]" />
            {facts.map((fact) => (
              <React.Fragment key={fact}>
                <span aria-hidden className="text-text-tertiary">
                  ·
                </span>
                <span className="truncate">{fact}</span>
              </React.Fragment>
            ))}
          </div>
          <p className="text-xs text-text-secondary">{counts.join(" · ")}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasFile}
            className="h-8 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => window.open(assetFileUrl(asset.id), "_blank")}
          >
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Open file
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasFile}
            className="h-8 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => window.open(assetFileUrl(asset.id, { download: true }), "_blank")}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Download
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

export default OverviewSection;
