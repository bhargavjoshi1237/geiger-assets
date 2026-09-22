// Royalty accrual and statement building.
//
// Pure: no DB, no React. `accrueForLicense` turns one licence's fee into royalty
// lines per rights holder; `buildStatement` rolls a holder's lines up for a
// period, applying the minimum guarantee and recouping it against earnings.

// The most specific active rule wins per holder: asset > collection >
// rights_record > template > global, then explicit priority as the tiebreak.
const SCOPE_RANK = { asset: 4, collection: 3, rights_record: 2, template: 1, global: 0 };

function ruleApplies(rule, license, items) {
  if (rule.isActive === false) return false;
  switch (rule.scopeKind) {
    case "global":
      return true;
    case "template":
      return Boolean(rule.scopeId) && rule.scopeId === license.templateId;
    case "asset":
      return (items || []).some((i) => i.assetId && i.assetId === rule.scopeId);
    case "collection":
      return (items || []).some((i) => i.collectionId && i.collectionId === rule.scopeId);
    case "rights_record":
      return (items || []).some((i) => i.rightsRecordId && i.rightsRecordId === rule.scopeId);
    default:
      return false;
  }
}

export function rulesForLicense(rules, license, items) {
  const applicable = (rules || []).filter((r) => ruleApplies(r, license, items));
  const best = new Map();
  for (const rule of applicable) {
    const key = rule.rightsHolderId || "unassigned";
    const current = best.get(key);
    const rank = (SCOPE_RANK[rule.scopeKind] ?? 0) * 1000 - (Number(rule.priority) || 0);
    if (!current || rank > current.rank) best.set(key, { rule, rank });
  }
  return [...best.values()].map((entry) => entry.rule);
}

/**
 * accrueForLicense(license, rules, items, { projectId, periodStart })
 * Returns royalty-line drafts (camelCase, ready for createRoyaltyLines).
 */
export function accrueForLicense(license, rules, items, { projectId, periodStart } = {}) {
  if (!license || !license.feeCents) return [];
  const basis = Number(license.feeCents) || 0;
  return rulesForLicense(rules, license, items)
    .filter((rule) => rule.rightsHolderId)
    .map((rule) => {
      const rate = Number(rule.ratePercent) || 0;
      const amount = Math.round((basis * rate) / 100) + (Number(rule.flatCents) || 0);
      return {
        projectId: projectId ?? license.projectId ?? null,
        licenseId: license.id,
        rightsHolderId: rule.rightsHolderId,
        royaltyRuleId: rule.id,
        basisCents: basis,
        ratePercent: rate,
        amountCents: amount,
        currency: license.currency || "usd",
        periodStart: periodStart || license.startDate || license.issuedAt?.slice(0, 10) || "",
        status: "accrued",
        note: rule.label || "",
      };
    })
    .filter((line) => line.amountCents > 0);
}

// Lines that have no statement yet and fall inside the period.
export function linesInPeriod(lines, { holderId, periodStart, periodEnd } = {}) {
  const from = periodStart ? new Date(periodStart).getTime() : Number.NEGATIVE_INFINITY;
  const to = periodEnd ? new Date(periodEnd).getTime() : Number.POSITIVE_INFINITY;
  return (lines || []).filter((line) => {
    if (holderId && line.rightsHolderId !== holderId) return false;
    if (line.status === "void") return false;
    if (line.statementId) return false;
    const at = line.periodStart ? new Date(line.periodStart).getTime() : null;
    if (at === null) return true;
    return at >= from && at <= to;
  });
}

/**
 * buildStatement(holder, lines, { periodStart, periodEnd, rules, projectId })
 *
 * Royalties earned in the period are compared to the holder's minimum guarantee.
 * A recoupable MG is treated as an advance already paid: earnings are recouped
 * against it and only the excess becomes payable. A non-recoupable MG is a
 * floor — the holder is paid at least the guarantee.
 */
export function buildStatement(holder, lines, { periodStart, periodEnd, rules, projectId } = {}) {
  const scoped = linesInPeriod(lines, { holderId: holder?.id, periodStart, periodEnd });
  const royaltyCents = scoped.reduce((sum, l) => sum + (Number(l.amountCents) || 0), 0);
  const grossCents = scoped.reduce((sum, l) => sum + (Number(l.basisCents) || 0), 0);

  const holderRules = (rules || []).filter((r) => r.rightsHolderId === holder?.id);
  const mgRule = holderRules.find((r) => (Number(r.minimumGuaranteeCents) || 0) > 0);
  const mgCents = Number(mgRule?.minimumGuaranteeCents) || 0;
  const recoupable = Boolean(mgRule?.recoupable);

  const recoupedCents = recoupable ? Math.min(royaltyCents, mgCents) : 0;
  const payableCents = recoupable
    ? Math.max(0, royaltyCents - mgCents)
    : Math.max(royaltyCents, mgCents);

  return {
    draft: {
      projectId: projectId ?? holder?.projectId ?? null,
      rightsHolderId: holder?.id ?? null,
      periodStart: periodStart || "",
      periodEnd: periodEnd || "",
      grossCents,
      royaltyCents,
      minimumGuaranteeCents: mgCents,
      recoupedCents,
      payableCents,
      currency: scoped[0]?.currency || "usd",
      status: "draft",
    },
    lineIds: scoped.map((l) => l.id),
    lineCount: scoped.length,
  };
}

// Revenue by an arbitrary key (territory, channel, month…) for the charts.
export function groupRevenue(licenses, keyFn) {
  const totals = new Map();
  for (const license of licenses || []) {
    for (const key of [].concat(keyFn(license) || [])) {
      if (!key) continue;
      totals.set(key, (totals.get(key) || 0) + (Number(license.feeCents) || 0));
    }
  }
  return [...totals.entries()]
    .map(([key, cents]) => ({ key, cents }))
    .sort((a, b) => b.cents - a.cents);
}

// Twelve trailing months of licence revenue, oldest first.
export function revenueByMonth(licenses, months = 12) {
  const buckets = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      month: d.toLocaleDateString("en-US", { month: "short" }),
      cents: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const license of licenses || []) {
    const stamp = license.issuedAt || license.startDate || license.createdAt;
    if (!stamp) continue;
    const d = new Date(stamp);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const at = index.get(key);
    if (at === undefined) continue;
    buckets[at].cents += Number(license.feeCents) || 0;
  }
  return buckets;
}
