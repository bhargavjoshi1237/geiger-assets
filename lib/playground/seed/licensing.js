// Rights & licensing domain: rights holders and records, licensees, templates,
// the rate card, quotes, issued licences (+ items and renewals) and royalties.
// Licence fees run through the app's own pricing engine so every breakdown is
// exactly what the Pricing screen would have produced.

import {
  defaultRateCard,
  quoteLicense,
} from "@/components/internal/screens/projects/licensing/pricing_engine";
import { personId } from "../cast";
import { base, daysAgo, daysFromNow, dateOnly, sid } from "./helpers";

const day = (offset) => dateOnly(offset >= 0 ? daysFromNow(offset) : daysAgo(-offset));

function holderRows() {
  return [
    [1, "Lena Ortiz Studio", "photographer", "lena@ortiz.studio", 15, "Net 30", "Spring and product shoots."],
    [2, "Brightline Agency", "agency", "rights@brightline.agency", 10, "Net 45", "Campaign creative and film."],
    [3, "Moonlit Audio", "label", "licensing@moonlit.audio", 20, "Net 30", "Music beds and sonic logo."],
    [4, "Halcyon in-house", "internal", "studio@halcyon.studio", 0, "—", "Owned outright."],
    [5, "Kaito Mori", "creator", "kaito@mori.design", 12.5, "Net 15", "3D product models."],
  ].map(([n, name, kind, email, rate, terms, notes]) => ({
    ...base("holder", n, { created: 160 - n * 8 }),
    name,
    kind,
    email,
    default_royalty_rate: rate,
    payment_terms: terms,
    notes,
    created_by: personId(1),
  }));
}

function rightsRows() {
  return [
    [1, "Spring hero photography", 1, 4, null, "commissioned", 100, ["worldwide"], ["web", "social", "print", "ooh"], -60, 700, "exclusive", "active"],
    [2, "Aurora lamp packshots", 1, 11, null, "commissioned", 100, ["worldwide"], ["web", "print", "packaging"], -120, 1000, "non_exclusive", "active"],
    [3, "Brand film", 2, 18, null, "commissioned", 100, ["worldwide"], ["web", "social", "tv", "streaming"], -45, 1400, "exclusive", "active"],
    [4, "Ambient bed — spring", 3, 24, null, "licensed_in", 0, ["north_america", "europe"], ["web", "social"], -30, 20, "non_exclusive", "expiring"],
    [5, "Sonic logo", 3, 22, null, "licensed_in", 0, ["worldwide"], ["web", "tv", "streaming", "events"], -300, -5, "sole", "expired"],
    [6, "Holiday campaign", 2, null, 6, "commissioned", 100, ["worldwide"], ["web", "social", "ooh"], -260, 105, "exclusive", "active"],
    [7, "Founders portrait", 4, 15, null, "owned", 100, ["worldwide"], ["web", "print", "events"], -400, null, "exclusive", "active"],
    [8, "Aurora lamp 3D model", 5, 34, null, "licensed_in", 0, ["worldwide"], ["web", "packaging"], -20, 345, "non_exclusive", "disputed"],
  ].map(([n, title, holder, asset, collection, acquisition, share, territories, channels, start, end, exclusivity, status]) => ({
    ...base("rights", n, { created: Math.abs(start), updated: 3 }),
    title,
    rights_holder_id: sid("holder", holder),
    asset_id: asset ? sid("asset", asset) : null,
    collection_id: collection ? sid("collection", collection) : null,
    external_ref: `RR-${String(1000 + n)}`,
    acquisition_type: acquisition,
    ownership_share: share,
    territories,
    channels,
    window_start: day(start),
    window_end: end == null ? null : day(end),
    exclusivity,
    status,
    document_url: "",
    notes: status === "disputed" ? "Creator disputes AR usage — under review with legal." : "",
    created_by: personId(2),
  }));
}

