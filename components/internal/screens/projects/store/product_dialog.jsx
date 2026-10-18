"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@geiger/ui/switch";
import { cn } from "@/lib/utils";
import { Field } from "@/components/internal/shared/screen_kit";
import {
  CreateDialog,
  FieldRow,
  FormSection,
  MoneyField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/internal/shared/module_kit";
import { ChipSelect } from "../licensing/licensing_kit";
import { fulfillmentDefaults } from "@/lib/commerce/shape";
import {
  CHANNELS,
  DURATION_OPTIONS,
  EXCLUSIVITY_META,
  FORMAT_OPTIONS,
  PRODUCT_KIND_META,
  PRODUCT_STATUS_META,
  RENDITION_OPTIONS,
  TERRITORIES,
  USAGE_TYPE_META,
  centsToDollarString,
  optionsFromMeta,
  parseDollarsToCents,
} from "./constants";

const STATUS_OPTIONS = optionsFromMeta(PRODUCT_STATUS_META);
const USAGE_OPTIONS = optionsFromMeta(USAGE_TYPE_META);
const EXCLUSIVITY_OPTIONS = optionsFromMeta(EXCLUSIVITY_META);

function emptyDraft(kind = "download") {
  return {
    kind,
    name: "",
    description: "",
    price: "",
    compareAt: "",
    sku: "",
    status: "active",
    licenseTemplateId: "",
    fulfillment: fulfillmentDefaults(kind),
  };
}

function draftFrom(product) {
  if (!product) return emptyDraft();
  return {
    kind: product.kind,
    name: product.name,
    description: product.description,
    price: centsToDollarString(product.priceCents),
    compareAt: product.compareAtCents ? centsToDollarString(product.compareAtCents) : "",
    sku: product.sku,
    status: product.status,
    licenseTemplateId: product.licenseTemplateId || "",
    fulfillment: { ...product.fulfillment },
  };
}

function SwitchField({ label, hint, checked, onCheckedChange }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex h-10 items-center">
        <Switch checked={Boolean(checked)} onCheckedChange={onCheckedChange} />
      </div>
    </Field>
  );
}

/** The files half of a product: which rendition, how many downloads, for how long. */
function FileDelivery({ f, setF, withFormat = true }) {
  return (
    <>
      <FieldRow columns={withFormat ? 2 : 1}>
        <SelectField
          label="Rendition"
          value={f.rendition}
          onChange={setF("rendition")}
          options={RENDITION_OPTIONS}
          hint="Images are downscaled at download time; other files ship as the original."
        />
        {withFormat ? (
          <SelectField label="Format" value={f.format || "original"} onChange={setF("format")} options={FORMAT_OPTIONS} />
        ) : null}
      </FieldRow>
      <FieldRow>
        <TextField
          label="Download limit"
          value={String(f.downloadLimit ?? 0)}
          onChange={(v) => setF("downloadLimit")(Number(v.replace(/\D/g, "")) || 0)}
          inputMode="numeric"
          hint="Per file. 0 = unlimited."
        />
        <TextField
          label="Link expires after (days)"
          value={String(f.expiryDays ?? 0)}
          onChange={(v) => setF("expiryDays")(Number(v.replace(/\D/g, "")) || 0)}
          inputMode="numeric"
          hint="0 = never expires."
        />
      </FieldRow>
    </>
  );
}

/**
 * Create or edit a store product. Every kind carries its own fulfilment
 * settings — what the buyer receives, and how — which are snapshotted onto
 * each order item at purchase time.
 */
