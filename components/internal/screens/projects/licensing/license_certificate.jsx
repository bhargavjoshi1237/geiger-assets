"use client";

import React, { useRef } from "react";
import { Printer } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { SectionCard } from "@/components/internal/shared/screen_kit";
import {
  CHANNELS,
  EXCLUSIVITY_META,
  TERRITORIES,
  USAGE_TYPE_META,
  formatDate,
  formatMoney,
  labelFor,
  labelsFor,
} from "./constants";

// Fills the template's terms tokens with this licence's actual scope.
export function renderTerms(license, template) {
  const body = license?.termsBody || template?.termsBody || "";
  if (!body) return "";
  const duration = license?.isPerpetual
    ? "in perpetuity"
    : license?.startDate && license?.endDate
      ? `from ${formatDate(license.startDate)} to ${formatDate(license.endDate)}`
      : "the term stated above";
  return body
    .replace(/\{\{\s*exclusivity\s*\}\}/gi, labelFor(EXCLUSIVITY_META, license?.exclusivity).toLowerCase())
    .replace(/\{\{\s*usage\s*\}\}/gi, labelFor(USAGE_TYPE_META, license?.usageType).toLowerCase())
    .replace(/\{\{\s*territories\s*\}\}/gi, labelsFor(TERRITORIES, license?.territories).join(", ") || "the agreed territories")
    .replace(/\{\{\s*channels\s*\}\}/gi, labelsFor(CHANNELS, license?.channels).join(", ") || "the agreed channels")
    .replace(/\{\{\s*duration\s*\}\}/gi, duration);
}

// Printing goes through a bare window so the workspace chrome stays out of it.
function printNode(node, title) {
  if (!node || typeof window === "undefined") return;
  const frame = window.open("", "_blank", "width=900,height=1000");
  if (!frame) return;
  frame.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; margin: 48px; line-height: 1.5; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #666; margin: 28px 0 8px; }
    p { font-size: 13px; margin: 0 0 10px; white-space: pre-wrap; }
    dl { display: grid; grid-template-columns: 180px 1fr; gap: 6px 16px; font-size: 13px; margin: 0; }
    dt { color: #666; }
    dd { margin: 0; font-weight: 500; }
    ul { font-size: 13px; padding-left: 18px; margin: 0; }
    .ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #666; }
    hr { border: 0; border-top: 1px solid #ddd; margin: 24px 0; }
  </style></head><body>${node.innerHTML}</body></html>`);
  frame.document.close();
  frame.focus();
  frame.print();
}

export function LicenseCertificate({ license, licensee, template, items, assetById, collectionById }) {
  const printable = useRef(null);

  const itemLabel = (item) => {
    if (item.assetId) {
      const asset = assetById?.get(item.assetId);
      return `${asset?.name || asset?.fileName || "Library asset"}${item.versionLabel ? ` (${item.versionLabel})` : ""}`;
    }
    if (item.collectionId) {
      return `Collection: ${collectionById?.get(item.collectionId)?.name || "Untitled collection"}`;
    }
    return item.externalTitle || item.externalRef || "External material";
  };

  return (
    <SectionCard
      title="Licence certificate"
      description="The grant as the licensee should receive it."
      action={
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-border bg-surface-card text-xs hover:bg-surface-hover"
          onClick={() => printNode(printable.current, license?.reference || "Licence certificate")}
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
      }
    >
      <div ref={printable} className="rounded-lg border border-border bg-surface-card p-6 text-foreground">
        <h1 className="text-lg font-semibold">Licence certificate</h1>
        <p className="ref text-xs text-text-tertiary">
          {license?.reference || "Unreferenced"} · issued {license?.issuedAt ? formatDate(license.issuedAt) : "—"}
        </p>

        <h2 className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Parties</h2>
        <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-text-tertiary">Licensee</dt>
          <dd className="font-medium">{licensee?.name || "—"}</dd>
          <dt className="text-text-tertiary">Contact</dt>
          <dd className="font-medium">{licensee?.contactName || licensee?.email || "—"}</dd>
          <dt className="text-text-tertiary">Licence</dt>
          <dd className="font-medium">{license?.title || "—"}</dd>
          <dt className="text-text-tertiary">Template</dt>
          <dd className="font-medium">{template?.name ? `${template.name} (v${template.version})` : "Bespoke"}</dd>
        </dl>

        <h2 className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Grant</h2>
        <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-text-tertiary">Usage</dt>
          <dd className="font-medium">{labelFor(USAGE_TYPE_META, license?.usageType)}</dd>
          <dt className="text-text-tertiary">Exclusivity</dt>
          <dd className="font-medium">{labelFor(EXCLUSIVITY_META, license?.exclusivity)}</dd>
          <dt className="text-text-tertiary">Territories</dt>
          <dd className="font-medium">{labelsFor(TERRITORIES, license?.territories).join(", ") || "—"}</dd>
          <dt className="text-text-tertiary">Channels</dt>
          <dd className="font-medium">{labelsFor(CHANNELS, license?.channels).join(", ") || "—"}</dd>
          <dt className="text-text-tertiary">Term</dt>
          <dd className="font-medium">
            {license?.isPerpetual
              ? "Perpetual"
              : `${license?.startDate ? formatDate(license.startDate) : "—"} → ${license?.endDate ? formatDate(license.endDate) : "open-ended"}`}
          </dd>
          <dt className="text-text-tertiary">Fee</dt>
          <dd className="font-medium">{formatMoney(license?.feeCents, license?.currency)}</dd>
        </dl>

        <h2 className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Licensed material</h2>
        {items?.length ? (
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            {items.map((item) => (
              <li key={item.id}>{itemLabel(item)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-tertiary">No items listed on this licence.</p>
        )}

        {license?.restrictions?.length ? (
          <>
            <h2 className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Restrictions</h2>
            <ul className="list-disc space-y-0.5 pl-5 text-xs">
              {license.restrictions.map((restriction) => (
                <li key={restriction}>{restriction}</li>
              ))}
            </ul>
          </>
        ) : null}

        <h2 className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Terms</h2>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
          {renderTerms(license, template) || "No terms body recorded for this licence."}
        </p>
      </div>
    </SectionCard>
  );
}

export default LicenseCertificate;
