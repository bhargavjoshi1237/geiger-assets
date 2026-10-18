"use client";

// Licensing-specific UI pieces shared across the six screens: the multi-select
// option pickers used for territories/channels/assets, scope chip rows, the
// toolbar CSV export button, and the conflict/coverage warning banner. Built from
// @geiger/ui primitives so these match every other form control in the suite.

import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Download, Info, Plus, Search, X } from "lucide-react";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@geiger/ui/popover";
import { ScrollArea } from "@geiger/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@geiger/ui/toggle-group";
import { Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { exportRowsToCsv } from "@/lib/csv";

// Long option lists get a filter box and a scroll frame instead of an endless
// grid. Short ones don't — a search field over nine items is pure noise.
const SEARCH_THRESHOLD = 14;

// How many picks MultiSelect names on its trigger before falling back to "+N".
const SUMMARY_LIMIT = 2;

// Bulk actions live inside a field, so they stay deliberately quieter than any
// real action in the dialog — text until you reach for them.
const MICRO_BUTTON =
  "h-6 rounded-md px-2 text-[11px] font-medium text-text-secondary hover:bg-surface-active hover:text-foreground";

/**
 * The line both pickers put above their options: how many are picked on the
 * left, bulk actions on the right. "Select all" flips to "Clear all" once
 * everything is on, so the pair never shows two competing buttons.
 */
function SelectionHeader({ count, total, emptyHint, allSelected, onToggleAll, onClear, className }) {
  return (
    <div className={cn("flex min-h-6 items-center justify-between gap-2", className)}>
      <span className="truncate text-xs text-text-tertiary">
        {count ? `${count} of ${total} selected` : emptyHint}
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
        {count && !allSelected ? (
          <Button type="button" variant="ghost" size="sm" className={MICRO_BUTTON} onClick={onClear}>
            Clear
          </Button>
        ) : null}
        {total > 1 ? (
          <Button type="button" variant="ghost" size="sm" className={MICRO_BUTTON} onClick={onToggleAll}>
            {allSelected ? "Clear all" : "Select all"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// Shared filter box. The input reserves the icon gutter with a plain pl-9, so
// the placeholder never sits under the magnifier.
function OptionFilter({ value, onChange, placeholder, label, flush }) {
  return (
    <div className={cn("relative", flush && "border-b border-border")}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={`Filter ${label || "options"}`}
        className={cn(
          "pl-9 text-sm",
          flush && "!rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0",
        )}
      />
    </div>
  );
}

// Arrow-key movement between option rows. Focus starting outside the list (the
// filter box) enters it at the near end.
function moveOptionFocus(event) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = Array.from(event.currentTarget.querySelectorAll("[data-option]"));
  if (!items.length) return;
  event.preventDefault();
  const at = items.indexOf(document.activeElement);
  const next =
    event.key === "ArrowDown"
      ? (at + 1) % items.length
      : at <= 0
        ? items.length - 1
        : at - 1;
  items[next]?.focus();
}

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
        <SelectionHeader
          count={selected.size}
          total={options.length}
          emptyHint={emptyHint}
          allSelected={allSelected}
          onToggleAll={() => onChange(allSelected ? [] : options.map((o) => o.value))}
          onClear={() => onChange([])}
        />

        {searchable ? (
          <OptionFilter value={query} onChange={setQuery} placeholder={searchPlaceholder} label={label} />
        ) : null}

        <OptionGroup options={shown} values={values} onChange={onChange} scroll={searchable} />
      </div>
    </Field>
  );
}

function OptionGroup({ options, values, onChange, scroll }) {
  const selected = new Set(values || []);

  if (!options.length) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface-card px-3 py-5 text-center text-xs text-text-tertiary">
        No options match that filter.
      </p>
    );
  }

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
            className="h-8 max-w-full gap-1.5 rounded-lg border-border bg-surface-card px-2.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <span className="truncate">{option.label}</span>
            {active ? <Check className="size-3 shrink-0" /> : null}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );

  if (!scroll) return group;

  return (
    <ScrollArea className="max-h-44 rounded-lg border border-border bg-surface-card">
      <div className="p-2">{group}</div>
    </ScrollArea>
  );
}

