"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  CreateDialog,
  FieldRow,
  FormSection,
  SelectField,
  TextField,
} from "@/components/internal/shared/module_kit";
import { ChipSelect } from "../licensing/licensing_kit";
import { RENDITION_OPTIONS, plural } from "./constants";

const DAY_MS = 86_400_000;

function blank() {
  return { customerId: "", assetIds: [], rendition: "original", downloadLimit: "5", expiryDays: "30" };
}

/**
 * Hand a customer download links by hand — a replacement file, a goodwill
 * extra, a comp. Links are created without an order and marked "Granted by
 * staff". Pass `customer` to lock the recipient.
 */
export function GrantDownloadsDialog({ open, onOpenChange, customers, customer = null, assets, onSubmit }) {
  const [draft, setDraft] = useState(blank);
  const [seeded, setSeeded] = useState(open);
  if (open !== seeded) {
    setSeeded(open);
    if (open) setDraft({ ...blank(), customerId: customer?.id || "" });
  }
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    const customerId = customer?.id || draft.customerId;
    if (!customerId) return toast.error("Pick a customer");
    if (!draft.assetIds.length) return toast.error("Pick at least one asset");
    const days = Number(draft.expiryDays) || 0;
    onSubmit({
      customerId,
      assetIds: draft.assetIds,
      rendition: draft.rendition,
      maxDownloads: Number(draft.downloadLimit) || 0,
      expiresAt: days > 0 ? new Date(Date.now() + days * DAY_MS).toISOString() : null,
    });
  };

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Grant downloads"
      description={customer ? `Give ${customer.name || customer.email} download links.` : "Give a customer download links without an order."}
      submitLabel={draft.assetIds.length ? `Grant ${plural(draft.assetIds.length, "download")}` : "Grant downloads"}
      wide
      onSubmit={submit}
    >
      {customer ? null : (
        <SelectField
          label="Customer"
          value={draft.customerId}
          onChange={set("customerId")}
          options={[{ value: "", label: "Select a customer" }, ...customers.map((c) => ({ value: c.id, label: c.name ? `${c.name} — ${c.email}` : c.email }))]}
        />
      )}
      <ChipSelect
        label="Assets"
        options={assets.slice(0, 300).map((a) => ({ value: a.id, label: a.name || "Untitled asset" }))}
        values={draft.assetIds}
        onChange={set("assetIds")}
        emptyHint="No asset selected."
        searchPlaceholder="Filter assets…"
      />
      <FormSection title="Delivery">
        <FieldRow columns={3}>
          <SelectField label="Rendition" value={draft.rendition} onChange={set("rendition")} options={RENDITION_OPTIONS} />
          <TextField label="Download limit" value={draft.downloadLimit} onChange={(v) => set("downloadLimit")(v.replace(/\D/g, ""))} inputMode="numeric" hint="0 = unlimited" />
          <TextField label="Expires after (days)" value={draft.expiryDays} onChange={(v) => set("expiryDays")(v.replace(/\D/g, ""))} inputMode="numeric" hint="0 = never" />
        </FieldRow>
      </FormSection>
    </CreateDialog>
  );
}

export default GrantDownloadsDialog;
