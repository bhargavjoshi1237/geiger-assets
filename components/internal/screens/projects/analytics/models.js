import { dayKey, formatBytes, formatCurrency, formatNumber, formatPercent, lastDays } from "./constants";
import { donutVariant } from "./analytics_chart_data.mjs";

const number = (value) => Number(value) || 0;
const sum = (rows, key) => rows.reduce((total, row) => total + number(row[key]), 0);
const countBy = (rows, key) => {
  const counts = new Map();
  for (const row of rows) {
    const label = typeof key === "function" ? key(row) : row[key];
    if (!label) continue;
    counts.set(String(label), (counts.get(String(label)) || 0) + 1);
  }
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};
const top = (rows, limit = 7) => rows.slice(0, limit);
const metric = (label, value, footer) => ({ label, value, footer });
const byDay = (rows, days, dateKey, value = () => 1) => {
  const buckets = new Map(days.map((day) => [day, 0]));
  for (const row of rows) {
    const day = dayKey(row[dateKey]);
    if (buckets.has(day)) buckets.set(day, buckets.get(day) + number(value(row)));
  }
  return days.map((day) => buckets.get(day));
};
const dated = (rows, start, dateKey) => rows.filter((row) => dayKey(row[dateKey]) >= start);
const trend = (title, description, categories, series, format = "number") => ({ type: "line", title, description, categories, series, format });
const area = (title, description, categories, name, values, format = "number") => ({ type: "area", title, description, categories, name, values, format });
const rank = (title, description, rows, format = "number") => ({ type: "bar", title, description, rows: top(rows), format });
const mix = (title, description, rows, format = "number", variant = donutVariant(title)) => ({ type: "donut", title, description, rows: top(rows, 6), format, variant });
const groupSum = (rows, label, value) => {
  const groups = new Map();
  for (const row of rows) {
    const name = label(row);
    if (!name) continue;
    groups.set(name, (groups.get(name) || 0) + number(value(row)));
  }
  return [...groups].map(([name, amount]) => ({ label: name, value: amount })).sort((a, b) => b.value - a.value);
};

