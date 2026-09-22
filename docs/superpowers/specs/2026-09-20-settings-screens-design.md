# Settings Screens — Design Spec

Date: 2026-09-20
Status: approved, ready for implementation
Area: `components/internal/screens/projects/settings`, `addons/`, `lib/supabase/project_settings.js`

---

## 1. Goal

Design and fully implement the project **Settings** area in geiger-assets. Today
`settingsNav` lists eight tabs and **none** of them resolve to a screen —
`workspace_screen.jsx` renders a `Settings: {tab}` placeholder for every one.

After this work:

- **Connectivity**, **Custom Fields** and **Enterprise** are removed from the nav entirely.
- The remaining five — **General**, **Add-ons**, **Usage & Storage**,
  **Permissions & Security**, **Advanced** — are real, fully interactive screens.
- Everything a user would reasonably want to change is editable and persists
  through the data layer. Nothing is read-only decoration except the usage charts.
- geiger-flow's add-on mechanism is ported so **Add-ons** actually toggles real
  modules in and out of the sidebar.

## 2. Current state

| Thing | Where | Note |
|---|---|---|
| Settings nav | `components/internal/sidebar/projects/sidebar_data.js:13` | 8 entries, titles only |
| Placeholder render | `components/internal/workspace/workspace_screen.jsx:14` | `Settings: {tab}` fallback |
| Screen registry | `components/internal/screens/registry.jsx` | title → component, no settings entries |
| Sidebar | `components/internal/sidebar/projects/project_sidebar.jsx` | `resolveSubItems()` falls back to `settingsNav` |
| Slug routing | `lib/workspace/tabs.js` | derives slugs from `projectNav` + `settingsNav`, no change needed |
| Project rows | `context/project-context.js` | `useProject()` → `{ project, projectId, projects, refresh }`, reads `public.projects` |
| Schema client | `supabase/components/assets-client.js` | `assetsClient()` = `createClient().schema("assets")` |
| Storage usage | `lib/supabase/analytics.js:326` | `listStorageUsage(projectId)` → `{ folders, byType, daily, totals }` |
| RBAC data | `lib/supabase/rbac.js` | `listRoles/createRole/updateRole/softDeleteRole/setRoleProductPermissions/listMembers` |
| Permission catalog | `lib/rbac.js` | `WORKSPACE_PERMISSIONS` (`{ key, label, group }`), `ALL_PERMISSION_KEYS` |
| Singleton-settings precedent | `lib/supabase/platform.js:332` | `getDeliverySettings`/`saveDeliverySettings`, one row per project |

Reference implementation to mirror: **geiger-flow**
(`C:/Pro/geiger-flow/components/internal/screens/projects/settings/*`,
`features/project_settings/*`, `addons/registry.js`,
`supabase/migrations/20260914155205_project_settings.sql`).

**The Team screen only *assigns* roles** (`team_screen.jsx:366`) — it never
creates or edits a role's permissions. The roles editor specced below is
therefore new surface, not a duplicate.

---

## 3. Persistence

### 3.1 Migration — `supabase/migrations/20260922000000_project_settings.sql`

Self-contained and idempotent, with `-- @up` / `-- @down` sections like every
other migration in `supabase/migrations/`. Defines `assets.touch_updated_at()`
locally so the file stands alone (per `SUPABASE_CONVENTIONS.md` §7).

```sql
create table if not exists assets.project_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,

  -- General
  visibility text not null default 'private'
    check (visibility in ('private', 'internal', 'public')),
  region text not null default 'us-east-1',
  default_page_size integer not null default 25,
  default_tab text not null default 'Overview',

  -- Usage & Storage limits
  storage_quota_gb numeric not null default 500,
  max_upload_mb integer not null default 2048,
  trash_retention_days integer not null default 30,
  auto_archive_days integer not null default 0,     -- 0 = off
  quota_alert_percent integer not null default 80,

  -- Expansion bag: { addons, security, advanced, variables, allowedFileTypes,
  -- brandKit, watermarks, contactSheets }
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

Plus:

- `create index if not exists project_settings_project_idx on assets.project_settings (project_id) where deleted_at is null;`
- `drop trigger if exists …` then `create trigger project_settings_touch_updated_at before update … execute function assets.touch_updated_at();`
- `grant all on assets.project_settings to anon, authenticated, service_role;`
- RLS enabled with the demo-open `for all to anon, authenticated using (true)`
  policy every other assets table uses (`drop policy if exists` first).
- The shallow-merge RPC, so one settings tab never clobbers another's bag:

```sql
create or replace function assets.project_merge_settings(p_project_id uuid, p_patch jsonb)
returns assets.project_settings
language plpgsql
as $function$
declare result assets.project_settings;
begin
  insert into assets.project_settings (project_id, metadata)
  values (p_project_id, coalesce(p_patch, '{}'::jsonb))
  on conflict (project_id)
  do update set metadata = assets.project_settings.metadata || excluded.metadata,
                updated_at = now()
  returning * into result;
  return result;
