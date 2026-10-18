"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Field } from "@/components/internal/shared/screen_kit";
import {
  CreateDialog,
  DateField,
  FieldRow,
  FormSection,
  MoneyField,
  SelectField,
  TextField,
} from "@/components/internal/shared/module_kit";
import {
  DISCOUNT_STATUS_META,
  centsToDollarString,
  optionsFromMeta,
  parseDollarsToCents,
} from "./constants";

const STATUS_OPTIONS = optionsFromMeta(DISCOUNT_STATUS_META);
const KIND_OPTIONS = [
  { value: "percent", label: "Percentage off" },
  { value: "fixed", label: "Fixed amount off" },
];

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function draftFrom(d) {
  return {
    code: d?.code || "",
    description: d?.description || "",
    kind: d?.kind || "percent",
    value: d ? (d.kind === "fixed" ? centsToDollarString(d.value) : String(d.value)) : "10",
    minSubtotal: d?.minSubtotalCents ? centsToDollarString(d.minSubtotalCents) : "",
    maxRedemptions: d?.maxRedemptions ? String(d.maxRedemptions) : "",
    galleryId: d?.galleryId || "",
    startsAt: d?.startsAt ? String(d.startsAt).slice(0, 10) : "",
    endsAt: d?.endsAt ? String(d.endsAt).slice(0, 10) : "",
    status: d?.status || "active",
  };
}

export function DiscountDialog({ open, onOpenChange, discount, galleries, existingCodes, onSubmit }) {
  const [draft, setDraft] = useState(() => draftFrom(discount));
  const openedFor = open ? discount?.id || "new" : null;
  const [seededFor, setSeededFor] = useState(openedFor);
  if (openedFor !== seededFor) {
    setSeededFor(openedFor);
    if (openedFor) setDraft(draftFrom(discount));
  }
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    const code = draft.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return toast.error("Codes are 3–32 letters, numbers, - or _");
    if (existingCodes.has(code) && code !== discount?.code) return toast.error("That code already exists");
    const value = draft.kind === "fixed" ? parseDollarsToCents(draft.value) : Math.round(Number(draft.value) || 0);
    if (!(value > 0)) return toast.error("Enter the discount amount");
    if (draft.kind === "percent" && value > 100) return toast.error("A percentage can't be over 100");
    if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt) return toast.error("The end date is before the start");
    onSubmit({
      code,
      description: draft.description.trim(),
      kind: draft.kind,
      value,
      minSubtotalCents: draft.minSubtotal ? parseDollarsToCents(draft.minSubtotal) : 0,
      maxRedemptions: Number(draft.maxRedemptions) || 0,
      galleryId: draft.galleryId || null,
      startsAt: draft.startsAt ? new Date(`${draft.startsAt}T00:00:00`).toISOString() : null,
      endsAt: draft.endsAt ? new Date(`${draft.endsAt}T23:59:59`).toISOString() : null,
      status: draft.status,
    });
  };

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={discount ? "Edit discount code" : "New discount code"}
      description="Buyers enter the code in the cart. It's checked again at checkout, so an expired or used-up code never applies."
      submitLabel={discount ? "Save code" : "Create code"}
      wide
      onSubmit={submit}
    >
      <FormSection title="Code">
        <FieldRow>
          <Field label="Code">
            <div className="flex items-center gap-2">
              <Input
                value={draft.code}
                onChange={(e) => set("code")(e.target.value.toUpperCase())}
                placeholder="SPRING20"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Generate a random code"
                title="Generate a random code"
                className="shrink-0 border-border bg-surface-card"
                onClick={() => set("code")(randomCode())}
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          </Field>
          <SelectField label="Status" value={draft.status} onChange={set("status")} options={STATUS_OPTIONS} />
        </FieldRow>
        <TextField label="Description" value={draft.description} onChange={set("description")} placeholder="Internal — e.g. Spring newsletter" />
      </FormSection>

      <FormSection title="Discount">
        <FieldRow>
          <SelectField label="Type" value={draft.kind} onChange={set("kind")} options={KIND_OPTIONS} />
          {draft.kind === "fixed" ? (
            <MoneyField label="Amount off" value={draft.value} onChange={set("value")} />
          ) : (
            <TextField label="Percent off" value={draft.value} onChange={(v) => set("value")(v.replace(/[^\d]/g, ""))} inputMode="numeric" prefix="%" />
          )}
        </FieldRow>
      </FormSection>

      <FormSection title="Limits">
        <FieldRow>
          <MoneyField label="Minimum subtotal" value={draft.minSubtotal} onChange={set("minSubtotal")} placeholder="None" />
          <TextField
            label="Total redemptions"
            value={draft.maxRedemptions}
            onChange={(v) => set("maxRedemptions")(v.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Unlimited"
          />
        </FieldRow>
        <SelectField
          label="Gallery"
          value={draft.galleryId}
          onChange={set("galleryId")}
          options={[{ value: "", label: "Every gallery" }, ...galleries.map((g) => ({ value: g.id, label: g.name }))]}
        />
        <FieldRow>
          <DateField label="Starts" value={draft.startsAt} onChange={set("startsAt")} placeholder="Immediately" />
          <DateField label="Ends" value={draft.endsAt} onChange={set("endsAt")} placeholder="No end date" />
        </FieldRow>
      </FormSection>
    </CreateDialog>
  );
}

export default DiscountDialog;
