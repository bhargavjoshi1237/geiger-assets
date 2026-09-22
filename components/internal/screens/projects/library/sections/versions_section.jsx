"use client";

import React, { useRef } from "react";
import { Check, History, Loader2, RotateCcw, Upload } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { EmptyState, SectionCard } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { UPLOAD_PHASE_LABELS } from "@/lib/storage/client";
import { formatBytes, formatDate } from "../constants";

export function VersionsSection({
  versions = [],
  onRestore,
  onReplace,
  replacing = false,
  replaceProgress = 0,
  replacePhase = "",
}) {
  const inputRef = useRef(null);

  const pick = (e) => {
    const file = e.target.files?.[0];

    e.target.value = "";
    if (file) onReplace?.(file);
  };

  return (
    <SectionCard
      title="Version Control"
      description="An inspectable history of every revision."
      action={
        onReplace ? (
          <Button
            variant="outline"
            size="sm"
            disabled={replacing}
            className="h-7 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => inputRef.current?.click()}
          >
            {replacing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1 h-3.5 w-3.5" />
            )}
            Replace file
          </Button>
        ) : null
      }
      bodyPadding={false}
    >
      <input ref={inputRef} type="file" className="hidden" onChange={pick} />

      {replacing ? (
        <div className="flex items-center gap-2 border-b border-border bg-surface-card/40 px-4 py-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-card">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(0, Math.min(100, replaceProgress || 0))}%` }}
            />
          </div>
          <span className="whitespace-nowrap tabular-nums text-[11px] text-text-secondary">
            {replacePhase || UPLOAD_PHASE_LABELS.uploading}{" "}
            {Math.max(0, Math.min(100, Math.round(replaceProgress || 0)))}%
          </span>
        </div>
      ) : null}

      {versions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No versions yet"
          description="Replacing the file will start the version history."
          className="py-10"
        />
      ) : (
        <div className="divide-y divide-border">
          {versions.map((v) => (
            <div key={v.id} className="group flex items-center gap-3 px-4 py-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums",
                  v.isCurrent
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-border bg-surface-card text-text-secondary",
                )}
              >
                v{v.versionNumber}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {v.label || `Version ${v.versionNumber}`}
                  </p>
                  {v.isCurrent ? (
                    <Badge className="border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-300">
                      <Check className="h-2.5 w-2.5" />
                      Current
                    </Badge>
                  ) : null}
                </div>
                <p className="text-[11px] text-text-tertiary">
                  {v.sizeBytes != null ? formatBytes(v.sizeBytes) : "—"}
                  {v.createdAt ? ` · ${formatDate(v.createdAt)}` : ""}
                </p>
              </div>
              {!v.isCurrent ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 text-xs text-text-secondary opacity-0 transition-opacity hover:bg-surface-active hover:text-foreground group-hover:opacity-100"
                  onClick={() => onRestore?.(v.id)}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Restore
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export default VersionsSection;