end;
$function$;
```

`-- @down` drops the function and the table, nothing else. Run with `npm run db:push`.

### 3.2 Data layer — `lib/supabase/project_settings.js`

`"use client"`, opening with a header comment naming the table it owns and the
snake_case ↔ camelCase contract. Pure data access: guard every call with
`isSupabaseConfigured()`, `console.error("[project_settings.<x>]", …)` on
failure, return `null`/`false`. Never throws, never toasts.

```js
export function normalizeProjectSettings(row)      // snake → camel; every section bag defaulted
export function defaultProjectSettings(projectId)  // the shape a screen renders before/without a row
export async function getProjectSettings(projectId)
export async function mergeProjectSettings(projectId, patch)          // metadata bag, via the RPC
export async function updateProjectSettingsColumns(projectId, patch)  // promoted columns, upsert
export async function updateProjectRecord(projectId, patch)           // public.projects name/slug/description
```

- `normalizeProjectSettings` spreads defaults into every bag
  (`{ ...DEFAULT_SECURITY_SETTINGS, ...(metadata.security ?? {}) }`) so screens
  render with no null checks.
- `mergeProjectSettings` calls
  `assetsClient().rpc("project_merge_settings", { p_project_id, p_patch })` and
  falls back to a read-modify-write upsert when the RPC is unavailable — same
  shape as flow's `mergeProjectSettingsFallback`.
- `updateProjectSettingsColumns` emits a column **only when its key is present**
  in the patch, then updates (or inserts when no row exists yet).
- `updateProjectRecord` uses a plain `createClient()` (default `public` schema) —
  `public.projects` is a shared suite table and is never reached through
  `assetsClient()`.

### 3.3 Constants — `components/internal/screens/projects/settings/constants.js`

Config only, never row data: `PROJECT_VISIBILITY_OPTIONS`,
`PROJECT_REGION_OPTIONS`, `PAGE_SIZE_OPTIONS`, `FILE_TYPE_OPTIONS`,
`SESSION_TIMEOUT_OPTIONS`, `SHARE_EXPIRY_OPTIONS`, the frozen default bags
(`DEFAULT_SECURITY_SETTINGS`, `DEFAULT_ADVANCED_SETTINGS`, `DEFAULT_ADDON_PREFS`,
`DEFAULT_USAGE_LIMITS`), and the `formatBytes` / `formatDateTime` helpers.

### 3.4 Shared hook — `components/internal/screens/projects/settings/settings_kit.jsx`

One hook every settings screen uses, so the optimistic/persist/toast dance is
written once:

```js
const { settings, loading, patchColumns, patchSection, patchProject } = useProjectSettings(projectId);
```

- Loads on mount via `getProjectSettings`, falling back to
  `defaultProjectSettings(projectId)` when it returns `null`.
- `patchSection(key, partial)` — optimistic `setSettings`, then
  `mergeProjectSettings(projectId, { [key]: nextBag })`; on a falsy result, roll
  back and `toast.error`.
- `patchColumns(partial)` / `patchProject(partial)` — same contract against
  `updateProjectSettingsColumns` / `updateProjectRecord`.
- The file also exports the small presentational helpers the five screens share:
  `DangerZoneCard`, `ConfirmDeleteDialog` (type-to-confirm), `NumberSettingRow`,
  `SelectSettingRow`.

---

## 4. Add-on system (ported from geiger-flow)

### 4.1 Registry — `addons/registry.js`

Port flow's `addons/registry.js` shape verbatim:

`loadAddon`, `getInstalledAddons`, `getEnabledAddons`, `getAddonScreens`,
`getAddonScreenOptions`, `getAddonNavItems(enabledIds, navPositions, addonColors)`,
`mergeNavWithAddons(baseNav, addonNavItems)` (inserts before the `Settings` entry,
honouring an item's `insertAfter`), `AddonRegistryProvider({ children,
initialEnabledAddons })`, and `useAddonRegistry()`.

`DEFAULT_ENABLED_ADDONS = ["brand-kit"]`.

### 4.2 Installer — `addons/index.js`

Side-effect imports of every bundled add-on, exactly like flow's — one module
both hosts import, so the real route and the landing playground can never drift.

### 4.3 The bundled add-ons (assets-native)

Each is `addons/<id>/{index.js, manifest.js, screens/…, components/…}`. The
manifest shape is flow's: `{ id, name, description, version, category, icon,
color, features[], navItem: { title, icon, insertAfter? }, screens: [{ id,
component }] }` — a screen's `id` **must** equal `navItem.title`.

| id | Nav title | `insertAfter` | What it does | State lives in |
|---|---|---|---|---|
| `brand-kit` | Brand Kit | `Galleries` | Logo lockups (upload plus clear-space and min-size notes), colour palette (add/edit/remove swatches with hex and role), typography scale, and usage do/avoid notes. All inline-editable. | `metadata.brandKit` |
| `watermark` | Watermarks | `Media` | Watermark preset builder — text or image mark, position (9-cell grid), opacity, scale, margin, blend; live preview over a sample asset; duplicate and delete presets; set-as-default for share links. | `metadata.watermarks` (array) |
| `contact-sheets` | Contact Sheets | `Collections` | Saved contact-sheet layouts — source collection, grid columns/rows, which metadata fields print under each thumbnail, header/footer text, page size; preview grid and export action. | `metadata.contactSheets` (array) |

All three persist through `mergeProjectSettings` — **no new tables**. Each screen
follows the normal screen conventions: loading → data/empty, optimistic writes,
toasts, shared kit, semantic tokens.

### 4.4 Wiring

| File | Change |
|---|---|
| `app/project/[projectId]/workspace_layout.jsx` | `import "@/addons"`, wrap in `<AddonRegistryProvider>` |
| `components/AssetsPlayground.jsx` | `import "@/addons"`, wrap in `<AddonRegistryProvider initialEnabledAddons={["brand-kit"]}>` |
| `components/internal/sidebar/projects/project_sidebar.jsx` | build nav from `mergeNavWithAddons(projectNav, getAddonNavItems(enabled, navPositions, colors))` instead of raw `projectNav` |
| `components/internal/workspace/workspace_shell.jsx` | `buildSearchNav()` uses the merged nav so add-on screens are reachable from the command palette |
| `components/internal/workspace/workspace_screen.jsx` | resolve `getAddonScreens(enabledAddons)[tab]` **before** the `getScreen(tab)` registry lookup; delete the settings placeholder branch |

Hydration: the Add-ons screen reads `metadata.addons`
(`{ enabled, navPositions, colors }`) on mount and pushes it into the registry
context; every toggle, position and colour change writes back through
`patchSection("addons", …)`. A new hook `lib/hooks/use-visible-project-nav.js`
(mirroring flow's) owns the merge so the sidebar and the palette read one source.

---

## 5. The screens

All five live in `components/internal/screens/projects/settings/`, are
`"use client"`, export a named `*Screen`, and are **registered directly in
`registry.jsx` under their exact nav title** — no `activeSettingsTab` switch
shell. (Flow uses one; the assets registry convention is title → component, and
that wins here.) Each renders `SecondaryScreenWrapper` → `ScreenHeader` (title,
description, right-aligned actions) → `SectionCard`s.

### 5.1 General — `general_settings.jsx`

Header description: "Name, identifiers, and the basics that describe this project."

- **Identity** (`SectionCard`) — project name, slug, description as inline
  `Field` + `Input`/`Textarea`, saved on blur via `patchProject`. The slug is
  validated (lowercase, `a-z0-9-`); a taken slug reverts with `toast.error`.
- **Identifiers** — read-only project ID and DAM project ID rows with copy
  buttons (reuse the `CopyButton` pattern from `platform/api_screen.jsx`).
- **Availability** — visibility `Select` (Private / Internal / Public) and region
  `Select`, both via `patchColumns`.
- **Workspace defaults** — default rows per page (`PAGE_SIZE_OPTIONS`) and
  default landing tab (a `Select` over `projectNav` titles), via `patchColumns`.

### 5.2 Add-ons — `addons_settings.jsx`

Header description: "Optional modules that add screens and capabilities."
Header action: grid/compact view toggle (`LayoutGrid` / `LayoutList`).

- One `AddonCard` per installed add-on: an icon chip tinted with the add-on's
  colour, name plus version and category badges, description, an `Active` dot
  when enabled, and a `Switch`.
- A "More details" expander reveals the `features[]` list, a **nav position**
  `Select` (where it sits in the sidebar) and an **accent colour** picker.
- Every change is optimistic into the registry context and persisted with
  `patchSection("addons", …)`.
- `EmptyState` (icon `LucidePackagePlus`) when no add-ons are installed.

### 5.3 Usage & Storage — `usage_storage_screen.jsx`

Header description: "Resource consumption, limits, and retention for this project."
Data source: `listStorageUsage(projectId)` → `{ folders, byType, daily, totals }`.

- **`StatsBar`** — Storage used (of quota), Assets, Bandwidth (30d), Transforms.
  Values animate through `RollingNumber`; storage carries a `delta`/`trend`.
- **Storage growth** — `ChartCard` + `areaOption` over `daily`.
- **By file type** — `donutOption` over `byType`.
- **Largest folders** — `horizontalBarOption` over the top 10 of `folders`.
- **Quota** — a progress meter of `totals.storageBytes` against
  `storage_quota_gb`; amber past `quota_alert_percent`, red past 100%.
- **Limits & retention** — an editable `SettingsList`. Storage quota (GB), max
  upload size (MB), auto-archive after N days (0 = off), trash retention days
  and quota alert threshold % are promoted columns, written via `patchColumns`.
  Allowed file types (multi-select) is the one bag value here, written via
  `patchSection("usage", { allowedFileTypes })`.
- Section loading uses `LogoLoading` (per `CLAUDE.md`); charts use `ChartLoading`.

### 5.4 Permissions & Security — `permissions_security_screen.jsx`

Header description: "Roles, access policy, and the security rules this project enforces."
Header action: "New role".
Two `SegmentedTabs`: **Roles** and **Security**.

**Roles tab** (new surface — Team only assigns roles):

- `DataTable` over `listRoles(projectId)`: role name and key, description, a
  permission-count badge, member count (joined from `listMembers`), a system-role
  lock badge, and a `RowActions` menu (Edit, Duplicate, Delete).
- Create/Edit dialog: name, key (auto-slugged, immutable after create),
  description, colour, and the permission matrix — `WORKSPACE_PERMISSIONS`
  grouped by `group`, each a `Checkbox`, with a per-group "select all". Saves via
  `createRole` / `updateRole` plus `setRoleProductPermissions`.
- System roles (`isSystem`) render read-only with an explanatory hint; delete is
  disabled for them and for any role that still has members assigned.
- Optimistic create/update/delete with `crypto.randomUUID()` ids, rolling back
  and `toast.error`ing on a falsy write.

**Security tab** — a `SettingsList` of `SettingRow`s, written via
`patchSection("security", …)`:

- Require signed URLs for delivery
- Share links: require password by default / default expiry (`SHARE_EXPIRY_OPTIONS`) /
  allow downloads by default / apply watermark by default
- Allow public galleries
- Session timeout (`SESSION_TIMEOUT_OPTIONS`)
- Enforce two-factor for members
- IP allowlist (tag-style add/remove list; empty means unrestricted)
- Virus-scan uploads
- Block re-download of expired shares

A footer note states plainly that these are **advisory UI-gating** until auth
lands (matching `MODULE_CONVENTIONS.md` → Permissions) and links across to the
Team screen for membership.

### 5.5 Advanced — `advanced_settings.jsx`

Header description: "Operational controls, environment, and destructive actions."

- **Operations** — a `SettingsList` written via `patchSection("advanced", …)`:
  read-only mode, maintenance mode, audit logging, rate limiting, request
  signing, webhook retries.
- **Environment variables** — a `DataTable` over `{ key, value, secret }` from
  `metadata.variables` with add/edit/delete dialogs; secret values masked behind
  a reveal toggle, each with a copy button.
- **Cache** — "Purge CDN cache" and "Rebuild renditions" buttons; each disables
  and shows a `Loader2` while pending, then toasts the outcome.
- **Danger zone** (`DangerZoneCard`, red-tinted border) —
  **Reset settings to defaults** (confirm dialog),
  **Transfer project** to another organization (select plus confirm), and
  **Delete project** (type-the-project-name-to-confirm dialog, then soft-delete
  and navigate away). Each action is guarded and toasts its outcome.

---

## 6. Removals

1. `components/internal/sidebar/projects/sidebar_data.js` — delete the
   **Connectivity**, **Custom Fields** and **Enterprise** entries and drop the
   now-unused `Link`, `SlidersHorizontal` and `MousePointer2` icon imports.
2. `components/internal/workspace/workspace_screen.jsx` — delete the
   `settingsNav.some(...)` placeholder branch and its now-unused `settingsNav`
   import; the five titles resolve through the registry, add-on titles through
   `getAddonScreens`.
3. Confirm nothing else referenced those three titles:
   `grep -rn "Connectivity\|Custom Fields\|Enterprise" components lib app`.

---

## 7. File manifest

**Create**

```
supabase/migrations/20260922000000_project_settings.sql
lib/supabase/project_settings.js
lib/hooks/use-visible-project-nav.js
components/internal/screens/projects/settings/constants.js
components/internal/screens/projects/settings/settings_kit.jsx
components/internal/screens/projects/settings/general_settings.jsx
components/internal/screens/projects/settings/addons_settings.jsx
components/internal/screens/projects/settings/usage_storage_screen.jsx
components/internal/screens/projects/settings/permissions_security_screen.jsx
components/internal/screens/projects/settings/advanced_settings.jsx
addons/registry.js
addons/index.js
addons/brand-kit/{index.js,manifest.js,screens/brand_kit_screen.jsx,components/*}
addons/watermark/{index.js,manifest.js,screens/watermark_screen.jsx,components/*}
addons/contact-sheets/{index.js,manifest.js,screens/contact_sheets_screen.jsx,components/*}
```

**Modify**

```
components/internal/sidebar/projects/sidebar_data.js      (remove 3 tabs + icons)
components/internal/sidebar/projects/project_sidebar.jsx  (merged nav)
components/internal/workspace/workspace_screen.jsx        (addon screens; drop placeholder)
components/internal/workspace/workspace_shell.jsx         (palette reads merged nav)
components/internal/screens/registry.jsx                  (register the 5 settings screens)
app/project/[projectId]/workspace_layout.jsx              (AddonRegistryProvider)
components/AssetsPlayground.jsx                           (AddonRegistryProvider)
```

---

## 8. Conventions the implementation must hold

From `MODULE_CONVENTIONS.md`, `SUPABASE_CONVENTIONS.md` and `crafting.md`:

- **No static seed data.** Every screen starts empty with a `loading` flag,
  fetches on mount, and renders loading → data → empty. `constants.js` holds
  config only.
- **Optimistic then persist.** Local state updates first, the data-layer call
  follows, a falsy result rolls back and `toast.error`s.
- **The data layer is pure.** No throws, no toasts, `console.error` on failure,
  `null`/`false`/`[]` returns, an `isSupabaseConfigured()` guard on every call.
- **Schema discipline.** `assets.*` through `assetsClient()`; `public.projects`
  through a plain `createClient()`.
- **Shared kit first** — `ScreenHeader`, `SectionCard`, `SettingsList`/`SettingRow`,
  `DataTable`, `StatsBar`, `EmptyState`, `Field`, `StatusPill`, `SegmentedTabs`,
  plus `module_kit`'s `TextField`/`SelectField`/`CreateDialog`/`RowActions`.
- **Semantic tokens only** — `bg-surface-subtle|card|hover|active`,
  `text-foreground|muted-foreground|text-secondary|text-tertiary`,
  `border-border|border-strong`, `bg-primary`; destructive `text-red-400` /
  `focus:bg-red-500/10`. **No hardcoded hex** except add-on accent colours, which
  are author-chosen manifest data applied via inline `style`.
- **Loaders** — `LogoLoading` without a `name` prop for page and section loaders;
  `Loader2` only inside buttons and inline indicators.
- **Feedback** — Sonner `toast.success`/`toast.error`; the global Toaster already
  has `richColors` and no close button, so do not re-add one.
- Icon-only buttons get an `aria-label`.

## 9. Build order

1. Migration, then `npm run db:push`.
2. `lib/supabase/project_settings.js`, `constants.js`, `settings_kit.jsx`.
3. Removals (nav entries, placeholder branch) and registration of the five titles.
4. **General**, then **Advanced** — the two pure-settings screens; they prove the hook.
5. **Usage & Storage** (charts plus limits).
6. **Permissions & Security** (roles editor first, then the security policy).
7. Add-on registry and wiring with an empty catalog — verify nav, palette and
   screen resolution still work.
8. `brand-kit`, then `watermark`, then `contact-sheets`; each is independently
   shippable.
9. The **Add-ons** settings screen last, once there is a catalog to render.

## 10. Verification

- `npx eslint <changed files>` clean — unused imports treated as errors.
- Every settings tab reachable from the sidebar **and** from the command palette;
  a refresh on `?tab=<slug>` stays put.
- With Supabase unconfigured, every screen renders its loading → empty state and
  never crashes.
- Toggling an add-on off removes its nav entry and its screen immediately; a
  reload restores the persisted set.
- No build run unless a significant UI change needs one (`CLAUDE.md`).
