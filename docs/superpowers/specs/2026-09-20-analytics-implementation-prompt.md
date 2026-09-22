# Implementation prompt — Analytics module

Paste everything below the line into a fresh session rooted at `C:\Pro\geiger-assets`.

---

Implement the Analytics module described in
`docs/superpowers/specs/2026-09-20-analytics-module-design.md`.

**Read these first, in this order, before writing any code:**

1. `docs/superpowers/specs/2026-09-20-analytics-module-design.md` — the spec. It is
   authoritative. Follow it section by section.
2. `MODULE_CONVENTIONS.md`, `SUPABASE_CONVENTIONS.md`, `crafting.md` — the project's
   structural and craft rules.
3. The reference implementations the spec points at, so your code matches existing
   idiom rather than inventing a new one:
   - `components/internal/screens/projects/delivery/delivery_analytics_screen.jsx`
     (the closest existing analytics screen — copy its aggregation shape,
     `lastDays`/`dayKey` helpers, and stats derivation)
   - `components/internal/screens/projects/collections/collections_screen.jsx`
     (list → detail drill-down via `const [openId, setOpenId] = useState(null)` and an
     early return; also the create/edit/delete optimistic pattern)
   - `lib/supabase/delivery.js` (data-layer shape: `normalize*`, `toRow`, guarded
     reads, tri-state returns)
   - `supabase/migrations/20260921000000_delivery.sql` (migration structure:
     `-- @up` / `-- @down`, idempotent DDL, the `do $$ … foreach` RLS loop)
   - `node_modules/@geiger/ui/src/ui/screen-kit.jsx` (the real prop signatures for
     `ScreenHeader`, `StatsBar`, `StatGrid`, `SectionCard`, `DataTable`, `EmptyState`,
     `LoadingArea`, `Toolbar`, `StatusPill`, `SegmentedTabs`)

**Build in the order given in spec §9.** Do not jump ahead. Specifically: get
`chart_kit.jsx` and `asset_analytics_screen.jsx` (+ its detail) fully right first —
that pair is the reference the other seven screens copy. Show me those before
building screens 2–8.

**Hard constraints — these are not negotiable:**

- **Data-layer-first.** Every screen starts `useState([])` + loading and fetches on
  mount via `useModuleRows(listFn, projectId)`. **No static in-file row arrays, no
  mock data in a component file.** Demo data lives in the migration's seed, nowhere
  else. `constants.js` holds config (option lists, status maps, formatters) only.
- **Derive with `useMemo`.** Filtered lists, KPIs, and every chart series are computed
  from fetched rows keyed on `(rows, range, search, filters)`. Never store a derived
  array in its own state.
- **Data layer is pure.** Guard every call with `isSupabaseConfigured()`, wrap in
  `try/catch`, `console.error("[analytics.<fn>]", …)` on failure, return
  `null` / `[]` / `false`. Never throw, never toast from `lib/supabase/*`. The screen
  owns all toasts.
- **Semantic colour tokens only. No hex in any `.jsx`.** Chart colours come from
  `useChartTheme()` reading the `--chart-a1..a6` CSS custom properties you add to
  `app/globals.css`. Use the exact hues in spec §3.2 in the exact order given — they
  were validated for colourblind separation and dark/light contrast, and adjacency
  was tuned. Do not reorder or substitute them.
- **Never emit a second `yAxis`.** Two measures of different scale get two charts.
- **Legend whenever a chart has ≥2 series**, omitted for a single series. Every
  `ChartCard` needs its table-view toggle working.
- **`echarts` must never reach the server bundle.** Every consumer imports the chart
  component through `next/dynamic(..., { ssr: false })`.
- Three list states on every table: loading, empty, and a distinct filtered-empty with
  a clear-filters action.
- Mutations (Reports only) are optimistic: mint `crypto.randomUUID()` up front, pass
  it to `createReport`, and on a falsy write `toast.error` + roll back.
- Register all eight screens in `components/internal/screens/registry.jsx` under the
  **exact** titles listed in spec §1. Do not edit `feature_registry.js`.

**Verification — run these and report the real output, do not claim success without it:**

- `npm run db:push`, then run it a second time to prove the migration is idempotent.
- `npx eslint <every file you created or changed>` — must be clean. Unused imports
  and vars are errors to fix, not warnings to leave.
- Do **not** run `npm run build` unless you have a specific reason a build is needed
  to verify a UI change (per `CLAUDE.md`).

**Working style:**

- Explore before editing; match the surrounding file's naming, comment density, and
  idiom. Edit in small exact diffs.
- If the spec is ambiguous or conflicts with something you find in the codebase, say
  so and ask rather than guessing. If a detail is genuinely inconsequential, pick the
  obvious option and tell me which you took.
- When you finish, list what you built, anything you deviated from in the spec and
  why, and walk the spec §8 "Definition of done" checklist with a real pass/fail per
  line.
