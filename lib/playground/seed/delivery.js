// Delivery & platform domain: CDN profile and domains, dynamic image links,
// video delivery, embeds, delivery keys, publishing channels, delivery traffic
// (events + daily rollup), API keys, webhooks and data exports.

import { DEFAULT_LADDER } from "@/components/internal/screens/projects/delivery/constants";
import { personId } from "../cast";
import { PROJECT_ID, base, daysAgo, daysFromNow, dateOnly, sid, noise } from "./helpers";

const GB = 1024 * 1024 * 1024;
const COUNTRIES = ["US", "GB", "DE", "FR", "JP", "CA", "AU", "NL"];
const REFERRERS = ["halcyon.studio", "northwind-outdoor.example", "tesseramag.com", "instagram.com", "news.ycombinator.com", ""];

function profileRows() {
  return [
    {
      ...base("delivery_profile", 1, { created: 120, updated: 6 }),
      cache_ttl_seconds: 86400,
      origin_protection: "signed",
      allowed_referrers: ["halcyon.studio", "*.halcyon.studio", "northwind-outdoor.example"],
      format_negotiation: true,
      status: "active",
      created_by: personId(1),
    },
  ];
}

function deliveryDomainRows() {
  return [
    [1, "cdn.halcyon.studio", "custom", "active", "issued", true],
    [2, "halcyon-brand.geiger.app", "subdomain", "active", "issued", false],
    [3, "media.northwind-outdoor.example", "custom", "verifying", "pending", false],
  ].map(([n, hostname, kind, status, ssl, primary]) => ({
    ...base("delivery_domain", n, { created: 90 - n * 10 }),
    gallery_id: null,
    hostname,
    kind,
    verification_token: `geiger-cdn-${n}b19e`,
    dns_record_type: kind === "custom" ? "CNAME" : "TXT",
    dns_record_name: hostname,
    dns_record_value: kind === "custom" ? "edge.geiger.studio" : `geiger-cdn-${n}b19e`,
    status,
    ssl_status: ssl,
    is_primary: primary,
    verified_at: status === "active" ? daysAgo(60) : null,
    created_by: personId(1),
  }));
}

function dynamicLinkRows() {
  return [
    [1, "Homepage hero", "hero-home", 4, { w: 1920, h: "", fit: "cover", format: "auto", quality: 82, dpr: 2, breakpoints: [640, 1024, 1920] }, true, "active"],
    [2, "Product card — aurora", "card-aurora", 11, { w: 600, h: 750, fit: "cover", format: "webp", quality: 80, dpr: 2, breakpoints: [300, 600] }, false, "active"],
    [3, "Partner logo", "partner-logo", 1, { w: 480, h: "", fit: "contain", format: "png", quality: 90, dpr: 1, breakpoints: [240, 480] }, false, "active"],
    [4, "Newsletter banner", "newsletter", 6, { w: 1200, h: 400, fit: "cover", format: "jpg", quality: 75, dpr: 1, breakpoints: [600, 1200] }, false, "paused"],
    [5, "Holiday OOH preview", "holiday-ooh", 9, { w: 2400, h: "", fit: "inside", format: "avif", quality: 70, dpr: 1, breakpoints: [1200, 2400] }, true, "expired"],
  ].map(([n, name, token, asset, transform, signed, status]) => ({
    ...base("dynamic_link", n, { created: 60 - n * 7, updated: n }),
    name,
    token: `dl_${token}`,
    asset_id: sid("asset", asset),
    transform,
    signed,
    expires_at: status === "expired" ? daysAgo(10) : null,
    status,
    created_by: personId(3),
  }));
}

