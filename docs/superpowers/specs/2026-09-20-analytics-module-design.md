# Analytics Module — Design Spec

**Date:** 2026-09-20
**Project:** geiger-assets
**Scope:** The full `Analytics` domain (8 screens) + a shared Apache ECharts chart kit.

---

## 1. Goal

The `Analytics` domain in `components/internal/sidebar/projects/feature_registry.js:706`
declares eight features, none of which are wired into `SCREEN_REGISTRY`. This spec
builds all eight as real, data-layer-backed workspace screens with per-entity
drill-down details, rendered with **Apache ECharts** through one shared chart kit.

The eight titles (these strings are the registry keys — copy them exactly):

1. `Asset Analytics`
2. `Search Analytics`
3. `Portal Analytics`
4. `Library Health`
5. `Storage & Usage`
6. `Commerce Analytics`
7. `License Analytics`
8. `Reports & Exports`

Six read from tables that already exist. `Search Analytics` and `Reports & Exports`
get new tables in this spec, **with idempotent demo seed rows** so their charts are
populated on first load.

---

## 2. Non-goals

- Do **not** port the three existing recharts screens (`home_screen.jsx`,
  `showcase_galleries_screen.jsx`, `revenue_royalties_screen.jsx`). `recharts` stays
  a dependency.
- Do **not** touch `Delivery Analytics` (`projects/delivery/delivery_analytics_screen.jsx`);
  it is already registered and working.
- No PDF export. No new nav entries — the eight titles already exist in
  `feature_registry.js`.
- No server-side aggregation (no SQL views, no RPCs). Aggregation happens in the
  data layer / `useMemo` over fetched rows, matching how `delivery_analytics_screen.jsx`
  already works.

---

## 3. Chart foundation

### 3.1 Dependency

```
npm i echarts
```

Do **not** install `echarts-for-react`. A thin local wrapper is smaller and lets us
own theming and disposal.

### 3.2 Palette tokens

The existing `--chart-1..5` dark values **fail** the dataviz lightness band for a dark
surface (`#10b981` L=0.696 and `#f59e0b` L=0.769 both sit outside L 0.48–0.67). Do not
reuse them for these charts.

Add a dedicated, validated analytics ramp to `app/globals.css`. Keep the hexes in the
token layer so no component hardcodes a hex and both themes flip correctly:

```css
@layer base {
  :root {
    --chart-a1: #2563eb;
    --chart-a2: #059669;
    --chart-a3: #b45309;
    --chart-a4: #7c3aed;
    --chart-a5: #dc2626;
    --chart-a6: #0891b2;
  }
  .dark {
    --chart-a1: #3b82f6;
    --chart-a2: #059669;
    --chart-a3: #b45309;
    --chart-a4: #8b5cf6;
    --chart-a5: #ef4444;
    --chart-a6: #0891b2;
  }
}
```

Both sets pass all six dataviz checks (lightness band, chroma floor, CVD separation,
normal-vision floor, contrast vs surface) against their mode's surface
(`#f9fafb` light / `#1a1a1a` dark). **Do not reorder or substitute these hues** —
adjacency was tuned (amber next to red fails CVD separation).

Rules that follow from this:

- Assign hues in **fixed order**, indexed by the entity, never by rank and never cycled.
- A 7th series folds into an `Other` bucket painted with the tertiary text token.
  Never generate a hue.
- Status colours (`emerald-400` up / `red-400` down) are reserved for trend and state.
  Never reuse them as "series 4".

### 3.3 `components/internal/shared/chart_kit.jsx`

`"use client"`. Exports:

**`<EChart option height={260} className onEvents notMerge />`**

- Tree-shaken imports from `echarts/core`: `LineChart`, `BarChart`, `PieChart`,
  `HeatmapChart`, `ScatterChart`; `GridComponent`, `TooltipComponent`,
  `LegendComponent`, `DataZoomComponent`, `VisualMapComponent`,
  `MarkLineComponent`; `CanvasRenderer`. Register once at module scope with
  `echarts.use([...])`.
- `echarts.init` on a `useRef` div in a `useEffect`; `setOption(option, notMerge)`
  in a second effect keyed on the option; `ResizeObserver` → `chart.resize()`;
  `chart.dispose()` on unmount.
- Re-initialise when the theme changes (`useTheme()` from `next-themes`) so the
  axis/label colours re-read from CSS.
