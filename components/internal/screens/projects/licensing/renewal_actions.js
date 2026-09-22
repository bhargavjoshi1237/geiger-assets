"use client";

// Renewal transitions, shared by the Renewals screen and the licence detail's
// Renewals tab so both write the same audit trail.
//
// Each action persists the licence change *and* a license_renewals row, and
// returns `{ license, renewal }` (either may be null when a write fails) so the
// caller can reconcile its optimistic state and toast.

import { addDays, addMonths } from "./constants";
import { createLicense, createRenewal, updateLicense } from "@/lib/supabase/licensing";

async function record(license, patch, renewal) {
  const [saved, logged] = await Promise.all([
    updateLicense(license.id, patch),
    createRenewal({
      projectId: license.projectId,
      licenseId: license.id,
      currency: license.currency,
      ...renewal,
    }),
  ]);
  return { license: saved, renewal: logged };
}

/**
 * Renew in place: extend the term from the current end date and log the renewal.
 * `months` of 0 makes the licence perpetual.
 */
export async function renewInPlace(license, { months = 12, feeCents = 0, note = "" } = {}) {
  const previousEnd = license.endDate || "";
  const perpetual = Number(months) === 0;
  const newEnd = perpetual ? "" : addMonths(previousEnd || undefined, months);
  const patch = {
    status: "active",
    startDate: previousEnd || license.startDate,
    endDate: newEnd,
    isPerpetual: perpetual,
    feeCents: feeCents || license.feeCents,
  };
  return record(license, patch, {
    action: "renewed",
    previousEndDate: previousEnd,
    newEndDate: newEnd,
    feeCents: feeCents || license.feeCents,
    note,
  });
}

/**
 * Renew as a successor licence: the old one is marked `renewed` and linked to a
 * fresh licence that carries the same scope forward. Used when the paperwork
 * needs a distinct reference per term.
 */
export async function renewAsSuccessor(license, { months = 12, feeCents = 0, reference, note = "" } = {}) {
  const successorId = crypto.randomUUID();
  const start = license.endDate || license.startDate || "";
  const perpetual = Number(months) === 0;
  const end = perpetual ? "" : addMonths(start || undefined, months);

  const successor = await createLicense({
    id: successorId,
    projectId: license.projectId,
    reference: reference || `${license.reference}-R`,
    title: license.title,
    templateId: license.templateId,
    licenseeId: license.licenseeId,
    status: "active",
    usageType: license.usageType,
    territories: license.territories,
    channels: license.channels,
    exclusivity: license.exclusivity,
    startDate: start,
    endDate: end,
    graceDays: license.graceDays,
    isPerpetual: perpetual,
    autoRenew: license.autoRenew,
    feeCents: feeCents || license.feeCents,
    currency: license.currency,
    priceBreakdown: license.priceBreakdown,
    royaltyRate: license.royaltyRate,
    restrictions: license.restrictions,
    termsBody: license.termsBody,
    notes: license.notes,
    issuedAt: new Date().toISOString(),
    renewalOf: license.id,
  });

  const { license: saved, renewal } = await record(
    license,
    { status: "renewed", renewedTo: successor?.id || null },
    {
      action: "renewed",
      previousEndDate: license.endDate || "",
      newEndDate: end,
      feeCents: feeCents || license.feeCents,
      note: note || `Renewed as ${successor?.reference || "a successor licence"}`,
    },
  );

  return { license: saved, renewal, successor };
}

export async function lapseLicense(license, { note = "" } = {}) {
  return record(
    license,
    { status: "expired" },
    { action: "lapsed", previousEndDate: license.endDate || "", newEndDate: license.endDate || "", note },
  );
}

export async function terminateLicense(license, { note = "" } = {}) {
  const endedToday = new Date().toISOString().slice(0, 10);
  return record(
    license,
    { status: "terminated", endDate: endedToday },
    { action: "terminated", previousEndDate: license.endDate || "", newEndDate: endedToday, note },
  );
}

export async function extendGrace(license, { days = 30, note = "" } = {}) {
  const previousEnd = license.endDate || "";
  const newEnd = addDays(previousEnd || undefined, days);
  return record(
    license,
    { endDate: newEnd, graceDays: Number(license.graceDays || 0) + Number(days), status: "expiring" },
    {
      action: "grace_extended",
      previousEndDate: previousEnd,
      newEndDate: newEnd,
      note: note || `Grace extended by ${days} days`,
    },
  );
}
