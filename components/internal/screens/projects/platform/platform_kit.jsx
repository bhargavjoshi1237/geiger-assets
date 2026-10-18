"use client";

// Presentational pieces shared by the Platform screens (Webhooks, Data Export,
// Integrations, API Keys, Delivery Settings, API Reference) so code blocks,
// detail sheets and callouts read the same on every one of them.

import React from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, Info } from "lucide-react";

import { Button } from "@geiger/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@geiger/ui/sheet";
import { SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { useCopied } from "@/lib/use-copied";
import { METHOD_BADGE_CLASS } from "./constants";

export const OUTLINE_BUTTON =
  "border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground";

export const PRIMARY_BUTTON = "bg-primary text-primary-foreground hover:bg-primary/90";

export function CopyButton({ value, label, className }) {
  const [copied, flashCopied] = useCopied(2000);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label || "Copy"}
      className={cn(
        "h-7 w-7 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground",
        className,
      )}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          flashCopied();
        } catch {
          toast.error("Couldn't copy.");
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

/** SegmentedTabs sized to sit level with FilterDropdown / search (36px). */
export function ToolbarTabs({ className, ...props }) {
  return <SegmentedTabs className={cn("p-[3px]", className)} buttonClassName="h-7" {...props} />;
}

/** Mono value on a field surface with a copy button — secrets, URLs, cURL. */
export function CodeBlock({ value, label, multiline = false, actions, className }) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border border-border bg-surface-card pl-3 pr-1.5",
        multiline ? "items-start py-2" : "items-center py-1",
        className,
      )}
    >
      {multiline ? (
        <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre py-0.5 font-mono text-xs leading-5 text-foreground">
          {value}
        </pre>
      ) : (
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{value}</code>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        {actions}
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}

export function MethodBadge({ method, className }) {
  return (
    <span
      className={cn(
        "inline-flex w-14 shrink-0 items-center justify-center rounded-md border py-0.5 font-mono text-[10px] font-semibold tracking-wide",
        METHOD_BADGE_CLASS[method] || "border-border bg-surface-card text-muted-foreground",
        className,
      )}
    >
      {method}
    </span>
  );
}

/** The bordered icon square that leads a table row or sheet header. */
export function IconTile({ icon: Icon, size = "md", className }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-border bg-surface-card text-text-secondary",
        size === "lg" ? "h-11 w-11 rounded-xl" : "h-9 w-9 rounded-lg",
        className,
      )}
    >
      <Icon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
    </div>
  );
}

/** Heading between page blocks (e.g. above a table that isn't in a card). */
export function SectionHeading({ title, description, action, className }) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-text-secondary">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

const NOTICE_TONES = {
  info: { icon: Info, box: "border-border bg-surface-card", iconClass: "text-text-secondary", text: "text-text-secondary" },
  warning: {
    icon: AlertTriangle,
    box: "border-amber-500/20 bg-amber-500/10",
    iconClass: "text-amber-700 dark:text-amber-400",
    text: "text-amber-800 dark:text-amber-200",
  },
};

export function Notice({ tone = "info", icon, children, className }) {
  const t = NOTICE_TONES[tone] || NOTICE_TONES.info;
  const Icon = icon || t.icon;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-5", t.box, className)}>
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", t.iconClass)} />
      <div className={cn("min-w-0", t.text)}>{children}</div>
    </div>
  );
}

/**
 * Right-hand detail panel: a pinned header (media + title + status), a
 * scrolling body of SheetSections, and a pinned action footer.
 */
export function DetailSheet({ open, onOpenChange, media, title, subtitle, meta, children, footer }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-l border-border bg-surface-subtle p-0 sm:max-w-md">
        <SheetHeader className="gap-3 border-b border-border p-6 pb-5">
          <div className="flex items-center gap-3 pr-6">
            {media}
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base leading-snug">{title}</SheetTitle>
              {subtitle ? (
                <SheetDescription className="truncate text-xs">{subtitle}</SheetDescription>
              ) : null}
            </div>
          </div>
          {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">{children}</div>
        {footer ? (
          <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t border-border px-6 py-4">
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function SheetSection({ title, action, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{title}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Label / value rows inside a sheet section. */
export function DetailList({ items }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border bg-surface-card">
      {items.filter(Boolean).map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
          <dt className="shrink-0 text-text-secondary">{label}</dt>
          <dd className="min-w-0 truncate text-right text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
