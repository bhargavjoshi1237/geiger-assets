// Licence pricing — turns a rate card plus a requested scope into a quote.
//
// Pure: no DB, no React. The same function drives the Pricing screen's live
// calculator and the issue dialog, and the breakdown it returns is what gets
// frozen into `licenses.price_breakdown` so a licence can always explain its fee.

const EXCLUSIVITY_FALLBACK = { exclusive: 2, sole: 1.5, non_exclusive: 1 };

// Rules for one template, falling back to the global (template_id = null) card.
export function rulesForTemplate(rules, templateId) {
  const active = (rules || []).filter((r) => r.isActive !== false);
  const scoped = active.filter((r) => r.templateId === templateId);
  const global = active.filter((r) => !r.templateId);
  const byKind = (kind) => {
    const own = scoped.filter((r) => r.kind === kind);
    return own.length ? own : global.filter((r) => r.kind === kind);
  };
  return {
    base: byKind("base"),
    territory: byKind("territory"),
    duration: byKind("duration"),
    channel: byKind("channel"),
    exclusivity: byKind("exclusivity"),
  };
}

function ruleFor(list, key) {
  return list.find((r) => r.ruleKey === key) || null;
}

// The duration card is keyed by month count; pick the closest rule at or below
// the requested term so a 15-month licence still prices off the 12-month rule.
function durationRule(list, months) {
  const numeric = list
    .map((r) => ({ rule: r, months: Number(r.ruleKey) }))
    .filter((r) => Number.isFinite(r.months))
    .sort((a, b) => a.months - b.months);
  if (!numeric.length) return null;
  const perpetual = numeric.find((r) => r.months === 0);
  if (!months && perpetual) return perpetual.rule;
  let match = null;
  for (const entry of numeric) {
    if (entry.months === 0) continue;
    if (entry.months <= months) match = entry.rule;
  }
  return match || numeric.find((r) => r.months > 0)?.rule || null;
}

/**
 * quoteLicense({ template, rules, scope })
 *
 * scope: { territories: string[], channels: string[], durationMonths: number,
 *          exclusivity: string, quantity?: number, baseOverrideCents?: number }
 *
 * Territory and channel multipliers compound (each selected one multiplies the
 * running total); duration and exclusivity apply once. Flat rule amounts are
 * added after multiplication as line-item surcharges.
 */
export function quoteLicense({ template, rules, scope } = {}) {
  const card = rulesForTemplate(rules, template?.id ?? null);
  const territories = scope?.territories?.length ? scope.territories : [];
  const channels = scope?.channels?.length ? scope.channels : [];
  const months = Number(scope?.durationMonths) || 0;
  const exclusivity = scope?.exclusivity || template?.exclusivity || "non_exclusive";
  const quantity = Math.max(1, Number(scope?.quantity) || 1);

  const baseRule = ruleFor(card.base, template?.id ? "template" : "default") || card.base[0] || null;
  const baseCents = Number.isFinite(Number(scope?.baseOverrideCents))
    ? Number(scope.baseOverrideCents)
    : Number(baseRule?.flatCents ?? 0);

  const factors = [];
  let multiplier = 1;
  let surcharge = 0;

  for (const key of territories) {
    const rule = ruleFor(card.territory, key);
    if (!rule) continue;
    multiplier *= Number(rule.multiplier) || 1;
    surcharge += Number(rule.flatCents) || 0;
    factors.push({
      kind: "territory",
      key,
      label: rule.label || key,
      multiplier: Number(rule.multiplier) || 1,
      flatCents: Number(rule.flatCents) || 0,
    });
  }

  for (const key of channels) {
    const rule = ruleFor(card.channel, key);
    if (!rule) continue;
    multiplier *= Number(rule.multiplier) || 1;
    surcharge += Number(rule.flatCents) || 0;
    factors.push({
      kind: "channel",
      key,
      label: rule.label || key,
      multiplier: Number(rule.multiplier) || 1,
      flatCents: Number(rule.flatCents) || 0,
    });
  }

  const dRule = durationRule(card.duration, months);
  if (dRule) {
    multiplier *= Number(dRule.multiplier) || 1;
    surcharge += Number(dRule.flatCents) || 0;
    factors.push({
      kind: "duration",
      key: dRule.ruleKey,
      label: dRule.label || `${months || "Perpetual"} months`,
      multiplier: Number(dRule.multiplier) || 1,
      flatCents: Number(dRule.flatCents) || 0,
    });
  }

  const xRule = ruleFor(card.exclusivity, exclusivity);
  const xMultiplier = xRule
    ? Number(xRule.multiplier) || 1
    : EXCLUSIVITY_FALLBACK[exclusivity] ?? 1;
  multiplier *= xMultiplier;
  surcharge += Number(xRule?.flatCents) || 0;
  factors.push({
    kind: "exclusivity",
    key: exclusivity,
    label: xRule?.label || exclusivity.replace(/_/g, " "),
    multiplier: xMultiplier,
    flatCents: Number(xRule?.flatCents) || 0,
  });

  const totalCents = Math.max(
    0,
    Math.round((baseCents * multiplier + surcharge) * quantity),
  );

  return {
    baseCents,
    multiplier: Math.round(multiplier * 1000) / 1000,
    surchargeCents: surcharge,
    quantity,
    factors,
    totalCents,
    currency: baseRule?.currency || "usd",
    templateId: template?.id ?? null,
    hasRateCard: Boolean(baseRule || factors.some((f) => f.multiplier !== 1)),
  };
}

