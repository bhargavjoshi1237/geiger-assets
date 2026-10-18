// Galleries domain: showcase galleries and their items, custom domains, and the
// audience side — visitors, favourites, download requests and view events.

import { personId } from "../cast";
import { base, daysAgo, sid, noise } from "./helpers";

const GALLERIES = [
  // [n, slug, name, headline, collection, cover, layout, accent, visibility, download, status, email, assets]
  [1, "spring-2026", "Spring 2026", "A season in bloom", 1, 4, "masonry", "#10b981", "public", "request", "published", false, [4, 5, 6, 7, 8, 12]],
  [2, "brand-essentials", "Brand essentials", "Everything you need to represent Halcyon", 2, 15, "grid", "#6366f1", "unlisted", "open", "published", true, [1, 2, 3, 15, 16, 17]],
  [3, "aurora-lamp", "Aurora lamp press", "Light, reimagined", 3, 11, "justified", "#f59e0b", "public", "open", "published", false, [11, 12, 34]],
  [4, "holiday-2025", "Holiday 2025", "Last season's story", 6, 9, "slideshow", "#ef4444", "private", "off", "unpublished", false, [9, 10]],
  [5, "nova-chair-preview", "Nova chair preview", "Coming soon", 3, 13, "single", "#0ea5e9", "private", "off", "draft", false, [13, 14]],
];

function galleryRows() {
  const galleries = [];
  const items = [];
  let itemN = 1;
  for (const [n, slug, name, headline, collection, cover, layout, accent, visibility, download, status, email, assetNs] of GALLERIES) {
    galleries.push({
      ...base("gallery", n, { created: 50 - n * 6, updated: n }),
      slug,
      name,
      headline,
      description: `${name} — curated by the Halcyon brand team.`,
      source_kind: "curated",
      collection_id: sid("collection", collection),
      cover_asset_id: sid("asset", cover),
      layout,
      theme: { accent, ground: n === 2 ? "light" : "dark", typography: n === 3 ? "serif" : "sans", gap: "comfortable", radius: "rounded", caption: "below" },
      nav: [
        { label: "About", href: "https://halcyon.studio/about" },
        { label: "Contact", href: "mailto:press@halcyon.studio" },
      ],
      visibility,
      password_hash: visibility === "private" && n === 4 ? "playground" : null,
      require_email: email,
      download_mode: download,
      allow_favorites: status === "published",
      seo: { title: `${name} · Halcyon Studio`, description: headline },
      status,
      published_at: status === "draft" ? null : daysAgo(40 - n * 6),
      expires_at: null,
      created_by: personId(2),
    });
    assetNs.forEach((an, position) => {
      items.push({
        ...base("gallery_item", itemN++, { created: 40 - n * 6 }),
        gallery_id: sid("gallery", n),
        asset_id: sid("asset", an),
        position,
        caption: position === 0 ? headline : "",
        is_hidden: false,
        created_by: personId(2),
      });
    });
  }
  return { galleries, items };
}

function domainRows() {
  return [
    [1, 1, "spring.halcyon.studio", "subdomain", "active", "issued", true],
    [2, 2, "brand.halcyon.studio", "subdomain", "active", "issued", true],
    [3, 3, "press.auroralamp.com", "custom", "verifying", "pending", false],
    [4, 1, "bloom.example.com", "custom", "failed", "error", false],
  ].map(([n, gallery, hostname, kind, status, ssl, primary]) => ({
    ...base("gallery_domain", n, { created: 30 - n * 3 }),
    gallery_id: sid("gallery", gallery),
    hostname,
    kind,
    verification_token: `geiger-verify-${n}a7f3c`,
    dns_record_type: kind === "custom" ? "CNAME" : "TXT",
    dns_record_name: kind === "custom" ? hostname : `_geiger.${hostname}`,
    dns_record_value: kind === "custom" ? "galleries.geiger.studio" : `geiger-verify-${n}a7f3c`,
    status,
    ssl_status: ssl,
    is_primary: primary,
    verified_at: status === "active" ? daysAgo(20) : null,
    created_by: personId(1),
  }));
}