- Must be SSR-safe: consumers import it with
  `next/dynamic(..., { ssr: false, loading: () => <LoadingArea size={40} /> })`
  so echarts never reaches the server bundle.

**`useChartTheme()`** — reads the live CSS custom properties off
`document.documentElement` via `getComputedStyle` and returns
`{ palette: [6 hexes], foreground, textSecondary, textTertiary, border, surface }`.
Recomputes when the `next-themes` resolved theme changes. Every option builder takes
this object so charts follow the suite tokens.

**Option builders** — each takes `(theme, data, opts)` and returns a plain ECharts
option. They exist so all eight screens look like one system:

| Builder | Use |
|---|---|
| `lineOption` | change over time, 1–6 series |
| `areaOption` | a single cumulative measure over time |
| `stackedBarOption` | composition over time |
| `horizontalBarOption` | ranked magnitude (top assets, top queries) |
| `donutOption` | part-to-whole, ≤6 slices |
| `heatmapOption` | two-dimensional density (day × hour) |
| `sparklineOption` | inline trend inside a stat tile, no axes |

Shared mark spec baked into every builder:

- Lines: `lineStyle.width: 2`, `symbolSize: 8`, `showSymbol: false` until hover,
  `smooth: false`.
- Bars: `itemStyle.borderRadius: [4, 4, 0, 0]` (vertical) / `[0, 4, 4, 0]`
  (horizontal); `barCategoryGap: "35%"`.
- Stacked segments: `itemStyle.borderColor: theme.surface`, `borderWidth: 2` — the
  2px surface gap.
- Grid: `splitLine` dashed at `theme.border`, `axisLine.show: false`,
  `axisTick.show: false`. Axis labels in `theme.textTertiary`.
- Tooltip: `trigger: "axis"` with `axisPointer.type: "cross"` on line/area/stacked;
  `trigger: "item"` on donut/horizontal bar/heatmap. Tooltip surface
  `theme.surface`, border `theme.border`, text `theme.foreground`.
- Legend: present whenever `series.length >= 2`, omitted for a single series
  (the card title names it). `icon: "roundRect"`, text in `theme.textSecondary`.
- **Never emit a second `yAxis`.** Two measures of different scale = two charts.

**`<ChartCard title description action height children />`** — wraps `SectionCard`
and renders either the chart or, when the user flips the built-in toggle, an
accessible `<table>` of the same rows. The table view is the a11y escape hatch and is
required on every chart card.

### 3.4 `components/internal/screens/projects/analytics/analytics_kit.jsx`

Screen-level primitives shared by all eight:

- `RangeToolbar({ range, onRange, children })` — a `Toolbar` with a `FilterDropdown`
  of `RANGE_OPTIONS` on the left and `children` (search / extra filters / export) on
  the right.
- `DeltaBadge({ current, previous })` — computes the period-over-period change and
  renders `emerald-400` up / `red-400` down. Returns `null` when `previous` is 0.
- `ExportButton({ rows, filename, chartRef })` — an `ActionMenu` with **Export CSV**
  (serialises `rows` client-side, `Blob` + `URL.createObjectURL`) and **Export PNG**
  (`chartRef.current.getDataURL({ pixelRatio: 2, backgroundColor: theme.surface })`).
  Toasts on success.
- `ChartGrid({ children })` — `grid gap-4 lg:grid-cols-2`.

---

## 4. Data layer

### 4.1 Migration — `supabase/migrations/20260920300000_analytics.sql`

Follow `20260921000000_delivery.sql` exactly for structure: `-- @up` / `-- @down`
sections, `create extension if not exists pgcrypto`, `create schema if not exists assets`,
a locally-defined `assets.touch_updated_at()`, `create table if not exists`,
`alter table … add column if not exists` back-fills, indexes, the `do $$ … foreach t in
array array[...]` RLS loop granting the demo `for all to anon, authenticated using (true)
with check (true)` policy, and a matching `-- @down` that drops the policies and tables.

**`assets.search_events`** (append-only log)

