// Creator monetization domain: membership tiers, members and subscriptions,
// pay-per-view posts, paid messages, tips, payouts and promo codes.

import { personId } from "../cast";
import { base, daysAgo, daysFromNow, dateOnly, sid, noise } from "./helpers";

function tierRows() {
  return [
    [1, "Free follower", "Public posts and monthly newsletter.", 0, "month", true, ["Public posts", "Monthly newsletter"]],
    [2, "Supporter", "Behind-the-scenes and early access.", 500, "month", false, ["Behind-the-scenes", "Early access", "Supporter badge"]],
    [3, "Studio pass", "Full-res downloads and monthly presets.", 1500, "month", false, ["Full-res downloads", "Monthly presets", "Discord access"]],
    [4, "Collector", "Annual pass with a signed print.", 12000, "year", false, ["Everything in Studio pass", "Signed annual print", "1:1 portfolio review"]],
  ].map(([n, name, description, price, interval, free, perks], i) => ({
    ...base("tier", n, { created: 200 - n * 10 }),
    name,
    description,
    price_cents: price,
    currency: "usd",
    interval,
    is_free: free,
    is_active: true,
    position: i,
    perks,
    stripe_price_id: free ? null : `price_playground_${n}`,
    created_by: personId(1),
  }));
}

const FANS = [
  "Olivia Grant", "Marcus Lee", "Hana Suzuki", "Diego Alvarez", "Chloe Martin", "Ethan Brooks",
  "Zara Ahmed", "Jules Moreau", "Aisha Bello", "Finn O'Connor", "Isla Novak", "Mateo Rossi",
  "Grace Kim", "Leo Fischer", "Nia Okafor", "Oscar Lind",
];

function memberRows() {
  const statuses = ["active", "active", "active", "trialing", "active", "past_due", "active", "cancelled"];
  const members = FANS.map((name, i) => {
    const n = i + 1;
    return {
      ...base("member", n, { created: 180 - n * 9, updated: n % 7 }),
      fan_name: name,
      fan_email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      status: statuses[i % statuses.length],
      total_spent_cents: Math.round(noise(n) * 42000) + 500,
      last_seen_at: daysAgo(n % 9, n),
      created_by: personId(1),
    };
  });
  const subscriptions = members.map((m, i) => {
    const n = i + 1;
    const tier = 1 + (n % 4);
    const status = m.status === "trialing" ? "trialing" : m.status === "past_due" ? "past_due" : m.status === "cancelled" ? "cancelled" : "active";
    const start = n % 28;
    return {
      ...base("subscription", n, { created: 180 - n * 9 }),
      member_id: m.id,
      tier_id: sid("tier", tier),
      status,
      current_period_start: daysAgo(start),
      current_period_end: daysFromNow(tier === 4 ? 365 - start : 30 - start),
      trial_end: status === "trialing" ? daysFromNow(7) : null,
      cancel_at_period_end: n % 9 === 0,
      created_by: personId(1),
    };
  });
  return { members, subscriptions };
}