function licenseeRows() {
  return [
    [1, "Northwind Outdoor", "Erin Walsh", "erin@northwind-outdoor.example", "brand", "North America", "https://northwind-outdoor.example"],
    [2, "Tessera Magazine", "Theo Park", "photo@tesseramag.com", "publisher", "Europe", "https://tesseramag.com"],
    [3, "Channel Nine", "Priya Shah", "acquisitions@channelnine.tv", "broadcaster", "United Kingdom", "https://channelnine.tv"],
    [4, "Brightline Agency", "Sam Carter", "studio@brightline.agency", "agency", "Worldwide", "https://brightline.agency"],
    [5, "Solace Hotels", "Lucía Ferrer", "lucia@solacehotels.example", "brand", "Europe", "https://solacehotels.example"],
  ].map(([n, name, contact, email, kind, territory, website]) => ({
    ...base("licensee", n, { created: 120 - n * 9 }),
    name,
    contact_name: contact,
    email,
    kind,
    territory,
    website,
    notes: "",
    created_by: personId(2),
  }));
}

function templateRows() {
  return [
    [1, "Editorial — single use", "One-time editorial use in print or online publications.", "editorial", ["worldwide"], ["web", "print"], 12, "non_exclusive", ["No advertising use", "Credit required"], false, "active"],
    [2, "Advertising — campaign", "Paid advertising across digital and out-of-home.", "advertising", ["north_america"], ["web", "social", "ooh"], 12, "sole", ["No political use", "Approval of final layouts"], true, "active"],
    [3, "Broadcast — TV & streaming", "Broadcast and streaming rights for film assets.", "broadcast", ["uk"], ["tv", "streaming"], 24, "exclusive", ["Max 3 edits"], true, "active"],
    [4, "Social — organic", "Organic social posts on owned channels.", "social", ["worldwide"], ["social"], 6, "non_exclusive", [], false, "active"],
    [5, "Merchandise", "Printed goods and packaging.", "merchandise", ["domestic"], ["packaging", "print"], 36, "exclusive", ["Sample approval required"], true, "draft"],
  ].map(([n, name, description, usage, territories, channels, months, exclusivity, restrictions, approval, status], i) => ({
    ...base("template", n, { created: 100 - n * 6 }),
    name,
    description,
    usage_type: usage,
    default_territories: territories,
    default_channels: channels,
    default_duration_months: months,
    exclusivity,
    restrictions,
    terms_body: `${name}\n\nThe licensee may use the licensed assets solely for ${usage} purposes within the territories and channels listed on the licence certificate.`,
    requires_approval: approval,
    status,
    version: 1 + (n % 3),
    position: i,
    created_by: personId(1),
  }));
}

function priceRuleRows() {
  return defaultRateCard(null).map((rule, i) => ({
    ...base("price_rule", i + 1, { created: 100 }),
    template_id: null,
    kind: rule.kind,
    rule_key: rule.ruleKey,
    label: rule.label,
    multiplier: rule.multiplier,
    flat_cents: rule.flatCents,
    currency: "usd",
    position: rule.position,
    is_active: true,
    created_by: personId(1),
  }));
}