| Column | Type |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `project_id` | `uuid references public.projects(id) on delete cascade` |
| `query` | `text not null default ''` |
| `normalized_query` | `text not null default ''` (lowercased, trimmed — the grouping key) |
| `result_count` | `integer not null default 0` |
| `filters` | `jsonb not null default '{}'::jsonb` |
| `clicked_asset_id` | `uuid references assets.assets(id) on delete set null` |
| `session_id` | `text not null default ''` |
| `actor_id` | `uuid references auth.users(id) on delete set null` |
| `occurred_at` | `timestamptz not null default now()` |
| `created_at` / `updated_at` | `timestamptz not null default now()` |
| `deleted_at` | `timestamptz` |
| `metadata` | `jsonb not null default '{}'::jsonb` |

Indexes: `(project_id, occurred_at desc) where deleted_at is null`,
`(project_id, normalized_query)`.

**`assets.reports`**

`id`, `project_id`, `name text not null default ''`,
`description text not null default ''`,
`source text not null default 'asset'` — check in
`('asset','search','portal','health','storage','commerce','license')`,
`definition jsonb not null default '{}'::jsonb` (shape:
`{ range: "30", dimensions: [], metrics: [], filters: {} }`),
`schedule text not null default 'manual'` — check in `('manual','daily','weekly','monthly')`,
`recipients text[] not null default '{}'::text[]`,
`status text not null default 'active'` — check in `('active','paused')`,
`last_run_at timestamptz`, `created_by uuid references auth.users(id) on delete set null`,
plus the standard `created_at` / `updated_at` / `deleted_at` / `metadata`.

**`assets.report_runs`**

`id`, `report_id uuid not null references assets.reports(id) on delete cascade`,
`project_id`, `status text not null default 'succeeded'` — check in
`('queued','running','succeeded','failed')`, `format text not null default 'csv'` —
check in `('csv','png')`, `row_count integer not null default 0`,
`file_url text not null default ''`, `started_at`, `finished_at`,
`error text not null default ''`, plus standard columns.

**Demo seed.** At the end of `-- @up`, insert seed rows with **stable hard-coded
UUIDs** and `on conflict (id) do nothing`, matching the style at
`supabase/migrations/20260628204539_assets_modules.sql:304`:

- ~120 `search_events` spread over the last 60 days: a realistic long-tail of
  queries, ~12% with `result_count = 0`, ~40% with a `clicked_asset_id`, varied
  `filters` payloads.
- 5 `reports` (one per common source) and ~15 `report_runs` across them.

Seed rows must not depend on a particular `project_id` existing — resolve it with
`(select id from public.projects order by created_at limit 1)` and guard the insert so
it is a no-op on an empty projects table.

### 4.2 `lib/supabase/analytics.js`

`"use client"`. Read-only aggregate readers over **existing** tables. Import
`assetsClient`, `isSupabaseConfigured` from `@/supabase/components/assets-client` and
the `listRows` / `meta` helpers from `./row_helpers`. Every function is guarded,
`try/catch`, `console.error("[analytics.<fn>]", …)` on failure, and returns
`null` (no DB / failure) or `[]` / `{}` (configured, empty). **Never throws, never toasts.**

Functions, with their source tables:

| Function | Reads |
|---|---|
| `listAssetEngagement(projectId)` | `delivery_daily` + `delivery_events` + `assets` |
| `listAssetEngagementFor(projectId, assetId)` | same, filtered — powers the drill-down |
| `listPortalEngagement(projectId)` | `gallery_events`, `gallery_visitors`, `gallery_download_requests`, `galleries` |
| `listLibraryHealth(projectId)` | `assets`, `duplicate_groups`, `duplicate_members`, `rights_records`, `approval_reviews` |
| `listStorageUsage(projectId)` | `assets` (`size_bytes`, `type`, `folder`), `delivery_daily` (`bytes`), `api_usage` |
| `listCommerceActivity(projectId)` | `ppv_unlocks`, `subscriptions`, `tips`, `paid_messages`, `promo_redemptions`, `gallery_download_requests` |
| `listLicenseActivity(projectId)` | `licenses`, `license_items`, `license_renewals`, `royalty_lines`, `licensees` |

Each returns an array of camelCase view models the screen can render directly —
snake → camel mapping happens here, raw rows never leak.

`gallery_events` has **no country or referrer column**. Portal geography and referrers
read `metadata.country` / `metadata.referrer` off the event row (surfaced by `meta(row)`),
falling back to `delivery_events.country` / `referrer_host` joined on `asset_id`.

### 4.3 `lib/supabase/search_analytics.js`

- `listSearchEvents(projectId)` → normalized rows, `deleted_at is null`, ordered
  `occurred_at desc`.