function ppvRows() {
  return [
    [1, "Spring shoot — full contact sheet", "Every frame from the meadow day, unedited.", 4, 900, "published", 64],
    [2, "Colour grading masterclass", "45-minute walkthrough of the brand grade.", 18, 2400, "published", 38],
    [3, "Aurora lamp — lighting breakdown", "How the product lighting was built.", 12, 600, "published", 91],
    [4, "Holiday outtakes", "The ones that didn't make the campaign.", 9, 500, "archived", 120],
    [5, "Nova chair first look", "Draft — publish at launch.", 13, 700, "draft", 0],
    [6, "Welcome to the studio", "Who I am, what I shoot, and what members get.", 4, 0, "published", 0, "public", null, true],
    [7, "Monthly preset pack — April", "Five grades from this month's shoots.", 7, 0, "published", 0, "members"],
    [8, "Full-res spring selects", "Twenty print-ready files from the meadow day.", 6, 0, "published", 0, "tier", 3],
  ].map(([n, title, teaser, asset, price, status, unlocks, visibility = "ppv", minTier = null, pinned = false]) => ({
    ...base("ppv", n, { created: 60 - n * 8, updated: n }),
    title,
    teaser_text: teaser,
    asset_id: sid("asset", asset),
    price_cents: price,
    currency: "usd",
    status,
    unlock_count: unlocks,
    revenue_cents: unlocks * price,
    published_at: status === "draft" ? null : daysAgo(Math.max(1, 55 - n * 8)),
    visibility,
    min_tier_id: minTier ? sid("tier", minTier) : null,
    body: visibility === "ppv" ? "" : `${teaser} Full notes inside.`,
    is_pinned: pinned,
    asset_ids: [asset, asset + 1, asset + 2].map((a) => sid("asset", a)),
    like_count: status === "published" ? 12 + n * 7 : 0,
    comment_count: status === "published" && n % 2 === 0 ? 2 : 0,
    created_by: personId(1),
  }));
}

function messageRows() {
  return [
    [1, 1, "Here's the uncut sequence from Tuesday 🎞️", 20, 800, "unlocked", 2],
    [2, 3, "Exclusive preset pack — spring grade.", null, 1200, "locked", 1],
    [3, 5, "Thanks for being a Collector! Your print ships Friday.", null, 0, "unlocked", 4],
    [4, 7, "Private link to the lamp shoot BTS.", 21, 500, "locked", 0],
    [5, 2, "Draft: holiday recap for supporters.", null, 300, "draft", 0],
    [6, 9, "Last chance for the holiday outtakes bundle.", 9, 700, "expired", 30],
  ].map(([n, member, body, attachment, price, status, days]) => ({
    ...base("message", n, { created: days + 1, updated: days }),
    member_id: sid("member", member),
    batch_id: null,
    body,
    attachment_asset_id: attachment ? sid("asset", attachment) : null,
    price_cents: price,
    currency: "usd",
    status,
    sent_at: status === "draft" ? null : daysAgo(days),
    unlocked_at: status === "unlocked" ? daysAgo(Math.max(0, days - 1)) : null,
    direction: "outbound",
    read_at: status === "unlocked" ? daysAgo(Math.max(0, days - 1)) : null,
    created_by: personId(1),
  })).concat(
    [
      [7, 1, "That sequence is unreal — any chance of the raw files?", 1.5, true],
      [8, 3, "Loving the preset pack, thank you!", 0.4, false],
      [9, 5, "Print arrived, it's framed already 🖼️", 3, true],
    ].map(([n, member, body, days, read]) => ({
      ...base("message", n, { created: days, updated: days }),
      member_id: sid("member", member),
      batch_id: null,
      body,
      attachment_asset_id: null,
      price_cents: 0,
      currency: "usd",
      status: "unlocked",
      sent_at: daysAgo(days),
      unlocked_at: null,
      direction: "inbound",
      read_at: read ? daysAgo(days * 0.5) : null,
      created_by: null,
    })),
  );
}

function tipRows() {
  const notes = ["Love the spring series!", "For the presets 🙏", "", "Keep it up", "That lamp shot 🔥", "", "Thank you for the review", ""];
  return Array.from({ length: 18 }, (_, i) => {
    const n = i + 1;
    return {
      id: sid("tip", n),
      project_id: base("tip", n).project_id,
      member_id: sid("member", 1 + (n % FANS.length)),
      target_type: ["profile", "post", "message", "stream"][n % 4],
      target_id: n % 4 === 1 ? sid("ppv", 1 + (n % 3)) : null,
      amount_cents: [300, 500, 1000, 2000, 500, 1500][n % 6],
      currency: "usd",
      note: notes[n % notes.length],
      status: n % 11 === 0 ? "refunded" : n % 13 === 0 ? "pending" : "succeeded",
      created_at: daysAgo(n * 1.6, n),
      metadata: {},
    };
  });
}