// A short, human breakdown for the quote panel and the licence's financials tab.
export function describeBreakdown(breakdown) {
  if (!breakdown?.factors?.length) return [];
  return breakdown.factors.map((f) => ({
    label: f.label,
    kind: f.kind,
    detail: [
      f.multiplier !== 1 ? `×${f.multiplier}` : null,
      f.flatCents ? `+${(f.flatCents / 100).toFixed(2)}` : null,
    ]
      .filter(Boolean)
      .join(" "),
  }));
}

// The starter rate card seeded when a project has no pricing rules yet.
export function defaultRateCard(projectId) {
  const rule = (kind, ruleKey, label, multiplier, flatCents, position) => ({
    projectId,
    templateId: null,
    kind,
    ruleKey,
    label,
    multiplier,
    flatCents,
    position,
    isActive: true,
  });
  return [
    rule("base", "default", "Standard base fee", 1, 50000, 0),
    rule("territory", "worldwide", "Worldwide", 2.5, 0, 1),
    rule("territory", "north_america", "North America", 1.6, 0, 2),
    rule("territory", "europe", "Europe", 1.5, 0, 3),
    rule("territory", "uk", "United Kingdom", 1.2, 0, 4),
    rule("territory", "apac", "Asia-Pacific", 1.4, 0, 5),
    rule("territory", "domestic", "Domestic only", 1, 0, 6),
    rule("duration", "3", "3 months", 0.5, 0, 7),
    rule("duration", "6", "6 months", 0.75, 0, 8),
    rule("duration", "12", "1 year", 1, 0, 9),
    rule("duration", "24", "2 years", 1.75, 0, 10),
    rule("duration", "36", "3 years", 2.4, 0, 11),
    rule("duration", "0", "Perpetual", 4, 0, 12),
    rule("channel", "web", "Web", 1, 0, 13),
    rule("channel", "social", "Social", 1.15, 0, 14),
    rule("channel", "print", "Print", 1.25, 0, 15),
    rule("channel", "ooh", "Out of home", 1.6, 0, 16),
    rule("channel", "tv", "TV", 1.8, 0, 17),
    rule("channel", "streaming", "Streaming", 1.5, 0, 18),
    rule("channel", "packaging", "Packaging", 1.45, 0, 19),
    rule("exclusivity", "non_exclusive", "Non-exclusive", 1, 0, 20),
    rule("exclusivity", "sole", "Sole", 1.5, 0, 21),
    rule("exclusivity", "exclusive", "Exclusive", 2.25, 0, 22),
  ];
}