export const ANALYTICS_SCREENS = {
  "Asset Analytics": {
    description: "See which assets are delivered, downloaded, and opened in galleries.",
    sources: ["assets", "daily", "galleryEvents"],
    empty: "Delivery and gallery activity will appear here when assets are used.",
    build(data, days) {
      const assets = data.assets || [];
      const daily = dated(data.daily || [], days[0], "day");
      const events = dated(data.galleryEvents || [], days[0], "occurredAt");
      const total = daily.filter((row) => !row.assetId);
      const names = new Map(assets.map((asset) => [asset.id, asset.name]));
      const assetTraffic = groupSum(daily.filter((row) => row.assetId), (row) => names.get(row.assetId) || "Unknown asset", (row) => row.requests);
      return {
        hasData: assets.length > 0 || daily.length > 0 || events.length > 0,
        stats: [
          metric("Delivery requests", formatNumber(sum(total, "requests")), "Selected period"),
          metric("Gallery item views", formatNumber(events.filter((e) => e.kind === "item_view").length), "Selected period"),
          metric("Recorded downloads", formatNumber(sum(assets, "downloads")), "Lifetime asset counter"),
          metric("Assets", formatNumber(assets.length), "Current library"),
        ],
        charts: [
          area("Delivery trend", "Requests served each day", days, "Requests", byDay(total, days, "day", (r) => r.requests)),
          rank("Most delivered assets", "Requests by asset in the selected period", assetTraffic),
          rank("Most downloaded assets", "Lifetime file download counter", assets.map((a) => ({ label: a.name, value: number(a.downloads) })).sort((a, b) => b.value - a.value)),
          mix("Gallery engagement", "Item views, downloads, and favorites", countBy(events.filter((e) => ["item_view", "download", "favorite"].includes(e.kind)), (e) => e.kind.replace("_", " "))),
        ],
      };
    },
  },
  "Search Analytics": {
    description: "Find popular queries, dead ends, and search click through.",
    sources: ["search"],
    empty: "Searches will appear after visitors use the asset library search.",
    build(data, days) {
      const rows = dated(data.search || [], days[0], "occurredAt");
      const zero = rows.filter((r) => r.resultCount === 0);
      const clicked = rows.filter((r) => r.clickedAssetId);
      const queries = countBy(rows, (r) => r.normalizedQuery || r.query?.toLowerCase().trim());
      const filters = countBy(rows.flatMap((r) => Object.entries(r.filters || {}).filter(([, value]) => value && value !== "all").map(([name]) => ({ name }))), "name");
      return {
        hasData: rows.length > 0,
        stats: [metric("Searches", formatNumber(rows.length), "Selected period"), metric("Zero result rate", formatPercent(zero.length / (rows.length || 1)), `${zero.length} searches`), metric("Click through", formatPercent(clicked.length / (rows.length || 1)), "Searches with a clicked asset"), metric("Unique queries", formatNumber(queries.length), "Normalized terms")],
        charts: [
          trend("Search activity", "Queries and zero result searches by day", days, [{ name: "Searches", data: byDay(rows, days, "occurredAt") }, { name: "Zero results", data: byDay(zero, days, "occurredAt") }]),
          rank("Top queries", "Most repeated search terms", queries),
          rank("Queries with no results", "Terms that need better content or metadata", countBy(zero, (r) => r.normalizedQuery || r.query?.toLowerCase().trim())),
          rank("Filter usage", "Filters applied to searches", filters),
        ],
      };
    },
  },
  "Portal Analytics": {
    description: "Understand how visitors engage with published galleries.",
    sources: ["galleries", "galleryEvents"],
    empty: "Publish a gallery and collect visits to see portal engagement.",
    build(data, days) {
      const galleries = data.galleries || [];
      const events = dated(data.galleryEvents || [], days[0], "occurredAt");
      const views = events.filter((e) => e.kind === "view");
      const downloads = events.filter((e) => e.kind === "download");
      const visitors = new Set(events.map((e) => e.visitorId).filter(Boolean));
      const names = new Map(galleries.map((g) => [g.id, g.name]));
      return {
        hasData: galleries.length > 0 || events.length > 0,
        stats: [metric("Gallery views", formatNumber(views.length), "Selected period"), metric("Active visitors", formatNumber(visitors.size), "Distinct recorded visitors"), metric("Downloads", formatNumber(downloads.length), "Selected period"), metric("Download rate", formatPercent(downloads.length / (views.length || 1)), "Downloads / gallery views")],
        charts: [
          trend("Visitor activity", "Gallery views and downloads each day", days, [{ name: "Views", data: byDay(views, days, "occurredAt") }, { name: "Downloads", data: byDay(downloads, days, "occurredAt") }]),
          rank("Most viewed galleries", "Gallery page views in the selected period", countBy(views, (e) => names.get(e.galleryId) || "Unknown gallery")),
          mix("Visitor actions", "How people interact with galleries", countBy(events, (e) => e.kind.replace("_", " "))),
          rank("Most downloaded galleries", "Download events by gallery", countBy(downloads, (e) => names.get(e.galleryId) || "Unknown gallery")),
        ],
      };
    },
  },
  "Library Health": {
    description: "Spot missing metadata, duplicate groups, and rights that need attention.",
    sources: ["assets", "duplicates", "rights"],
    empty: "Add assets to see library quality and operational health.",
    build(data, days) {
      const assets = data.assets || [];
      const rights = data.rights || [];
      const missing = assets.filter((a) => !a.description?.trim() || !a.tags?.length);
      const open = (data.duplicates || []).filter((g) => g.status === "open");
      const expired = rights.filter((r) => r.windowEnd && dayKey(r.windowEnd) < dayKey(new Date().toISOString()) && r.status === "active");
      return {
        hasData: assets.length > 0 || rights.length > 0,
        stats: [metric("Metadata complete", formatPercent((assets.length - missing.length) / (assets.length || 1)), "Description and tags"), metric("Needs metadata", formatNumber(missing.length), "Missing description or tags"), metric("Open duplicate groups", formatNumber(open.length), "Awaiting review"), metric("Expired rights", formatNumber(expired.length), "Active records past end date")],
        charts: [
          mix("Asset status", "Current library by workflow state", countBy(assets, "status")),
          rank("Metadata gaps by type", "Assets missing description or tags", countBy(missing, "type")),
          area("Assets added", "New assets in the selected period", days, "Uploads", byDay(assets, days, "createdAt")),
          mix("Rights status", "Current rights records", countBy(rights, "status")),
        ],
      };
    },
  },
  "Storage & Usage": {
    description: "Track stored content, delivery bandwidth, and transformation demand.",
    sources: ["assets", "daily", "deliveryEvents"],
    empty: "Storage and delivery usage will appear when assets are added or served.",
    build(data, days) {
      const assets = data.assets || [];
      const totals = dated(data.daily || [], days[0], "day").filter((r) => !r.assetId);
      const events = dated(data.deliveryEvents || [], days[0], "occurredAt");
      const transformed = events.filter((e) => Object.keys(e.transform || {}).length > 0);
      return {
        hasData: assets.length > 0 || totals.length > 0,
        stats: [metric("Stored", formatBytes(sum(assets, "sizeBytes")), "Current library"), metric("Bandwidth", formatBytes(sum(totals, "bytes")), "Selected period"), metric("Delivery requests", formatNumber(sum(totals, "requests")), "Selected period"), metric("Transformed serves", formatNumber(transformed.length), "Recent event sample")],
        charts: [
          area("Bandwidth trend", "Bytes served each day", days, "Bandwidth", byDay(totals, days, "day", (r) => r.bytes), "bytes"),
          mix("Storage by media type", "Share of bytes in the library", groupSum(assets, (a) => a.type || "Other", (a) => a.sizeBytes), "bytes"),
          rank("Largest assets", "Current asset size", assets.map((a) => ({ label: a.name, value: number(a.sizeBytes) })).sort((a, b) => b.value - a.value), "bytes"),
          rank("Transform formats", "Recent transformed serve events", countBy(transformed, (e) => e.transform?.format || "Automatic")),
        ],
      };
    },
  },
  "Commerce Analytics": {
    description: "Read paid order performance, product demand, and refunds.",
    sources: ["orders", "orderItems", "products"],
    empty: "Paid orders and product activity will appear here after checkout.",
    build(data, days) {
      const orders = dated(data.orders || [], days[0], "createdAt");
      const paidOrders = orders.filter((o) => ["paid", "fulfilled", "partially_refunded", "refunded"].includes(o.status) || o.paidAt);
      const currency = paidOrders[0]?.currency || "usd";
      const paid = paidOrders.filter((o) => o.currency === currency);
      const otherCurrencies = paidOrders.length - paid.length;
      const paidIds = new Set(paid.map((o) => o.id));
      const items = (data.orderItems || []).filter((i) => paidIds.has(i.orderId));
      const names = new Map((data.products || []).map((p) => [p.id, p.name]));
      const gross = sum(paid, "totalCents");
      const refunds = sum(paid, "refundedCents");
      return {
        hasData: orders.length > 0 || (data.products || []).length > 0,
        stats: [metric("Net paid value", formatCurrency(gross - refunds, currency), `${currency.toUpperCase()} paid orders less refunds${otherCurrencies ? ` · ${otherCurrencies} other currency` : ""}`), metric("Paid orders", formatNumber(paidOrders.length), "Selected period"), metric("Average order", formatCurrency(gross / (paid.length || 1), currency), `${currency.toUpperCase()} gross paid value / orders`), metric("Refunded", formatCurrency(refunds, currency), `${currency.toUpperCase()} orders`)],
        charts: [
          { ...area("Paid value", `Gross paid order value by day · ${currency.toUpperCase()}`, days, "Value", byDay(paid, days, "paidAt", (o) => o.totalCents), "currency"), currency },
          { ...rank("Top products", `Paid line item value · ${currency.toUpperCase()}`, groupSum(items, (i) => names.get(i.productId) || i.productName || i.title || "Other", (i) => i.totalCents), "currency"), currency },
          mix("Order status", "Orders created in the selected period", countBy(orders, "status")),
          trend("Order flow", "Created and paid orders by day", days, [{ name: "Created", data: byDay(orders, days, "createdAt") }, { name: "Paid", data: byDay(paidOrders, days, "paidAt") }]),
        ],
      };
    },
  },
  "License Analytics": {
    description: "Monitor issued license value, expiry risk, and licensed content.",
    sources: ["licenses", "licenseItems", "assets"],
    empty: "Issued licenses will appear here once rights are licensed out.",
    build(data, days) {
      const all = data.licenses || [];
      const issuedAll = dated(all.filter((l) => l.issuedAt), days[0], "issuedAt");
      const currency = issuedAll[0]?.currency || "usd";
      const issued = issuedAll.filter((license) => license.currency === currency);
      const otherCurrencies = issuedAll.length - issued.length;
      const now = Date.now();
      const expiring = all.filter((l) => l.status === "active" && l.endDate && new Date(l.endDate).getTime() >= now && new Date(l.endDate).getTime() <= now + 30 * 86400000);
      const active = all.filter((l) => l.status === "active");
      const ids = new Set(issuedAll.map((l) => l.id));
      const names = new Map((data.assets || []).map((a) => [a.id, a.name]));
      const items = (data.licenseItems || []).filter((i) => ids.has(i.licenseId));
      return {
        hasData: all.length > 0,
        stats: [metric("Issued fee value", formatCurrency(sum(issued, "feeCents"), currency), `${currency.toUpperCase()} contracted fees${otherCurrencies ? ` · ${otherCurrencies} other currency` : ""}`), metric("Active licenses", formatNumber(active.length), "Current state"), metric("Expiring in 30 days", formatNumber(expiring.length), "Active licenses"), metric("Issued", formatNumber(issuedAll.length), "Selected period")],
        charts: [
          { ...area("Issued fee trend", `Contracted license fees by issue date · ${currency.toUpperCase()}`, days, "Fees", byDay(issued, days, "issuedAt", (l) => l.feeCents), "currency"), currency },
          rank("Territory mix", "Active licenses by territory", countBy(active.flatMap((l) => (l.territories || []).map((territory) => ({ territory }))), "territory")),
          mix("License status", "All current licenses", countBy(all, "status")),
          rank("Licensed assets", "Asset appearances on licenses issued in period", countBy(items, (i) => names.get(i.assetId) || i.externalTitle)),
        ],
      };
    },
  },
  "Reports & Exports": {
    description: "See saved report coverage and whether scheduled runs are succeeding.",
    sources: ["reports", "reportRuns"],
    empty: "Saved reports and export runs will appear here when configured.",
    build(data, days) {
      const reports = data.reports || [];
      const runs = dated(data.reportRuns || [], days[0], "startedAt");
      const succeeded = runs.filter((r) => r.status === "succeeded");
      return {
        hasData: reports.length > 0 || runs.length > 0,
        stats: [metric("Saved reports", formatNumber(reports.length), "Current library"), metric("Runs", formatNumber(runs.length), "Selected period"), metric("Success rate", formatPercent(succeeded.length / (runs.length || 1)), "Completed successfully"), metric("Scheduled", formatNumber(reports.filter((r) => r.schedule !== "manual" && r.status === "active").length), "Active schedules")],
        charts: [
          trend("Report runs", "Successful and failed runs each day", days, [{ name: "Succeeded", data: byDay(succeeded, days, "startedAt") }, { name: "Failed", data: byDay(runs.filter((r) => r.status === "failed"), days, "startedAt") }]),
          mix("Report sources", "Saved reports by data source", countBy(reports, "source")),
          mix("Run status", "Runs in the selected period", countBy(runs, "status")),
          rank("Report activity", "Runs per saved report", countBy(runs, (r) => reports.find((report) => report.id === r.reportId)?.name || "Removed report")),
        ],
      };
    },
  },
};

export function buildAnalytics(title, data, range) {
  const days = lastDays(Number(range) || 30);
  return ANALYTICS_SCREENS[title].build(data, days);
}
