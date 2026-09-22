"use client";

import React, { useMemo, useState } from "react";
import { Check, Copy, FlaskConical } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { Switch } from "@geiger/ui/switch";
import { EmptyState, Field, SectionCard, SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { useCopied } from "@/lib/use-copied";
import { deliveryHref, deliveryUrl } from "@/lib/delivery/url";

const CROP_OPTIONS = [
  { value: "fill", label: "Fill" },
  { value: "fit", label: "Fit" },
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "pad", label: "Pad" },
  { value: "crop", label: "Crop" },
  { value: "thumb", label: "Thumb" },
];

const FORMAT_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "webp", label: "WebP" },
  { value: "avif", label: "AVIF" },
  { value: "jpg", label: "JPEG" },
  { value: "png", label: "PNG" },
];

// Radix throws on a Select.Item with an empty value, so "no effect" travels
// through the sentinel the shared kit already uses and maps back to "" here.
const NONE = "__none__";

const EFFECT_OPTIONS = [
  { value: "", label: "None" },
  { value: "blur", label: "Blur" },
  { value: "sharpen", label: "Sharpen" },
  { value: "grayscale", label: "Grayscale" },
  { value: "sepia", label: "Sepia" },
  { value: "negate", label: "Negate" },
  { value: "brightness", label: "Brightness" },
  { value: "contrast", label: "Contrast" },
  { value: "saturation", label: "Saturation" },
  { value: "tint", label: "Tint" },
];


// `asset` is the in-progress form; `saved` is what the server currently holds.
// The toggle follows the form, but /d/ only serves once delivery_enabled has
// actually been persisted, so the preview has to follow `saved` or it renders
// against a 404 the moment the switch is flipped.
export function DeliverySection({ asset, saved, onPatch }) {
  const [width, setWidth] = useState("800");
  const [height, setHeight] = useState("");
  const [crop, setCrop] = useState("fill");
  const [format, setFormat] = useState("auto");
  const [quality, setQuality] = useState("auto");
  const [effect, setEffect] = useState("");
  const [copied, flashCopied] = useCopied(2000);

  const patch = onPatch || (() => {});
  const enabled = Boolean(asset?.deliveryEnabled);
  const live = Boolean((saved ?? asset)?.deliveryEnabled);

  const transform = useMemo(() => {
    const parts = [];
    if (width.trim()) parts.push(`w_${width.trim()}`);
    if (height.trim()) parts.push(`h_${height.trim()}`);
    if (crop) parts.push(`c_${crop}`);
    if (format) parts.push(`f_${format}`);
    if (quality) parts.push(`q_${quality}`);
    if (effect) parts.push(`e_${effect}`);
    return parts.join(",");
  }, [width, height, crop, format, quality, effect]);

  // href is what this page can actually fetch; shareUrl is what gets shown and
  // copied. They differ by origin + basePath, so both come from one builder.
  const href = useMemo(() => deliveryHref(asset, transform), [asset, transform]);
  const shareUrl = useMemo(() => deliveryUrl(asset, transform), [asset, transform]);

  const copyUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      flashCopied();
    } catch {
      // Clipboard unavailable — the URL stays visible for manual copy.
    }
  };

  if (!asset) return null;
  const hasFile = Boolean(asset.storageKey);

  return (
    <div className="space-y-4">
      <SectionCard title="Delivery" description="Opt this asset into the dynamic delivery engine.">
        <SettingsList>
          <SettingRow
            title="Enable delivery"
            description="The only place delivery is turned on. Disabled assets 404 on every /d/ URL."
            control={
              <Switch checked={enabled} onCheckedChange={(v) => patch({ deliveryEnabled: v })} aria-label="Enable delivery" />
            }
          />
        </SettingsList>
      </SectionCard>

      <SectionCard
        title="Playground"
        description="Tune transforms on the left, preview the rendered derivative and copy its canonical URL on the right."
      >
        {!enabled ? (
          <EmptyState
            icon={FlaskConical}
            title="Delivery is off"
            description="Enable delivery above to preview transforms for this asset."
            className="py-8"
          />
        ) : !live ? (
          <EmptyState
            icon={FlaskConical}
            title="Save to start delivering"
            description="Delivery is on in this form but not saved yet, so /d/ URLs still 404. Save the asset to preview transforms."
            className="py-8"
          />
        ) : !hasFile ? (
          <EmptyState
            icon={FlaskConical}
            title="No file yet"
            description="Upload a file for this asset before previewing transforms."
            className="py-8"
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="grid content-start gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Width">
                  <Input
                    value={width}
                    onChange={(e) => setWidth(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                    placeholder="800"
                    inputMode="numeric"
                    className="bg-surface-card"
                  />
                </Field>
                <Field label="Height">
                  <Input
                    value={height}
                    onChange={(e) => setHeight(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                    placeholder="600"
                    inputMode="numeric"
                    className="bg-surface-card"
                  />
                </Field>
              </div>
              <Field label="Crop">
                <Select value={crop} onValueChange={setCrop}>
                  <SelectTrigger className="border-border bg-surface-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-surface-subtle text-foreground">
                    {CROP_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Format">
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger className="border-border bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-surface-subtle text-foreground">
                      {FORMAT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Quality">
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger className="border-border bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-surface-subtle text-foreground">
                      <SelectItem value="auto" className="text-xs">Auto</SelectItem>
                      {[60, 70, 80, 90].map((q) => (
                        <SelectItem key={q} value={String(q)} className="text-xs">
                          {q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Effect">
                <Select value={effect || NONE} onValueChange={(v) => setEffect(v === NONE ? "" : v)}>
                  <SelectTrigger className="border-border bg-surface-card">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-surface-subtle text-foreground">
                    {EFFECT_OPTIONS.map((o) => (
                      <SelectItem key={o.value || NONE} value={o.value || NONE} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="space-y-3">
              <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={href} alt={asset.name || "Delivery preview"} className="max-h-72 w-full object-contain" />
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-foreground">{shareUrl}</code>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy delivery URL"
                  className="h-7 w-7 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
                  onClick={copyUrl}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default DeliverySection;