function videoRows() {
  return [
    [1, 18, "hls", DEFAULT_LADDER, 4, [{ lang: "en", label: "English", url: "https://cdn.halcyon.studio/captions/brand-film.en.vtt", is_default: true }, { lang: "de", label: "Deutsch", url: "https://cdn.halcyon.studio/captions/brand-film.de.vtt", is_default: false }], true, "ready"],
    [2, 19, "hls", DEFAULT_LADDER.slice(1), 5, [{ lang: "en", label: "English", url: "https://cdn.halcyon.studio/captions/cutdown.en.vtt", is_default: true }], false, "processing"],
    [3, 21, "progressive", [], 12, [], false, "ready"],
    [4, 20, "dash", DEFAULT_LADDER.slice(2), null, [], false, "draft"],
  ].map(([n, asset, mode, ladder, poster, captions, signed, status]) => ({
    ...base("video", n, { created: 30 - n * 4, updated: n }),
    asset_id: sid("asset", asset),
    streaming_mode: mode,
    ladder,
    poster_asset_id: poster ? sid("asset", poster) : null,
    captions,
    signed,
    player: { autoplay: false, muted: false, loop: n === 3, controls: true },
    status,
    created_by: personId(3),
  }));
}

function embedRows() {
  return [
    [1, "Brand film on homepage", "video", "asset", 18, "latest", { width: 1280, height: 720 }, "active"],
    [2, "Aurora lamp product image", "img", "asset", 11, "pinned", { width: 800, height: 1000 }, "active"],
    [3, "Spring gallery iframe", "iframe", "gallery", null, "latest", { width: 1200, height: 800 }, "active"],
    [4, "Press kit link", "url", "collection", null, "latest", { width: 800, height: 450 }, "paused"],
    [5, "Lookbook oEmbed", "oembed", "asset", 37, "pinned", { width: 800, height: 450 }, "revoked"],
  ].map(([n, name, kind, subjectKind, asset, versionMode, params, status]) => ({
    ...base("embed", n, { created: 45 - n * 5, updated: n }),
    name,
    kind,
    subject_kind: subjectKind,
    subject_id:
      subjectKind === "asset" ? sid("asset", asset) : subjectKind === "gallery" ? sid("gallery", 1) : sid("collection", 5),
    version_mode: versionMode,
    params,
    status,
    created_by: personId(4),
  }));
}

function deliveryKeyRows() {
  return [
    [1, "Website (production)", "gdk_live_7Hq2", ["assets:read", "delivery:read"], 0, null],
    [2, "Mobile app", "gdk_live_Kp9x", ["assets:read", "embeds:read"], 1, null],
    [3, "Old CMS integration", "gdk_live_Zt4m", ["assets:read"], 40, 12],
  ].map(([n, name, prefix, scopes, lastUsed, revoked]) => ({
    ...base("delivery_key", n, { created: 100 - n * 10 }),
    name,
    prefix,
    key_hash: `hash_${prefix}`,
    scopes,
    last_used_at: daysAgo(lastUsed, 2),
    revoked_at: revoked ? daysAgo(revoked) : null,
    created_by: personId(1),
  }));
}

function channelRows() {
  const channels = [
    [1, "Shopify storefront", "ecommerce", "collection", sid("collection", 3), "hourly", "active"],
    [2, "Contentful website", "cms", "collection", sid("collection", 1), "daily", "active"],
    [3, "Akeneo PIM", "pim", "folder", sid("folder", 8), "daily", "paused"],
    [4, "Instagram — brand", "social", "collection", sid("collection", 1), "manual", "active"],
    [5, "HubSpot campaigns", "marketing", "collection", sid("collection", 5), "weekly", "draft"],
  ].map(([n, name, kind, sourceKind, sourceId, schedule, status]) => ({
    ...base("channel", n, { created: 70 - n * 8, updated: n }),
    name,
    kind,
    source_kind: sourceKind,
    source_id: sourceId,
    schedule,
    status,
    created_by: personId(3),
  }));
  const runs = [];
  let runN = 1;
  for (const channel of channels.filter((c) => c.status !== "draft")) {
    for (let i = 0; i < 6; i += 1) {
      const failed = noise(runN) > 0.82;
      const running = i === 0 && channel.kind === "ecommerce";
      const published = Math.round(4 + noise(runN * 3) * 20);
      runs.push({
        ...base("channel_run", runN, { created: i }),
        channel_id: channel.id,
        started_at: daysAgo(i, 1),
        finished_at: running ? null : daysAgo(i, 0.9),
        status: running ? "running" : failed ? "failed" : "succeeded",
        published_count: failed ? Math.round(published / 3) : published,
        failed_count: failed ? 2 + (runN % 3) : 0,
        error: failed ? "Rate limited by the destination API (429)." : null,
      });
      runN += 1;
    }
  }
  return { channels, runs };
}