const VISITORS = [
  [1, "Erin Walsh", "erin@northwind-outdoor.example", 1],
  [2, "Theo Park", "theo@tesseramag.com", 3],
  [3, "Priya Shah", "priya@channelnine.tv", 2],
  [4, "Lucía Ferrer", "lucia@solacehotels.example", 1],
  [5, "Anonymous visitor", "", 1],
  [6, "Sam Carter", "sam@brightline.agency", 2],
];

function audienceRows() {
  const visitors = VISITORS.map(([n, name, email, gallery]) => ({
    ...base("visitor", n, { created: 20 - n }),
    gallery_id: sid("gallery", gallery),
    token: `visitor-token-${n}`,
    name,
    email,
    first_seen_at: daysAgo(20 - n),
    last_seen_at: daysAgo(Math.max(0, 4 - n), n),
  }));

  const favorites = [
    [1, 1, 1, 4], [2, 1, 1, 6], [3, 4, 1, 4], [4, 2, 3, 11], [5, 3, 2, 15], [6, 6, 2, 1],
  ].map(([n, visitor, gallery, asset]) => ({
    ...base("favorite", n, { created: 5 - (n % 4) }),
    gallery_id: sid("gallery", gallery),
    visitor_id: sid("visitor", visitor),
    asset_id: sid("asset", asset),
  }));

  const requests = [
    [1, 1, 1, "selection", [4, 6], "pending", "For the retail window refresh.", null],
    [2, 4, 1, "gallery", [], "approved", "Planning the spring OOH flight.", "Approved for OOH use only."],
    [3, 5, 1, "asset", [5], "denied", "", "Still in review — not cleared yet."],
    [4, 6, 2, "selection", [1, 3], "pending", "Need logos for the partner deck.", null],
  ].map(([n, visitor, gallery, scope, assetNs, status, message, note]) => ({
    ...base("download_request", n, { created: 6 - n }),
    gallery_id: sid("gallery", gallery),
    visitor_id: sid("visitor", visitor),
    scope,
    asset_ids: assetNs.map((an) => sid("asset", an)),
    message,
    status,
    decision_note: note ?? "",
    decided_by: status === "pending" ? null : personId(2),
    decided_at: status === "pending" ? null : daysAgo(2),
  }));

  // Thirty days of view traffic across the published galleries.
  const events = [];
  let eventN = 1;
  const kinds = ["view", "view", "view", "item_view", "item_view", "favorite", "download"];
  for (let d = 0; d < 30; d += 1) {
    const perDay = 2 + Math.round(noise(d) * 5);
    for (let i = 0; i < perDay; i += 1) {
      const gallery = 1 + ((d + i) % 3);
      const visitor = 1 + ((d * 3 + i) % VISITORS.length);
      const kind = kinds[Math.floor(noise(d * 13 + i) * kinds.length)];
      const assetPool = GALLERIES[gallery - 1][12];
      events.push({
        ...base("gallery_event", eventN++, { created: d }),
        gallery_id: sid("gallery", gallery),
        visitor_id: sid("visitor", visitor),
        asset_id: kind === "view" ? null : sid("asset", assetPool[i % assetPool.length]),
        kind,
        occurred_at: daysAgo(d, i * 2),
      });
    }
  }

  return { visitors, favorites, requests, events };
}

export function galleriesSeed() {
  const { galleries, items } = galleryRows();
  const audience = audienceRows();
  return {
    galleries,
    gallery_items: items,
    gallery_domains: domainRows(),
    gallery_visitors: audience.visitors,
    gallery_favorites: audience.favorites,
    gallery_download_requests: audience.requests,
    gallery_events: audience.events,
  };
}