- `logSearchEvent({ projectId, query, resultCount, filters, clickedAssetId, sessionId })`
  → fire-and-forget insert; returns the normalized row or `null`. Normalises
  `query` into `normalized_query` (lowercase, collapse whitespace, trim). No-ops on
  an empty query.

Wire `logSearchEvent` into the Asset Library search (`projects/library/library_screen.jsx`):
debounce ~600ms after typing stops, call once per settled query with the current
result count and active filters, ignore the promise. A failed log must never affect
the search UI.

### 4.4 `lib/supabase/reports.js`

Standard CRUD via `row_helpers`: `listReports`, `getReport`, `createReport`
(honours a caller-supplied `id`), `updateReport`, `softDeleteReport`,
`listReportRuns(projectId)`, `createReportRun`. Same tri-state return contract.

---

## 5. The eight screens

Location: `components/internal/screens/projects/analytics/`.

Every screen is `"use client"`, exports a named `*Screen` (plus a matching default),
takes `{ projectId }`, and is wrapped in `MainScreenWrapper`.

### 5.1 Shared frame

```
MainScreenWrapper
  ScreenHeader   title + description + ExportButton in `actions`
  StatsBar       4 KPIs derived with useMemo  ({ label, value, delta, trend, footer })
  RangeToolbar   range filter + screen-specific filters + SearchInput
  ChartGrid      2–4 ChartCards
  SectionCard    DataTable (rows → drill-down)
```

Three list states are mandatory on the table: `LoadingArea` while the first fetch is
in flight, `EmptyState` when there are no rows at all, and a distinct filtered-empty
`EmptyState` with a clear-filters action.

Load rows with `useModuleRows(listFn, projectId)` from
`@/components/internal/shared/module_kit`. Derive everything else — filtered lists,
KPIs, every chart series — with `useMemo` keyed on `(rows, range, search, filters)`.
Never store a derived array in its own state.

### 5.2 Drill-down

Follow `collections_screen.jsx:227`: `const [openId, setOpenId] = useState(null)`,
`onRowClick` sets it, and the screen early-returns
`<XDetailScreen id={openId} onBack={() => setOpenId(null)} … />` before its own JSX.
Do **not** extend `useWorkspaceUrl` — it only carries `asset` and `section`, and the
repo's own precedent for non-asset entities is local state.

Each detail screen is `SecondaryScreenWrapper` + a back affordance + `SegmentedTabs`
over 3–4 tabs, each tab a `ChartCard` or `DataTable`.

### 5.3 Screen-by-screen

| # | Screen / file | KPIs | Charts | Table → Detail |
|---|---|---|---|---|
| 1 | `asset_analytics_screen.jsx` | views, downloads, shares, embeds | engagement `lineOption` (4 series); top assets `horizontalBarOption`; format mix `donutOption`; geography `horizontalBarOption` | assets → `asset_analytics_detail.jsx`: tabs *Trend · Geography · Referrers · Events* |
| 2 | `search_analytics_screen.jsx` | searches, zero-result rate, click-through, avg results | volume `lineOption`; top queries `horizontalBarOption`; zero-result queries `horizontalBarOption`; filter usage `donutOption` | queries (grouped by `normalizedQuery`) → `search_query_detail.jsx`: tabs *Trend · Results · Clicked assets* |
| 3 | `portal_analytics_screen.jsx` | visitors, views, downloads, conversion | visitors `areaOption`; popular assets `horizontalBarOption`; geography `horizontalBarOption`; referrers `donutOption` | galleries → `portal_gallery_detail.jsx`: tabs *Trend · Visitors · Assets · Requests* |
| 4 | `library_health_screen.jsx` | metadata completeness %, duplicate volume, expired rights, unapproved | completeness by field `horizontalBarOption`; issue mix `donutOption`; health over time `stackedBarOption`; unused vs active `donutOption` | flagged assets → `health_issue_detail.jsx`: tabs *Issues · Metadata · History* |
| 5 | `storage_usage_screen.jsx` | storage used, bandwidth, transformations, active users | storage growth `areaOption`; bandwidth `lineOption`; usage vs plan limit `horizontalBarOption`; storage by type `donutOption` | folders/types → `storage_bucket_detail.jsx`: tabs *Trend · Assets · Largest files* |
| 6 | `commerce_analytics_screen.jsx` | revenue, orders, conversion, AOV | revenue `lineOption`; orders by product `stackedBarOption`; product performance `horizontalBarOption`; refunds `lineOption` | products → `commerce_product_detail.jsx`: tabs *Trend · Orders · Buyers* |
| 7 | `license_analytics_screen.jsx` | license revenue, active licenses, upcoming expirations, renewal rate | revenue `lineOption`; territory mix `horizontalBarOption`; expirations `stackedBarOption`; asset-level income `horizontalBarOption` | licenses → `license_analytics_detail.jsx`: tabs *Terms · Revenue · Renewals* |
| 8 | `reports_exports_screen.jsx` | saved reports, scheduled, runs this period, rows exported | runs over time `stackedBarOption` (by status); runs by source `donutOption` | reports → `report_detail.jsx`: builder form (source/range/dimensions/metrics/schedule/recipients) + **live preview chart** + run history + CSV/PNG export |