function payoutRows() {
  return [
    [1, -90, -61, 248000, "paid"],
    [2, -60, -31, 291500, "paid"],
    [3, -30, -1, 334200, "processing"],
    [4, 0, 29, 118900, "pending"],
  ].map(([n, start, end, gross, status]) => {
    const fees = Math.round(gross * 0.08);
    return {
      ...base("payout", n, { created: Math.max(0, -end) }),
      period_start: dateOnly(start >= 0 ? daysFromNow(start) : daysAgo(-start)),
      period_end: dateOnly(end >= 0 ? daysFromNow(end) : daysAgo(-end)),
      gross_cents: gross,
      fees_cents: fees,
      net_cents: gross - fees,
      status,
      destination: "Bank •••• 4821",
      paid_at: status === "paid" ? daysAgo(-end - 3) : null,
      created_by: personId(1),
    };
  });
}

function promoRows() {
  return [
    [1, "SPRING25", "discount", 25, null, 3, 200, 86, 20, true],
    [2, "TRYSTUDIO", "trial", null, null, 1, 500, 212, 60, true],
    [3, "COLLECTOR10", "discount", null, 1000, 1, 50, 11, 90, true],
    [4, "FREEMONTH", "free_month", null, null, 1, 100, 100, -5, false],
    [5, "HOLIDAY40", "discount", 40, null, 2, 300, 244, -60, false],
  ].map(([n, code, kind, percent, amount, months, max, redeemed, expires, active]) => ({
    ...base("promo", n, { created: 70 - n * 8 }),
    code,
    kind,
    percent_off: percent,
    amount_off_cents: amount,
    duration_months: months,
    max_redemptions: max,
    redeemed_count: redeemed,
    expires_at: expires > 0 ? daysFromNow(expires) : daysAgo(-expires),
    is_active: active,
    created_by: personId(1),
  }));
}

function accessRuleRows() {
  return [
    [1, "Studio pass — spring gallery", "gallery", sid("gallery", 1), "Spring 2026", 3, "paywall", "full_res", true, true, true, "Welcome back — full-res downloads are unlocked for your tier.", true],
    [2, "Supporters — behind the scenes", "collection", sid("collection", 1), "Spring 2026 launch", 2, "login", "standard", true, false, true, "", true],
    [3, "Collector archive", "folder", sid("folder", 6), "/Campaigns/Holiday 2025", 4, "paywall", "full_res", true, true, true, "", true],
    [4, "Public teaser — Aurora press", "gallery", sid("gallery", 3), "Aurora lamp press", 1, "preview", "preview", false, false, false, "Join free to see the full set.", true],
    [5, "Packshots for members", "collection", sid("collection", 3), "Product packshots", 2, "login", "standard", false, false, true, "", false],
  ].map(([n, name, targetType, targetId, label, tier, gate, level, download, watermark, metadata, welcome, active]) => ({
    ...base("access_rule", n, { created: 90 - n * 12, updated: n * 2 }),
    name,
    target_type: targetType,
    target_id: targetId,
    target_label: label,
    min_tier_id: sid("tier", tier),
    gate,
    access_level: level,
    allow_download: download,
    bypass_watermark: watermark,
    show_metadata: metadata,
    welcome_message: welcome,
    is_active: active,
    created_by: personId(1),
  }));
}

const TIER_PRICES = { 1: 0, 2: 500, 3: 1500, 4: 12000 };

