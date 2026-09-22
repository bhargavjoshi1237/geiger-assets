"use client";

// Licensing-specific UI pieces shared across the six screens: the multi-select
// option picker used for territories/channels/assets, scope chip rows, the
// toolbar CSV export button, and the conflict/coverage warning banner. Built from
// @geiger/ui primitives so these match every other form control in the suite.

import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, Download, Info, Plus, Search, X } from "lucide-react";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { ScrollArea } from "@geiger/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@geiger/ui/toggle-group";
import { Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { exportRowsToCsv } from "@/lib/csv";

// Long option lists get a filter box and a scroll frame instead of an endless grid.
const SEARCH_THRESHOLD = 14;

/**
 * Multi-select option picker — territories, channels, assets, anything from a
 * fixed list. A header line carries the selection count and bulk actions, so the
 * control answers "how many did I pick?" without counting pills.
 */
export function ChipSelect({
  label,
  hint,
  options,
  values,
  onChange,
  emptyHint = "Nothing selected yet.",
  searchPlaceholder = "Filter options…",
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(values || []), [values]);
  const searchable = options.length > SEARCH_THRESHOLD;

  const shown = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const allSelected = options.length > 0 && options.every((o) => selected.has(o.value));

  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-text-tertiary">
            {selected.size ? `${selected.size} selected` : emptyHint}
          </span>
          <div className="flex items-center gap-1">
            {options.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] text-text-secondary hover:bg-surface-active hover:text-foreground"
                onClick={() => onChange(allSelected ? [] : options.map((o) => o.value))}
              >
                {allSelected ? "None" : "All"}
              </Button>
            ) : null}
            {selected.size ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] text-text-secondary hover:bg-surface-active hover:text-foreground"
                onClick={() => onChange([])}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {searchable ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-xs"
            />
          </div>
        ) : null}

        <OptionGroup options={shown} values={values} onChange={onChange} scroll={searchable} />
      </div>
    </Field>
  );
}

function OptionGroup({ options, values, onChange, scroll }) {
  const selected = new Set(values || []);
  const group = (
    <ToggleGroup
      type="multiple"
      value={values || []}
      onValueChange={onChange}
      variant="outline"
      spacing={1.5}
      className="w-full flex-wrap justify-start"
    >
      {options.map((option) => {
        const active = selected.has(option.value);
        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.label}
            size="sm"
            className="max-w-full gap-1.5 bg-surface-card text-xs data-[state=on]:border-border-strong"
          >
            <span className="truncate">{option.label}</span>
            {active ? <Check className="h-3 w-3 text-emerald-400" /> : null}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );

  if (!options.length) {
    return (
      <p className="rounded-lg border border-border bg-surface-card px-3 py-4 text-center text-xs text-text-tertiary">
        No options match that filter.
      </p>
    );
  }

  if (!scroll) return group;

  return (
    <ScrollArea className="max-h-44 rounded-lg border border-border bg-surface-card">
      <div className="p-2">{group}</div>
    </ScrollArea>
  );
}

// Free-text list builder — restrictions, perks, anything open-ended.
export function TagListField({ label, hint, values, onChange, placeholder = "Add an item…" }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!(values || []).includes(value)) onChange([...(values || []), value]);
    setDraft("");
  };
  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Add ${label || "item"}`}
            className="h-10 w-10 shrink-0 border-border bg-surface-card hover:bg-surface-hover"
            onClick={add}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {values?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {values.map((value) => (
              <Badge key={value} variant="outline" className="gap-0.5 py-1 pr-1 pl-2">
                <span className="max-w-[16rem] truncate">{value}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${value}`}
                  className="h-4 w-4 text-text-tertiary hover:bg-surface-active hover:text-foreground"
                  onClick={() => onChange(values.filter((v) => v !== value))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-text-tertiary">Nothing added yet.</p>
        )}
      </div>
    </Field>
  );
}

// A compact chip row for table cells — shows the first few, then "+n".
export function ScopeChips({ values, max = 2, empty = "—", variant = "outline" }) {
  if (!values?.length) return <span className="text-text-tertiary">{empty}</span>;
  const shown = values.slice(0, max);
  const rest = values.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((value) => (
        <Badge key={value} variant={variant} className="max-w-[10rem] truncate">
          {value}
        </Badge>
      ))}
      {rest > 0 ? (
        <Badge variant="neutral" className="text-[10px]">
          +{rest}
        </Badge>
      ) : null}
    </span>
  );
}

export function ExportButton({ filename, rows, columns, label = "Export" }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 border-border bg-surface-card px-2.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-foreground"
      onClick={() => exportRowsToCsv(filename, rows, columns)}
      disabled={!rows?.length}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

// Conflict + coverage findings from conflicts.js, rendered as an inline banner.
export function FindingsBanner({ findings, className, title = "Review before issuing" }) {
  if (!findings?.length) return null;
  const blocking = findings.some((f) => f.level === "conflict");
  const Icon = blocking ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        blocking ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", blocking ? "text-red-400" : "text-amber-400")} />
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">
            {title} · {findings.length} finding{findings.length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-1">
            {findings.map((finding, i) => (
              <li key={`${finding.title}-${i}`} className="text-[11px] leading-relaxed text-text-secondary">
                <span className={cn("font-medium", finding.level === "conflict" ? "text-red-400" : "text-amber-400")}>
                  {finding.title}
                </span>
                {finding.detail ? ` — ${finding.detail}` : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Label/value row for detail panels and the certificate.
export function DetailRow({ label, value, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2", className)}>
      <span className="shrink-0 text-xs text-text-tertiary">{label}</span>
      <span className="min-w-0 text-right text-xs font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}