function trafficRows() {
  const approvedAssets = [1, 2, 3, 4, 6, 9, 11, 12, 15, 16, 18, 21, 25];
  const daily = [];
  let dailyN = 1;
  for (let d = 0; d < 30; d += 1) {
    const trend = 1 + (30 - d) / 40;
    const dayRows = [];
    for (const an of approvedAssets) {
      const requests = Math.round((80 + noise(d * 31 + an) * 900) * trend * (an === 4 || an === 18 ? 3 : 1));
      const hits = Math.round(requests * (0.86 + noise(d + an) * 0.12));
      const countries = {};
      COUNTRIES.forEach((c, i) => {
        countries[c] = Math.round(requests * (i === 0 ? 0.38 : 0.62 / (COUNTRIES.length - 1)) * (0.8 + noise(d + i) * 0.4));
      });
      dayRows.push({
        id: sid("delivery_daily", dailyN++),
        project_id: PROJECT_ID,
        day: dateOnly(daysAgo(d)),
        asset_id: sid("asset", an),
        requests,
        bytes: Math.round(requests * (an === 18 || an === 21 ? 24 : 0.6) * 1024 * 1024),
        hits,
        misses: requests - hits,
        countries,
        created_at: daysAgo(d),
        updated_at: daysAgo(d),
        metadata: {},
      });
    }
    // The project-level rollup (asset_id null) the analytics totals read.
    const sum = (key) => dayRows.reduce((total, row) => total + row[key], 0);
    const countries = {};
    for (const row of dayRows) {
      for (const [c, n] of Object.entries(row.countries)) countries[c] = (countries[c] || 0) + n;
    }
    daily.push(...dayRows, {
      ...dayRows[0],
      id: sid("delivery_daily", dailyN++),
      asset_id: null,
      requests: sum("requests"),
      bytes: sum("bytes"),
      hits: sum("hits"),
      misses: sum("misses"),
      countries,
    });
  }

  const events = [];
  const kinds = ["file", "file", "dynamic", "dynamic", "video", "embed"];
  for (let i = 0; i < 160; i += 1) {
    const kind = kinds[i % kinds.length];
    const an = approvedAssets[Math.floor(noise(i * 7) * approvedAssets.length)];
    const cache = noise(i * 11) > 0.12 ? "hit" : noise(i) > 0.5 ? "miss" : "revalidated";
    events.push({
      ...base("delivery_event", i + 1, { created: 0 }),
      asset_id: sid("asset", an),
      link_id: kind === "dynamic" ? sid("dynamic_link", 1 + (i % 3)) : null,
      embed_id: kind === "embed" ? sid("embed", 1 + (i % 2)) : null,
      kind,
      bytes: Math.round((kind === "video" ? 18 : 0.4 + noise(i) * 2) * 1024 * 1024),
      cache_status: cache,
      status_code: noise(i * 5) > 0.97 ? 404 : 200,
      country: COUNTRIES[Math.floor(noise(i * 3) * COUNTRIES.length)],
      referrer_host: REFERRERS[i % REFERRERS.length],
      transform: kind === "dynamic" ? { w: 1200, format: "webp", quality: 80 } : null,
      occurred_at: new Date(Date.now() - i * 9 * 60 * 1000).toISOString(),
    });
  }
  return { daily, events };
}