// Renewal history per paid subscription: a couple of settled cycles, then the
// current cycle's state follows the subscription (failed while past due, open
// while trialing).
function invoiceRows(subscriptions) {
  const rows = [];
  let n = 0;
  subscriptions.forEach((sub, i) => {
    const tier = 1 + ((i + 1) % 4);
    const amount = TIER_PRICES[tier];
    if (!amount) return;
    const cycle = tier === 4 ? 365 : 30;
    const cycles = sub.status === "trialing" ? 0 : 2;
    for (let c = cycles; c >= 0; c -= 1) {
      n += 1;
      const current = c === 0;
      const status = !current
        ? "paid"
        : sub.status === "past_due"
          ? "failed"
          : sub.status === "trialing"
            ? "open"
            : sub.status === "cancelled"
              ? "void"
              : "paid";
      const issued = (i % 28) + c * cycle;
      rows.push({
        ...base("invoice", n, { created: issued, updated: Math.max(0, issued - 1) }),
        number: `INV-${String(1000 + n)}`,
        member_id: sub.member_id,
        subscription_id: sub.id,
        tier_id: sub.tier_id,
        amount_cents: amount,
        currency: "usd",
        status,
        period_start: daysAgo(issued),
        period_end: daysFromNow(cycle - issued),
        due_at: daysAgo(issued),
        paid_at: status === "paid" ? daysAgo(Math.max(0, issued - 1)) : null,
        attempt_count: status === "failed" ? 2 : status === "paid" ? 1 : 0,
        next_retry_at: status === "failed" ? daysFromNow(2) : null,
        created_by: personId(1),
      });
    }
  });
  return rows;
}

function creatorProfileRows() {
  return [
    {
      ...base("creator_profile", 1, { created: 200 }),
      handle: "halcyon-studio",
      display_name: "Halcyon Studio",
      tagline: "Photographer · weekly behind-the-scenes drops",
      bio: "Campaign and product photography. Members get full-res downloads, monthly presets and first look at every shoot.",
      avatar_asset_id: sid("asset", 1),
      banner_asset_id: sid("asset", 4),
      accent_color: "#f97316",
      links: [{ label: "Portfolio", url: "https://example.com" }],
      is_published: true,
      tips_enabled: true,
      min_tip_cents: 100,
      suggested_tips: [300, 500, 1000, 2500],
      messages_enabled: true,
      welcome_message: "Thanks for joining — drops land here first.",
      created_by: personId(1),
    },
  ];
}

function bundleRows() {
  return [
    {
      ...base("bundle", 1, { created: 20 }),
      title: "Spring shoot — everything",
      description: "The contact sheet, the grading masterclass and the lighting breakdown in one go.",
      price_cents: 2900,
      currency: "usd",
      post_ids: [1, 2, 3].map((n) => sid("ppv", n)),
      cover_asset_id: sid("asset", 5),
      is_active: true,
      sales_count: 14,
      revenue_cents: 14 * 2900,
      created_by: personId(1),
    },
  ];
}

function commentRows() {
  return [
    [1, 6, 2, "Olivia Grant", "So glad I joined — the BTS posts are the best part.", false],
    [2, 6, null, "Halcyon Studio", "Thank you Olivia! More coming this week.", true],
    [3, 8, 4, "Diego Alvarez", "These prints are going straight on my wall.", false],
    [4, 8, 7, "Jules Moreau", "Which lens was the meadow set shot on?", false],
  ].map(([n, post, member, author, body, creator]) => ({
    ...base("comment", n, { created: 6 - n, updated: 6 - n }),
    post_id: sid("ppv", post),
    fan_account_id: null,
    member_id: member ? sid("member", member) : null,
    author_name: author,
    is_creator: creator,
    body,
    is_hidden: false,
  }));
}

export function creatorSeed() {
  const { members, subscriptions } = memberRows();
  return {
    membership_tiers: tierRows(),
    members,
    subscriptions,
    ppv_posts: ppvRows(),
    ppv_unlocks: [],
    paid_messages: messageRows(),
    tips: tipRows(),
    payouts: payoutRows(),
    promo_codes: promoRows(),
    promo_redemptions: [],
    access_rules: accessRuleRows(),
    billing_invoices: invoiceRows(subscriptions),
    creator_profiles: creatorProfileRows(),
    message_unlocks: [],
    post_bundles: bundleRows(),
    post_comments: commentRows(),
    post_likes: [],
    post_bookmarks: [],
  };
}
