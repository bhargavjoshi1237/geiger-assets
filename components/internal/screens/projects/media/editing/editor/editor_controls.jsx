"use client";

import React from "react";
import { Ban } from "lucide-react";

import { Slider } from "@geiger/ui/slider";
import { Kbd } from "@geiger/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@geiger/ui/tooltip";
import { cn } from "@/lib/utils";

// Small building blocks shared by the editor's bars and panels. They follow
// the suite tokens but are denser than the screen kit — the editor is a tool
// surface, not a page.

export function BarDivider({ className }) {
  return <span aria-hidden className={cn("mx-1 h-5 w-px shrink-0 bg-border", className)} />;
}

export function Hint({ label, shortcut, side = "bottom", children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="flex items-center gap-2">
        {label}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

// Toolbar button. It doesn't take focus on mouse down, so editor shortcuts
// (Space to pan, arrows to nudge) keep working right after a click.
export const IconButton = React.forwardRef(function IconButton(
  { icon: Icon, label, active, className, size = "md", onMouseDown, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : Boolean(active)}
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown?.(e);
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        active
          ? "bg-surface-active text-foreground"
          : "text-text-secondary hover:bg-surface-hover hover:text-foreground",
        className,
      )}
      {...props}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
});

export function HintIconButton({ label, shortcut, side, ...props }) {
  return (
    <Hint label={label} shortcut={shortcut} side={side}>
      <IconButton label={label} {...props} />
    </Hint>
  );
}

export function PanelSection({ title, action, children, className }) {
  return (
    <section className={cn("border-b border-border px-4 py-3.5 last:border-b-0", className)}>
      {title || action ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title ? (
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">{title}</h3>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PanelLink({ className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "text-[11px] font-medium text-text-secondary transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

// Labelled slider; double-click the label or value to reset to `resetTo`.
export function SliderRow({ label, value, min, max, step = 1, unit = "", resetTo = 0, onChange, format }) {
  const shown = format ? format(value) : `${value > 0 && min < 0 ? "+" : ""}${value}${unit}`;
  return (
    <div className="grid gap-2" onDoubleClick={() => onChange(resetTo)}>
      <div className="flex items-center justify-between text-xs">
        <span className={cn("select-none", value !== resetTo ? "text-foreground" : "text-text-secondary")}>{label}</span>
        <span className="select-none font-mono tabular-nums text-text-secondary">{shown}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
        className="[&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1"
      />
    </div>
  );
}

// Swatch backed by the native color picker. `allowNone` adds a clear toggle.
export function ColorField({ label, value, onChange, allowNone = false, className }) {
  const empty = !value || value === "transparent";
  const hex = empty ? "" : toHexColor(value);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label className="relative flex h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border-strong bg-surface-card">
        <span
          aria-hidden
          className="absolute inset-0"
          style={empty ? undefined : { backgroundColor: value }}
        />
        {empty ? <Ban aria-hidden className="absolute inset-0 m-auto h-4 w-4 text-text-tertiary" /> : null}
        <input
          type="color"
          aria-label={label}
          value={hex || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <div className="min-w-0 flex-1">
        {label ? <p className="text-[11px] text-text-tertiary">{label}</p> : null}
        <p className="truncate font-mono text-xs uppercase text-foreground">{empty ? "None" : hex}</p>
      </div>
      {allowNone && !empty ? (
        <IconButton icon={Ban} label={`Remove ${label?.toLowerCase() || "color"}`} size="sm" onClick={() => onChange("")} />
      ) : null}
    </div>
  );
}

function toHexColor(value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value.slice(1).split("").map((c) => c + c).join("")}`.toLowerCase();
  }
  const m = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return `#${m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  return "#000000";
}

// Compact numeric input that commits on blur / Enter. Keyed by value at the
// call site so it re-seeds when the canvas changes it.
export function NumberField({ prefix, value, onCommit, min, max, suffix, className, label }) {
  const commit = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <label
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-card px-2 text-xs focus-within:border-border-strong",
        className,
      )}
    >
      {prefix ? <span className="w-3 shrink-0 select-none text-center text-text-tertiary">{prefix}</span> : null}
      <input
        key={value}
        aria-label={label || prefix}
        defaultValue={value}
        inputMode="decimal"
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = String(value);
            e.currentTarget.blur();
          }
        }}
        className="min-w-0 flex-1 bg-transparent font-mono tabular-nums text-foreground outline-none"
      />
      {suffix ? <span className="shrink-0 select-none text-text-tertiary">{suffix}</span> : null}
    </label>
  );
}

// Segmented icon/label group for small inline choices (align, shape kind…).
export function ChoiceGroup({ options, value, onChange, className, size = "sm" }) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-card p-0.5", className)}>
      {options.map((o) => {
        const Icon = o.icon;
        const active = value === o.value;
        const button = (
          <button
            key={o.value}
            type="button"
            aria-label={o.label}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
              size === "sm" ? "h-7 min-w-7 px-1.5" : "h-8 min-w-8 px-2.5",
              active ? "bg-surface-hover text-foreground shadow-sm" : "text-text-secondary hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {o.showLabel || !Icon ? o.label : null}
          </button>
        );
        return Icon && !o.showLabel ? (
          <Hint key={o.value} label={o.label}>
            {button}
          </Hint>
        ) : (
          button
        );
      })}
    </div>
  );
}
