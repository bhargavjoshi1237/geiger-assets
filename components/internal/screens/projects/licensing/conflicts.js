// Licence conflict + coverage checks.
//
// Pure: no DB, no React. Two questions get answered here:
//   1. Does this grant collide with an exclusive licence we already issued?
//   2. Do we actually hold the rights we are about to grant?
// Both return plain `{ level, title, detail }` findings the UI renders as
// warnings; nothing here blocks a save — the operator decides.

const LIVE_STATUSES = new Set(["pending", "active", "expiring"]);
const EXCLUSIVE = new Set(["exclusive", "sole"]);

function overlaps(aStart, aEnd, bStart, bEnd) {
  // An absent end date means open-ended, so it overlaps anything after its start.
  const start = (v) => (v ? new Date(v).getTime() : Number.NEGATIVE_INFINITY);
  const end = (v) => (v ? new Date(v).getTime() : Number.POSITIVE_INFINITY);
  return start(aStart) <= end(bEnd) && start(bStart) <= end(aEnd);
}

function intersects(a, b) {
  if (!a?.length || !b?.length) return false;
  if (a.includes("worldwide") || b.includes("worldwide")) return true;
  return a.some((value) => b.includes(value));
}

// The subjects a licence covers, as comparable keys (asset, collection, or the
// normalized external title for off-DAM material).
export function subjectKeys(items) {
  return (items || [])
    .map((item) => {
      if (item.assetId) return `asset:${item.assetId}`;
      if (item.collectionId) return `collection:${item.collectionId}`;
      const external = (item.externalTitle || item.externalRef || "").trim().toLowerCase();
      return external ? `external:${external}` : null;
    })
    .filter(Boolean);
}

/**
 * findConflicts(license, items, otherLicenses, itemsByLicense)
 *
 * Flags an overlap when a live licence — this one or the other — is exclusive
 * and both cover the same subject, an intersecting territory, an intersecting
 * channel, and an overlapping term.
 */
export function findConflicts(license, items, otherLicenses, itemsByLicense) {
  if (!license) return [];
  const mine = subjectKeys(items);
  if (!mine.length) return [];
  const findings = [];

  for (const other of otherLicenses || []) {
    if (!other || other.id === license.id) continue;
    if (!LIVE_STATUSES.has(other.status)) continue;
    const eitherExclusive = EXCLUSIVE.has(license.exclusivity) || EXCLUSIVE.has(other.exclusivity);
    if (!eitherExclusive) continue;

    const theirs = subjectKeys(itemsByLicense?.get(other.id));
    const shared = mine.filter((key) => theirs.includes(key));
    if (!shared.length) continue;
    if (!intersects(license.territories, other.territories)) continue;
    if (!intersects(license.channels, other.channels)) continue;
    if (!overlaps(license.startDate, license.endDate, other.startDate, other.endDate)) continue;

    findings.push({
      level: "conflict",
      licenseId: other.id,
      title: `Exclusivity clash with ${other.reference || other.title || "another licence"}`,
      detail: `${shared.length} shared item${shared.length === 1 ? "" : "s"} on an overlapping term, territory and channel.`,
    });
  }

  return findings;
}

/**
 * checkCoverage(license, items, rightsRecords)
 *
 * Flags grants that go beyond the inbound rights on file: no rights record for
 * an item, a grant that reaches outside the record's window, a territory or
 * channel we do not hold, or an exclusive grant on a non-exclusively held right.
 */
export function checkCoverage(license, items, rightsRecords) {
  if (!license) return [];
  const findings = [];
  const records = rightsRecords || [];

  for (const item of items || []) {
    const subject = item.assetId
      ? records.filter((r) => r.assetId === item.assetId)
      : item.collectionId
        ? records.filter((r) => r.collectionId === item.collectionId)
        : records.filter((r) => r.id === item.rightsRecordId);

    const label = item.externalTitle || item.versionLabel || "Licensed item";

    if (!subject.length) {
      findings.push({
        level: "warning",
        title: `No rights record for ${label}`,
        detail: "Nothing in Rights Inventory backs this item — the grant is unverified.",
      });
      continue;
    }

    const usable = subject.filter((r) => r.status !== "expired" && r.status !== "disputed");
    if (!usable.length) {
      findings.push({
        level: "conflict",
        title: `Rights for ${label} are expired or disputed`,
        detail: "Resolve the rights record before issuing this grant.",
      });
      continue;
    }

    for (const record of usable) {
      if (record.windowEnd && license.endDate && new Date(license.endDate) > new Date(record.windowEnd)) {
        findings.push({
          level: "conflict",
          title: `Grant outlasts held rights for ${label}`,
          detail: `Held until ${record.windowEnd}; this licence runs to ${license.endDate}.`,
        });
      }
      if (record.territories?.length && !record.territories.includes("worldwide")) {
        const missing = (license.territories || []).filter((t) => !record.territories.includes(t));
        if (missing.length) {
          findings.push({
            level: "warning",
            title: `Territory not held for ${label}`,
            detail: `Granting ${missing.join(", ")} but rights cover ${record.territories.join(", ")}.`,
          });
        }
      }
      if (record.channels?.length) {
        const missing = (license.channels || []).filter((c) => !record.channels.includes(c));
        if (missing.length) {
          findings.push({
            level: "warning",
            title: `Channel not held for ${label}`,
            detail: `Granting ${missing.join(", ")} but rights cover ${record.channels.join(", ")}.`,
          });
        }
      }
      if (EXCLUSIVE.has(license.exclusivity) && record.exclusivity === "non_exclusive") {
        findings.push({
          level: "warning",
          title: `Exclusive grant on non-exclusive rights for ${label}`,
          detail: "We hold this right non-exclusively, so exclusivity cannot be guaranteed.",
        });
      }
    }
  }

  return findings;
}

export function reviewLicense({ license, items, licenses, itemsByLicense, rightsRecords }) {
  return [
    ...findConflicts(license, items, licenses, itemsByLicense),
    ...checkCoverage(license, items, rightsRecords),
  ];
}