export function ProductDialog({ open, onOpenChange, product, templates, onSubmit }) {
  const [draft, setDraft] = useState(() => draftFrom(product));

  // Re-seed the form each time the dialog opens.
  const openedFor = open ? product?.id || "new" : null;
  const [seededFor, setSeededFor] = useState(openedFor);
  if (openedFor !== seededFor) {
    setSeededFor(openedFor);
    if (openedFor) setDraft(draftFrom(product));
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const f = draft.fulfillment;
  const setF = (key) => (value) =>
    setDraft((d) => ({ ...d, fulfillment: { ...d.fulfillment, [key]: value } }));

  const pickKind = (kind) =>
    setDraft((d) => (d.kind === kind ? d : { ...d, kind, fulfillment: fulfillmentDefaults(kind) }));

  // A template brings its licence scope in as the product's defaults.
  const pickTemplate = (id) => {
    set("licenseTemplateId")(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setDraft((d) => ({
      ...d,
      licenseTemplateId: id,
      name: d.name || template.name,
      fulfillment: {
        ...d.fulfillment,
        usageType: template.usageType,
        durationMonths: template.defaultDurationMonths,
        exclusivity: template.exclusivity,
        territories: template.defaultTerritories.length ? template.defaultTerritories : d.fulfillment.territories,
        channels: template.defaultChannels.length ? template.defaultChannels : d.fulfillment.channels,
        requiresApproval: template.requiresApproval,
      },
    }));
  };

  const submit = () => {
    if (!draft.name.trim()) return toast.error("Give the product a name");
    const priceCents = parseDollarsToCents(draft.price);
    if (priceCents < 0) return toast.error("Price can't be negative");
    if (draft.kind === "bundle" && !(Number(f.size) > 1)) return toast.error("A bundle needs at least 2 assets");
    onSubmit({
      kind: draft.kind,
      name: draft.name.trim(),
      description: draft.description.trim(),
      priceCents,
      compareAtCents: draft.compareAt ? parseDollarsToCents(draft.compareAt) : 0,
      sku: draft.sku.trim(),
      status: draft.status,
      licenseTemplateId: draft.kind === "license" ? draft.licenseTemplateId || null : null,
      fulfillment: draft.fulfillment,
    });
  };

  const meta = PRODUCT_KIND_META[draft.kind];

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={product ? "Edit product" : "New product"}
      description="Something galleries can sell. Prices here are the default — price sheets and galleries can override them."
      submitLabel={product ? "Save product" : "Create product"}
      size="xl"
      onSubmit={submit}
      footerNote={meta?.hint}
    >
      <FormSection title="Kind" description="What the buyer gets.">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Object.entries(PRODUCT_KIND_META).map(([kind, m]) => {
            const Icon = m.icon;
            const on = draft.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => pickKind(kind)}
                aria-pressed={on}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                  on
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-surface-card text-muted-foreground hover:bg-surface-hover",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{m.short}</span>
              </button>
            );
          })}
        </div>
      </FormSection>

      <FormSection title="Details">
        <FieldRow>
          <TextField label="Name" value={draft.name} onChange={set("name")} placeholder={`e.g. ${kindExample(draft.kind)}`} />
          <SelectField label="Status" value={draft.status} onChange={set("status")} options={STATUS_OPTIONS} />
        </FieldRow>
        <TextAreaField
          label="Description"
          value={draft.description}
          onChange={set("description")}
          rows={2}
          placeholder="Shown to buyers beside the price."
        />
        <FieldRow columns={3}>
          <MoneyField label="Price" value={draft.price} onChange={set("price")} />
          <MoneyField
            label="Compare-at price"
            value={draft.compareAt}
            onChange={set("compareAt")}
            placeholder="Optional"
            hint="Shown struck through when higher."
          />
          <TextField label="SKU" value={draft.sku} onChange={set("sku")} placeholder="Optional" />
        </FieldRow>
      </FormSection>

      {draft.kind === "download" ? (
        <FormSection title="Delivery" description="What the download link hands over.">
          <FileDelivery f={f} setF={setF} />
        </FormSection>
      ) : null}

      {draft.kind === "license" ? (
        <>
          <FormSection
            title="Licence terms"
            description="Issued to the buyer automatically when the order is paid (Cart & Checkout → Fulfilment)."
          >
            <SelectField
              label="Licence template"
              value={draft.licenseTemplateId}
              onChange={pickTemplate}
              options={[
                { value: "", label: "No template — use the terms below" },
                ...templates.map((t) => ({ value: t.id, label: `${t.name} (v${t.version})` })),
              ]}
              hint="The template's terms body and restrictions are copied onto each licence."
            />
            <FieldRow columns={3}>
              <SelectField label="Usage" value={f.usageType} onChange={setF("usageType")} options={USAGE_OPTIONS} />
              <SelectField
                label="Duration"
                value={String(f.durationMonths ?? 12)}
                onChange={(v) => setF("durationMonths")(Number(v) || 0)}
                options={DURATION_OPTIONS}
              />
              <SelectField label="Exclusivity" value={f.exclusivity} onChange={setF("exclusivity")} options={EXCLUSIVITY_OPTIONS} />
            </FieldRow>
            <ChipSelect label="Territories" options={TERRITORIES} values={f.territories || []} onChange={setF("territories")} emptyHint="No territory granted." />
            <ChipSelect label="Channels" options={CHANNELS} values={f.channels || []} onChange={setF("channels")} emptyHint="No channel granted." />
            <FieldRow>
              <SwitchField
                label="Needs approval"
                hint="The licence is issued as pending until someone approves it."
                checked={f.requiresApproval}
                onCheckedChange={setF("requiresApproval")}
              />
              <SwitchField
                label="Include the file"
                hint="Grant a download of the licensed asset too."
                checked={f.includeDownload}
                onCheckedChange={setF("includeDownload")}
              />
            </FieldRow>
          </FormSection>
          {f.includeDownload ? (
            <FormSection title="Included file">
              <FileDelivery f={f} setF={setF} />
            </FormSection>
          ) : null}
        </>
      ) : null}

      {draft.kind === "print" ? (
        <>
          <FormSection title="Print" description="Produced and shipped by you — the order stays open until you mark prints shipped.">
            <FieldRow columns={3}>
              <TextField label="Size" value={f.size} onChange={setF("size")} placeholder="8×10 in" />
              <TextField label="Paper" value={f.paper} onChange={setF("paper")} placeholder="Lustre" />
              <TextField label="Finish" value={f.finish} onChange={setF("finish")} placeholder="Unframed" />
            </FieldRow>
            <FieldRow columns={3}>
              <TextField
                label="Production time (days)"
                value={String(f.productionDays ?? 0)}
                onChange={(v) => setF("productionDays")(Number(v.replace(/\D/g, "")) || 0)}
                inputMode="numeric"
              />
              <SwitchField
                label="Needs a shipping address"
                checked={f.requiresShipping}
                onCheckedChange={setF("requiresShipping")}
              />
              <SwitchField
                label="Include a digital copy"
                checked={f.includeDownload}
                onCheckedChange={setF("includeDownload")}
              />
            </FieldRow>
          </FormSection>
          {f.includeDownload ? (
            <FormSection title="Digital copy">
              <FileDelivery f={f} setF={setF} withFormat={false} />
            </FormSection>
          ) : null}
        </>
      ) : null}

      {draft.kind === "physical" ? (
        <FormSection
          title="Physical product"
          description="Sold once per gallery from a price sheet, not per asset. Produced and shipped by you — the order stays open until you mark it shipped."
        >
          <FieldRow columns={3}>
            <TextField label="Variant" value={f.variant} onChange={setF("variant")} placeholder="e.g. A4 · Hardcover" />
            <TextField
              label="Ships in (days)"
              value={String(f.productionDays ?? 0)}
              onChange={(v) => setF("productionDays")(Number(v.replace(/\D/g, "")) || 0)}
              inputMode="numeric"
            />
            <SwitchField
              label="Needs a shipping address"
              hint="Off for collection or hand delivery."
              checked={f.requiresShipping}
              onCheckedChange={setF("requiresShipping")}
            />
          </FieldRow>
        </FormSection>
      ) : null}

      {draft.kind === "bundle" ? (
        <FormSection title="Bundle" description="The buyer picks this many assets from the gallery.">
          <TextField
            label="Assets in the bundle"
            value={String(f.size ?? 0)}
            onChange={(v) => setF("size")(Number(v.replace(/\D/g, "")) || 0)}
            inputMode="numeric"
            hint="Capped at the gallery's size if it holds fewer."
          />
          <FileDelivery f={f} setF={setF} />
        </FormSection>
      ) : null}

      {draft.kind === "unlock" ? (
        <FormSection title="Whole gallery" description="Every asset in the gallery, delivered as below.">
          <FileDelivery f={f} setF={setF} />
        </FormSection>
      ) : null}
    </CreateDialog>
  );
}

function kindExample(kind) {
  return {
    download: "High-res download",
    license: "Editorial licence — 1 year",
    print: "Fine-art print 12×18",
    physical: "Photo book — A4 hardcover",
    bundle: "Any 5 photos",
    unlock: "Full gallery",
  }[kind];
}

export default ProductDialog;