function licenseRows(templates) {
  const rules = defaultRateCard(null);
  const template = (n) => {
    const t = templates[n - 1];
    return { id: t.id, exclusivity: t.exclusivity };
  };
  const rows = [
    // [n, title, template, licensee, status, usage, territories, channels, exclusivity, start, end, perpetual, autoRenew, royalty, assets]
    [1, "Northwind — spring campaign", 2, 1, "active", "advertising", ["north_america"], ["web", "social", "ooh"], "sole", -40, 325, false, true, 15, [4, 6]],
    [2, "Tessera — founders feature", 1, 2, "active", "editorial", ["europe"], ["web", "print"], "non_exclusive", -12, 353, false, false, 0, [15]],
    [3, "Channel Nine — brand film", 3, 3, "active", "broadcast", ["uk"], ["tv", "streaming"], "exclusive", -90, 640, false, false, 10, [18]],
    [4, "Solace Hotels — holiday OOH", 2, 5, "expiring", "advertising", ["europe"], ["ooh"], "sole", -340, 12, false, true, 10, [9]],
    [5, "Brightline — social cutdowns", 4, 4, "expiring", "social", ["worldwide"], ["social"], "non_exclusive", -170, 6, false, false, 0, [19]],
    [6, "Northwind — packaging", 5, 1, "pending", "merchandise", ["domestic"], ["packaging", "print"], "exclusive", 5, 1100, false, false, 12.5, [11, 34]],
    [7, "Tessera — holiday lookbook", 1, 2, "expired", "editorial", ["europe"], ["print"], "non_exclusive", -400, -35, false, false, 0, [37]],
    [8, "Brightline — sonic logo", 4, 4, "terminated", "social", ["worldwide"], ["social"], "non_exclusive", -200, -60, false, false, 20, [22]],
    [9, "Channel Nine — product demo", 3, 3, "draft", "broadcast", ["uk"], ["tv"], "exclusive", 20, 385, false, false, 10, [21]],
  ];
  const licenses = [];
  const items = [];
  let itemN = 1;
  for (const [n, title, tmpl, licensee, status, usage, territories, channels, exclusivity, start, end, perpetual, autoRenew, royalty, assetNs] of rows) {
    const months = Math.max(1, Math.round((end - start) / 30));
    const breakdown = quoteLicense({
      template: template(tmpl),
      rules,
      scope: { territories, channels, durationMonths: months, exclusivity, quantity: assetNs.length },
    });
    licenses.push({
      ...base("license", n, { created: Math.abs(start) + 5, updated: 2 }),
      reference: `LIC-2026-${String(n).padStart(4, "0")}`,
      title,
      template_id: templates[tmpl - 1].id,
      licensee_id: sid("licensee", licensee),
      status,
      usage_type: usage,
      territories,
      channels,
      exclusivity,
      start_date: day(start),
      end_date: day(end),
      grace_days: 14,
      is_perpetual: perpetual,
      auto_renew: autoRenew,
      fee_cents: breakdown.totalCents,
      currency: "usd",
      price_breakdown: breakdown,
      royalty_rate: royalty,
      restrictions: templates[tmpl - 1].restrictions,
      terms_body: templates[tmpl - 1].terms_body,
      document_url: "",
      notes: "",
      issued_at: status === "draft" || status === "pending" ? null : daysAgo(Math.abs(start) + 2),
      renewal_of: null,
      renewed_to: null,
      created_by: personId(2),
    });
    for (const an of assetNs) {
      items.push({
        ...base("license_item", itemN++, { created: Math.abs(start) + 5 }),
        license_id: sid("license", n),
        asset_id: sid("asset", an),
        collection_id: null,
        rights_record_id: null,
        external_title: "",
        external_ref: "",
        version_label: "Current",
        notes: "",
      });
    }
  }
  return { licenses, items };
}

function quoteRows(templates) {
  return [
    [1, 1, 2, "Northwind — summer extension", "quoted", 1840000],
    [2, 5, 2, "Solace — Summer '26 OOH", "requested", null],
    [3, 2, 1, "Tessera — product round-up", "accepted", 96000],
    [4, 3, 3, "Channel Nine — teaser", "declined", 1250000],
  ].map(([n, licensee, tmpl, subject, status, quoted]) => ({
    ...base("quote", n, { created: 14 - n * 2 }),
    licensee_id: sid("licensee", licensee),
    template_id: templates[tmpl - 1].id,
    subject,
    scope: { territories: templates[tmpl - 1].default_territories, channels: templates[tmpl - 1].default_channels, durationMonths: 12 },
    computed_cents: quoted ?? 0,
    quoted_cents: quoted,
    currency: "usd",
    status,
    license_id: null,
    note: "",
    created_by: personId(3),
  }));
}

function renewalRows() {
  return [
    [1, 3, "renewed", -90, 640, 1250000, "Renewed for two more seasons."],
    [2, 4, "reminded", 12, 12, 0, "Reminder sent to Solace Hotels."],
    [3, 7, "lapsed", -35, -35, 0, "Licensee declined renewal."],
    [4, 8, "terminated", -60, -60, 0, "Terminated early at licensee request."],
    [5, 5, "grace_extended", 6, 20, 0, "Two-week grace while terms are finalised."],
  ].map(([n, license, action, prev, next, fee, note]) => ({
    id: sid("renewal", n),
    project_id: base("renewal", n).project_id,
    license_id: sid("license", license),
    action,
    previous_end_date: day(prev),
    new_end_date: day(next),
    fee_cents: fee,
    currency: "usd",
    note,
    created_by: personId(2),
    created_at: daysAgo(n * 4),
    metadata: {},
  }));
}