function platformRows() {
  const apiKeys = [
    [1, "Website build (Next.js)", "gk_live_4fQ1", ["assets:read", "collections:read", "tags:read"], 0, null, null],
    [2, "Upload automation", "gk_live_9aZr", ["assets:write", "upload:write", "folders:read"], 1, 180, null],
    [3, "Analytics export", "gk_live_2mPx", ["assets:read"], 9, null, null],
    [4, "Legacy DAM sync", "gk_live_7uWd", ["assets:read", "assets:write"], 60, null, 20],
  ].map(([n, name, prefix, scopes, lastUsed, expires, revoked]) => ({
    ...base("api_key", n, { created: 150 - n * 20 }),
    name,
    prefix,
    key_hash: `hash_${prefix}`,
    scopes,
    last_used_at: daysAgo(lastUsed, 3),
    expires_at: expires ? daysFromNow(expires) : null,
    revoked_at: revoked ? daysAgo(revoked) : null,
    created_by: personId(1),
  }));

  const endpoints = [
    [1, "Slack — #assets", "https://hooks.slack.com/services/T000/B000/playground", "Post new uploads and approvals to Slack.", ["asset.created", "upload.completed"], "active"],
    [2, "Website rebuild", "https://api.vercel.com/v1/integrations/deploy/playground", "Rebuild the marketing site when a gallery goes live.", ["gallery.published", "collection.updated"], "active"],
    [3, "ERP sync", "https://erp.example.com/hooks/geiger", "Mirror asset metadata into the ERP.", ["asset.updated", "asset.deleted"], "paused"],
  ].map(([n, name, url, description, events, status]) => ({
    ...base("webhook", n, { created: 80 - n * 10 }),
    name,
    url,
    description,
    events,
    status,
    signing_secret: `whsec_playground_${n}`,
    created_by: personId(1),
  }));

  const deliveries = [];
  for (let i = 0; i < 24; i += 1) {
    const endpoint = endpoints[i % 2];
    const failed = noise(i * 23) > 0.85;
    deliveries.push({
      id: sid("webhook_delivery", i + 1),
      project_id: PROJECT_ID,
      endpoint_id: endpoint.id,
      event: endpoint.events[i % endpoint.events.length],
      payload: { id: sid("asset", 1 + (i % 20)), project_id: PROJECT_ID },
      status: failed ? "failed" : "delivered",
      attempt_count: failed ? 3 : 1,
      response_code: failed ? 502 : 200,
      error: failed ? "Bad gateway from the receiving endpoint." : null,
      duration_ms: Math.round(80 + noise(i) * 400),
      created_at: new Date(Date.now() - i * 3 * 60 * 60 * 1000).toISOString(),
      metadata: {},
    });
  }

  const exports = [
    [1, "csv", "project", null, "Entire project", "completed", 41, 0.004],
    [2, "zip", "collection", sid("collection", 5), "Press kit", "completed", 5, 0.19],
    [3, "json", "folder", sid("folder", 8), "/Product/Photography", "completed", 5, 0.001],
    [4, "zip", "collection", sid("collection", 1), "Spring 2026 launch", "failed", 0, 0],
  ].map(([n, format, scopeType, scopeId, label, status, files, gb]) => ({
    id: sid("export", n),
    project_id: PROJECT_ID,
    format,
    scope_type: scopeType,
    scope_id: scopeId,
    scope_label: label,
    options: { includeMetadata: true, includeVersions: format === "zip" },
    status,
    file_count: files,
    total_bytes: Math.round(gb * GB),
    error: status === "failed" ? "Export exceeded the 5 GB archive limit." : null,
    created_by: personId(1 + n),
    created_at: daysAgo(n * 3),
    metadata: {},
  }));

  const settings = [
    {
      ...base("settings", 2, { created: 120 }),
      transforms_enabled: true,
      delivery_default_enabled: true,
      max_width: 4000,
      max_height: 4000,
      max_megapixels: 25,
      allowed_formats: ["auto", "webp", "avif", "jpg", "png"],
      allowed_effects: ["blur", "grayscale", "sharpen"],
      referrer_allowlist: ["halcyon.studio", "northwind-outdoor.example"],
      require_signed_urls: false,
      signing_secret: "",
    },
  ];

  return { apiKeys, endpoints, deliveries, exports, settings };
}

export function deliverySeed() {
  const { channels, runs } = channelRows();
  const traffic = trafficRows();
  const platform = platformRows();
  return {
    delivery_profiles: profileRows(),
    delivery_domains: deliveryDomainRows(),
    dynamic_links: dynamicLinkRows(),
    video_delivery: videoRows(),
    embeds: embedRows(),
    delivery_keys: deliveryKeyRows(),
    channels,
    channel_runs: runs,
    delivery_daily: traffic.daily,
    delivery_events: traffic.events,
    delivery_settings: platform.settings,
    api_keys: platform.apiKeys,
    webhook_endpoints: platform.endpoints,
    webhook_deliveries: platform.deliveries,
    export_runs: platform.exports,
  };
}
