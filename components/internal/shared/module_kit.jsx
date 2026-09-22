"use client";

// Generic screen-module primitives — the dialog shell, form fields, row-action
// menu, clear-filters button and fetch-on-mount hook that every list screen in a
// feature area needs. Everything here is built from @geiger/ui components so a
// dialog in one area looks and scales exactly like a dialog in another.

import React, { useEffect, useState } from "react";
import { CalendarIcon, Pencil, Trash2, X } from "lucide-react";
import { ActionMenu } from "@geiger/ui/action-menu";
import { Button } from "@geiger/ui/button";
import { DatePicker } from "@geiger/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Input } from "@geiger/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@geiger/ui/popover";
import { ScrollArea } from "@geiger/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { Separator } from "@geiger/ui/separator";
import { Textarea } from "@geiger/ui/textarea";
import { Field } from "@/components/internal/shared/screen_kit";
import { FilterDropdown } from "@/components/internal/shared/filter_dropdown";
import { cn } from "@/lib/utils";

export { FilterDropdown };

export function RowActions({ onEdit, onDelete, editLabel = "Edit", editIcon = Pencil, deleteLabel = "Delete", extra }) {
  return (
    <ActionMenu
      label="Row actions"
      items={[
        ...(extra || []),
        ...(onEdit ? [{ icon: editIcon, label: editLabel, onSelect: onEdit }] : []),
        ...(onDelete ? [{ separator: true }, { icon: Trash2, label: deleteLabel, destructive: true, onSelect: onDelete }] : []),
      ]}
    />
  );
}

export function ClearFiltersButton({ onClick }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
      onClick={onClick}
    >
      <X className="mr-1 h-3 w-3" />
      Clear
    </Button>
  );
}

// Fetch-on-mount for a list screen: starts empty + loading, never seeds static
// rows, and hands back the setter so mutations can stay optimistic.
export function useModuleRows(listFn, projectId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    listFn(projectId).then((result) => {
      if (!alive) return;
      setRows(result ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  return [rows, setRows, loading];
}

// Dialog widths. Every size stays inside the viewport on a phone and grows to a
// comfortable reading measure on a desktop — no fixed max-w that overflows.
const DIALOG_SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
};

/**
 * The suite's form dialog: header and footer are pinned, only the fields scroll,
 * and the whole thing is capped to the viewport so a long form never runs off
 * the screen or pushes its actions out of reach.
 */
export function CreateDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Create",
  submitDisabled = false,
  size,
  wide,
  footerNote,
}) {
  const width = DIALOG_SIZES[size] || (wide ? DIALOG_SIZES.lg : DIALOG_SIZES.md);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
          width,
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Separator />
        <ScrollArea className="min-h-0">
          <div className="grid gap-5 px-6 py-5">{children}</div>
        </ScrollArea>
        <Separator />
        <DialogFooter className="items-center gap-3 px-6 py-4 sm:justify-between">
          <p className="hidden text-xs text-text-tertiary sm:block">{footerNote}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button
              variant="ghost"
              className="text-xs text-muted-foreground hover:bg-surface-active"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={onSubmit}
              disabled={submitDisabled}
            >
              {submitLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditDialog({ open, onOpenChange, title, children, onSave, size, wide }) {
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      submitLabel="Save changes"
      onSubmit={onSave}
      size={size}
      wide={wide}
    >
      {children}
    </CreateDialog>
  );
}

// Groups related fields inside a long dialog, so a twenty-field form reads as
// four short ones.
export function FormSection({ title, description, children, className }) {
  return (
    <section className={cn("space-y-3", className)}>
      {title ? (
        <div className="space-y-0.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{title}</h4>
          {description ? <p className="text-xs text-text-secondary">{description}</p> : null}
        </div>
      ) : null}
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

// Side-by-side fields that stack on narrow viewports.
export function FieldRow({ columns = 2, children, className }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 3 ? "sm:grid-cols-3" : columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, hint, type, inputMode, prefix }) {
  return (
    <Field label={label} hint={hint}>
      {prefix ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-card pl-3 focus-within:border-border-strong">
          <span className="shrink-0 text-sm text-text-tertiary">{prefix}</span>
          <Input
            type={type}
            inputMode={inputMode}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="border-0 bg-transparent px-0 focus-visible:ring-0"
          />
        </div>
      ) : (
        <Input
          type={type}
          inputMode={inputMode}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </Field>
  );
}

// Money in, cents out at the call site — the prefix keeps the unit obvious
// without spending a label on it.
export function MoneyField({ label, value, onChange, placeholder = "0.00", hint }) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      hint={hint}
      inputMode="decimal"
      prefix="$"
    />
  );
}

export function TextAreaField({ label, value, onChange, placeholder, hint, rows = 4 }) {
  return (
    <Field label={label} hint={hint}>
      <Textarea
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="resize-y bg-surface-card"
      />
    </Field>
  );
}

// Radix Select rejects an empty-string item value, but "unassigned" options are
// everywhere in these forms — so an empty value travels as a sentinel inside the
// control and comes back out empty.
const NONE = "__none__";

export function SelectField({ label, value, onChange, options, placeholder, hint, disabled }) {
  return (
    <Field label={label} hint={hint}>
      <Select
        value={value === "" || value == null ? NONE : String(value)}
        onValueChange={(next) => onChange(next === NONE ? "" : next)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {(options || []).map((option) => (
            <SelectItem key={String(option.value)} value={option.value === "" ? NONE : String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// "YYYY-MM-DD" ⇄ Date, parsed as a local date so the calendar never lands a day
// off in a negative-offset timezone.
function parseDay(value) {
  if (!value) return undefined;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// The month/year dropdowns need explicit bounds, and these forms carry both
// archival dates and forward terms — so give them a generous window either side.
const DROPDOWN_RANGE = {
  start: new Date(new Date().getFullYear() - 30, 0, 1),
  end: new Date(new Date().getFullYear() + 30, 11, 31),
};

function formatDay(date) {
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function DateField({ label, value, onChange, hint, placeholder = "Pick a date", disabled, clearable = true }) {
  const [open, setOpen] = useState(false);
  const selected = parseDay(value);

  return (
    <Field label={label} hint={hint}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-start gap-2 border-border bg-surface-card px-3 font-normal hover:bg-surface-hover",
              !selected && "text-text-tertiary",
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-text-secondary" />
            <span className="truncate">
              {selected
                ? selected.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <DatePicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              onChange(formatDay(date));
              setOpen(false);
            }}
            captionLayout="dropdown"
            startMonth={DROPDOWN_RANGE.start}
            endMonth={DROPDOWN_RANGE.end}
          />
          {clearable && selected ? (
            <>
              <Separator />
              <div className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  Clear date
                </Button>
              </div>
            </>
          ) : null}
        </PopoverContent>
      </Popover>
    </Field>
  );
}
