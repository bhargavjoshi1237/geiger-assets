"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Package } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
import { Input } from "@geiger/ui/input";
import { cn } from "@/lib/utils";
import {
  CreateDialog,
  FieldRow,
  FormSection,
  TextAreaField,
  TextField,
} from "@/components/internal/shared/module_kit";
import {
  PRODUCT_KIND_META,
  centsToDollarString,
  formatMoney,
  fulfillmentSummary,
  parseDollarsToCents,
} from "./constants";

function draftFrom(sheet) {
  return {
    name: sheet?.name || "",
    description: sheet?.description || "",
    lines: (sheet?.lines || []).map((l) => ({
      productId: l.productId,
      price: l.priceCents === null ? "" : centsToDollarString(l.priceCents),
    })),
  };
}

/**
 * Build a price sheet: pick the products a gallery sells, their order on the
 * buy panel, and an optional sheet price per product (blank = the product's
 * own price).
 */
export function PriceSheetDialog({ open, onOpenChange, sheet, products, onSubmit }) {
  const [draft, setDraft] = useState(() => draftFrom(sheet));

  // Re-seed the form each time the dialog opens.
  const openedFor = open ? sheet?.id || "new" : null;
  const [seededFor, setSeededFor] = useState(openedFor);
  if (openedFor !== seededFor) {
    setSeededFor(openedFor);
    if (openedFor) setDraft(draftFrom(sheet));
  }

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const included = new Set(draft.lines.map((l) => l.productId));
  const available = products.filter((p) => p.status !== "archived" && !included.has(p.id));

  const setLines = (fn) => setDraft((d) => ({ ...d, lines: fn(d.lines) }));
  const toggle = (id) =>
    setLines((lines) =>
      lines.some((l) => l.productId === id) ? lines.filter((l) => l.productId !== id) : [...lines, { productId: id, price: "" }],
    );
  const setPrice = (id, price) => setLines((lines) => lines.map((l) => (l.productId === id ? { ...l, price } : l)));
  const move = (index, delta) =>
    setLines((lines) => {
      const next = [...lines];
      const target = index + delta;
      if (target < 0 || target >= next.length) return lines;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const submit = () => {
    if (!draft.name.trim()) return toast.error("Give the price sheet a name");
    if (!draft.lines.length) return toast.error("Add at least one product");
    onSubmit({
      name: draft.name.trim(),
      description: draft.description.trim(),
      lines: draft.lines.map((l, position) => ({
        productId: l.productId,
        priceCents: l.price === "" ? null : parseDollarsToCents(l.price),
        position,
      })),
    });
  };

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={sheet ? "Edit price sheet" : "New price sheet"}
      description="A reusable menu of products. Galleries pick a sheet, then override single assets if they need to."
      submitLabel={sheet ? "Save sheet" : "Create sheet"}
      size="xl"
      onSubmit={submit}
      footerNote={`${draft.lines.length} product${draft.lines.length === 1 ? "" : "s"} on this sheet`}
    >
      <FormSection title="Sheet">
        <FieldRow>
          <TextField label="Name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="e.g. Editorial pricing 2026" />
        </FieldRow>
        <TextAreaField
          label="Description"
          value={draft.description}
          onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
          rows={2}
          placeholder="Internal — which galleries this is for."
        />
      </FormSection>

      <FormSection title="On this sheet" description="In the order buyers see them. Leave a price blank to use the product's own.">
        {draft.lines.length ? (
          <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
            {draft.lines.map((line, index) => {
              const product = productById.get(line.productId);
              if (!product) return null;
              const meta = PRODUCT_KIND_META[product.kind];
              const Icon = meta?.icon || Package;
              return (
                <div key={line.productId} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-text-secondary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{product.name}</p>
                    <p className="truncate text-[11px] text-text-tertiary">{fulfillmentSummary(product)}</p>
                  </div>
                  <div className="flex w-28 shrink-0 items-center gap-1 rounded-md border border-border bg-surface-subtle pl-2">
                    <span className="text-xs text-text-tertiary">$</span>
                    <Input
                      value={line.price}
                      onChange={(e) => setPrice(line.productId, e.target.value)}
                      placeholder={centsToDollarString(product.priceCents)}
                      inputMode="decimal"
                      aria-label={`Sheet price for ${product.name}`}
                      className="h-8 border-0 bg-transparent px-1 text-xs focus-visible:ring-0"
                    />
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0} className="h-7 w-7 text-text-secondary" onClick={() => move(index, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === draft.lines.length - 1} className="h-7 w-7 text-text-secondary" onClick={() => move(index, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Checkbox checked onCheckedChange={() => toggle(line.productId)} aria-label={`Remove ${product.name}`} className="ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-text-tertiary">
            Nothing yet — tick products below to add them.
          </p>
        )}
      </FormSection>

      <FormSection title="Add products">
        {available.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((product) => {
              const meta = PRODUCT_KIND_META[product.kind];
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggle(product.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2 text-left transition-colors hover:bg-surface-hover",
                  )}
                >
                  <Checkbox checked={false} tabIndex={-1} aria-hidden className="pointer-events-none" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{product.name}</p>
                    <p className="truncate text-[11px] text-text-tertiary">
                      {meta?.short} · {formatMoney(product.priceCents)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">
            {products.length ? "Every active product is already on this sheet." : "Create products first, then add them here."}
          </p>
        )}
      </FormSection>
    </CreateDialog>
  );
}

export default PriceSheetDialog;