`Reports & Exports` also gets a `CreateDialog` (from `module_kit`) for a new report,
and optimistic create/update/delete against `lib/supabase/reports.js` with
`crypto.randomUUID()` minted up front and `toast.error` + rollback on a falsy write.

### 5.4 `components/internal/screens/projects/analytics/constants.js`

Config only — never row data:

- `RANGE_OPTIONS` = `[{ value: "7", label: "Last 7 days" }, { value: "30", … }, { value: "90", … }]`, **default `"30"`**.
- `REPORT_STATUS_MAP`, `RUN_STATUS_MAP`, `HEALTH_ISSUE_MAP`, `SCHEDULE_OPTIONS`,
  `SOURCE_OPTIONS` — `{ label, variant, dotClass }` shapes for `StatusPill`.
- `formatNumber`, `formatBytes`, `formatPercent`, `formatCurrency`, `formatDate`,
  `lastDays(n)`, `dayKey(value)`. Reuse the `lastDays` / `dayKey` implementations
  from `projects/delivery/delivery_analytics_screen.jsx:34-46` rather than reinventing them.

---

## 6. Wiring

In `components/internal/screens/registry.jsx`, add the eight imports and eight
`SCREEN_REGISTRY` entries keyed by the **exact** titles from §1. No changes to
`feature_registry.js` — the titles are already there.

---

## 7. Colour rules (enforced)

Semantic tokens only in JSX: `bg-background`, `bg-surface-subtle|card|hover|active|strong`,
`text-foreground`, `text-muted-foreground`, `text-text-secondary`, `text-text-tertiary`,
`border-border`, `border-border-strong`, `bg-primary` / `text-primary-foreground`,
`text-emerald-400` (up) / `text-red-400` (down). **No hex in any `.jsx`** — chart
colours come from `useChartTheme()`, which reads the `--chart-a*` tokens.

---

## 8. Definition of done

- [ ] `npm i echarts` recorded in `package.json`.
- [ ] `npm run db:push` applies `20260920300000_analytics.sql` cleanly, and re-running it is a no-op.
- [ ] All eight titles resolve to their screen from the sidebar.
- [ ] Every screen: loading, empty, and filtered-empty states all reachable.
- [ ] Every chart card has a working table view toggle.
- [ ] Every drill-down opens and the back affordance returns to the list.
- [ ] Search in the Asset Library writes rows to `assets.search_events`.
- [ ] Reports create/update/delete persist and roll back with a toast on failure.
- [ ] CSV and PNG export both produce a file.
- [ ] `npx eslint <all changed files>` is clean — no unused imports or vars.
- [ ] No `echarts` import reaches the server bundle (every consumer uses `next/dynamic` with `ssr: false`).

---

## 9. Build order

1. `npm i echarts`; add the `--chart-a*` tokens to `app/globals.css`.
2. `chart_kit.jsx` (wrapper, `useChartTheme`, option builders, `ChartCard`).
3. `analytics/constants.js` + `analytics/analytics_kit.jsx`.
4. The migration; `npm run db:push`.
5. `lib/supabase/analytics.js`, `search_analytics.js`, `reports.js`.
6. `asset_analytics_screen.jsx` + its detail — **the reference screen**. Get it right,
   then replicate its shape for the rest.
7. Screens 2–7 and their details.
8. `reports_exports_screen.jsx` + `report_detail.jsx` (builder, CSV/PNG export).
9. Wire `logSearchEvent` into `library_screen.jsx`.
10. Register all eight in `registry.jsx`.
11. Lint.