function royaltyRows() {
  const rules = [
    [1, 1, "Lena Ortiz — photography", "global", null, 15, 0, 0],
    [2, 2, "Brightline — brand film", "asset", sid("asset", 18), 10, 0, 500000],
    [3, 3, "Moonlit — music beds", "rights_record", sid("rights", 4), 20, 2500, 0],
    [4, 5, "Kaito Mori — 3D models", "asset", sid("asset", 34), 12.5, 0, 0],
  ].map(([n, holder, label, scope, scopeId, rate, flat, mg], i) => ({
    ...base("royalty_rule", n, { created: 90 }),
    rights_holder_id: sid("holder", holder),
    label,
    scope_kind: scope,
    scope_id: scopeId,
    rate_percent: rate,
    flat_cents: flat,
    minimum_guarantee_cents: mg,
    recoupable: mg > 0,
    priority: i,
    is_active: true,
    created_by: personId(1),
  }));

  const periods = [
    [-90, -61],
    [-60, -31],
    [-30, -1],
  ];
  const statements = [];
  const lines = [];
  let statementN = 1;
  let lineN = 1;
  const holders = [
    [1, 1, 1, 1840000],
    [2, 3, 2, 1250000],
    [3, 5, 1, 420000],
  ];
  for (const [holder, license, rule, basis] of holders) {
    periods.forEach(([start, end], p) => {
      const rate = rules[rule - 1].rate_percent;
      const gross = Math.round(basis * (0.6 + p * 0.25));
      const royalty = Math.round((gross * rate) / 100);
      const status = p === 2 ? "draft" : p === 1 ? "issued" : "paid";
      statements.push({
        ...base("statement", statementN, { created: -start }),
        rights_holder_id: sid("holder", holder),
        period_start: day(start),
        period_end: day(end),
        gross_cents: gross,
        royalty_cents: royalty,
        minimum_guarantee_cents: 0,
        recouped_cents: 0,
        payable_cents: royalty,
        currency: "usd",
        status,
        issued_at: status === "draft" ? null : daysAgo(-end),
        paid_at: status === "paid" ? daysAgo(-end - 10) : null,
        note: "",
        created_by: personId(2),
      });
      lines.push({
        ...base("royalty_line", lineN++, { created: -end }),
        license_id: sid("license", license),
        rights_holder_id: sid("holder", holder),
        royalty_rule_id: sid("royalty_rule", rule),
        statement_id: sid("statement", statementN),
        basis_cents: gross,
        rate_percent: rate,
        amount_cents: royalty,
        currency: "usd",
        period_start: day(start),
        status: status === "paid" ? "paid" : "statemented",
        note: "",
        created_by: personId(2),
      });
      statementN += 1;
    });
  }
  // A couple of fresh accruals not yet on a statement.
  lines.push({
    ...base("royalty_line", lineN++, { created: 2 }),
    license_id: sid("license", 2),
    rights_holder_id: sid("holder", 4),
    royalty_rule_id: null,
    statement_id: null,
    basis_cents: 96000,
    rate_percent: 0,
    amount_cents: 0,
    currency: "usd",
    period_start: day(-2),
    status: "accrued",
    note: "In-house asset — no royalty due.",
    created_by: personId(2),
  });
  lines.push({
    ...base("royalty_line", lineN++, { created: 1 }),
    license_id: sid("license", 1),
    rights_holder_id: sid("holder", 1),
    royalty_rule_id: sid("royalty_rule", 1),
    statement_id: null,
    basis_cents: 460000,
    rate_percent: 15,
    amount_cents: 69000,
    currency: "usd",
    period_start: day(-1),
    status: "accrued",
    note: "",
    created_by: personId(2),
  });
  return { rules, statements, lines };
}

export function licensingSeed() {
  const templates = templateRows();
  const { licenses, items } = licenseRows(templates);
  const royalties = royaltyRows();
  return {
    rights_holders: holderRows(),
    rights_records: rightsRows(),
    licensees: licenseeRows(),
    license_templates: templates,
    license_price_rules: priceRuleRows(),
    license_quotes: quoteRows(templates),
    licenses,
    license_items: items,
    license_renewals: renewalRows(),
    royalty_rules: royalties.rules,
    royalty_statements: royalties.statements,
    royalty_lines: royalties.lines,
  };
}