/**
 * Dropdown flavour of the picker above — same props, so call sites swap one name.
 * The trigger keeps a Select's height and shows the first couple of picks as
 * chips before counting the rest, so a wide grant reads as one line instead of a
 * wall of pills.
 */
export function MultiSelect({
  label,
  hint,
  options,
  values,
  onChange,
  emptyHint = "Nothing selected yet.",
  placeholder = "Select…",
  searchPlaceholder = "Filter options…",
}) {
  const triggerId = React.useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(values || []), [values]);
  const searchable = options.length > SEARCH_THRESHOLD;

  const shown = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Name what fits, count the rest — the trigger never outgrows its one line.
  const picked = useMemo(() => options.filter((o) => selected.has(o.value)), [options, selected]);
  const overflow = picked.length - SUMMARY_LIMIT;

  const allSelected = options.length > 0 && options.every((o) => selected.has(o.value));

  const toggle = (value) => {
    const current = values || [];
    onChange(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  return (
    <Field label={label} hint={hint} htmlFor={triggerId}>
      {/* modal: the picker opens inside a dialog, whose focus trap would otherwise
          starve the portalled filter box of keystrokes. */}
      <Popover
        modal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            id={triggerId}
            type="button"
            className="group flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface-card px-3 text-sm text-foreground outline-none transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:border-border-strong focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:border-border-strong data-[state=open]:bg-surface-hover"
          >
            {picked.length ? (
              <span className="flex min-w-0 items-center gap-1.5">
                {picked.slice(0, SUMMARY_LIMIT).map((option) => (
                  <Badge
                    key={option.value}
                    variant="outline"
                    className="max-w-[9rem] bg-surface-subtle text-foreground"
                  >
                    <span className="truncate">{option.label}</span>
                  </Badge>
                ))}
                {overflow > 0 ? (
                  <Badge variant="neutral" className="shrink-0">
                    +{overflow}
                  </Badge>
                ) : null}
              </span>
            ) : (
              <span className="truncate text-text-tertiary">{placeholder}</span>
            )}
            <ChevronDown className="size-4 shrink-0 text-text-secondary transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </button>
        </PopoverTrigger>

        {/* Capped to the room Radix reports it has, so a long list scrolls inside
            the panel instead of running off the bottom of the dialog. */}
        <PopoverContent
          align="start"
          sideOffset={6}
          onKeyDown={moveOptionFocus}
          className="flex max-h-[min(22rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] min-w-64 flex-col overflow-hidden rounded-lg border-border-strong p-0 shadow-lg shadow-black/10 dark:shadow-black/60"
        >
          {searchable ? (
            <OptionFilter
              value={query}
              onChange={setQuery}
              placeholder={searchPlaceholder}
              label={label}
              flush
            />
          ) : null}

          <SelectionHeader
            count={selected.size}
            total={options.length}
            emptyHint={emptyHint}
            allSelected={allSelected}
            onToggleAll={() => onChange(allSelected ? [] : options.map((o) => o.value))}
            onClear={() => onChange([])}
            className="border-b border-border px-3 py-2"
          />

          {shown.length ? (
            <ScrollArea className="min-h-0 flex-1">
              <div role="listbox" aria-multiselectable="true" aria-label={label} className="p-1.5">
                {shown.map((option) => {
                  const active = selected.has(option.value);
                  return (
                    <button
                      key={option.value}
                      data-option=""
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => toggle(option.value)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-surface-hover focus:bg-surface-hover",
                        active ? "font-medium text-foreground" : "text-text-secondary",
                      )}
                    >
                      {/* A painted box, not the Checkbox primitive — that renders
                          a <button>, and one can't sit inside this row's button. */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border-strong text-transparent",
                        )}
                      >
                        <Check className="size-3" />
                      </span>
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <p className="px-3 py-6 text-center text-xs text-text-tertiary">
              No options match that filter.
            </p>
          )}
        </PopoverContent>
      </Popover>
    </Field>
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
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", blocking ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400")} />
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">
            {title} · {findings.length} finding{findings.length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-1">
            {findings.map((finding, i) => (
              <li key={`${finding.title}-${i}`} className="text-[11px] leading-relaxed text-text-secondary">
                <span className={cn("font-medium", finding.level === "conflict" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
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
