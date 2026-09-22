# Licensing Module — Design

Date: 2026-09-20
Area: `components/internal/screens/projects/licensing`, `lib/supabase/{rights,licensing,royalties}.js`,
`supabase/migrations/20260920100000_licensing.sql`

## Purpose

A manual + automatic licensing record manager for Geiger Assets. It covers both
directions of rights:

- **Inbound** — what the organization controls and whom it must pay
  (Rights Inventory, Revenue & Royalties).
- **Outbound** — what it grants, to whom, for how much
  (License Templates, License Pricing, Issued Licenses, Expirations & Renewals).

The six screens already exist as nav entries in
`components/internal/sidebar/projects/feature_registry.js` under the **Licensing**
domain and currently fall through to the Coming Soon screen.

## Decisions (confirmed with the user)

| Question | Decision |
|---|---|
| Scope | All six nav entries |
| Licensee storage | Dedicated `assets.licensees` table |
| What a licence can cover | Library asset **or** collection **or** external (off-DAM) item |
| Pricing | Auto-calculated from a rate card, manually overridable |
| Renewals | Derived pipeline view **plus** persisted renewal records |
| Royalties | Royalty rules + accrued lines + period statements (MG + recoupment) |
| Issued Licenses detail | Full tabbed detail editor |
| Extras | Conflict/overlap warnings, printable certificate, CSV export, charts |

## Data model — `supabase/migrations/20260920100000_licensing.sql`

Schema `assets`. One self-contained idempotent file with `@up` / `@down` markers,
matching `20260904130000_creator_monetization.sql`. Every table: `uuid` pk,
`project_id uuid references public.projects(id) on delete cascade`,
`created_by uuid references auth.users(id)`, `created_at`/`updated_at` with the
`assets.touch_updated_at` trigger, `deleted_at` soft delete,
`metadata jsonb not null default '{}'`, RLS on with a demo-open policy.

| Table | Purpose / key columns |
|---|---|
| `rights_holders` | Payees. `name`, `kind`, `email`, `default_royalty_rate`, `payment_terms`, `notes` |
| `rights_records` | Acquired rights. `rights_holder_id`, `asset_id`, `collection_id`, `external_ref`, `acquisition_type`, `ownership_share`, `territories text[]`, `channels text[]`, `window_start/end`, `exclusivity`, `status`, `document_url` |
| `licensees` | Customers. `name`, `contact_name`, `email`, `kind`, `territory`, `website`, `notes` |
| `license_templates` | Reusable grants. `usage_type`, `default_territories[]`, `default_channels[]`, `default_duration_months`, `exclusivity`, `restrictions[]`, `terms_body`, `status`, `version` |
| `license_price_rules` | Rate card. `kind` ∈ base/territory/duration/channel/exclusivity, nullable `template_id` (null = global), `rule_key`, `label`, `multiplier`, `flat_cents`, `position`, `is_active` |
| `license_quotes` | Custom quote requests. `licensee_id`, `template_id`, `scope jsonb`, `computed_cents`, `quoted_cents`, `status`, `license_id` |
| `licenses` | Issued grants. `reference`, `template_id`, `licensee_id`, `title`, `status`, `usage_type`, `territories[]`, `channels[]`, `exclusivity`, `start_date`, `end_date`, `grace_days`, `is_perpetual`, `fee_cents`, `currency`, `price_breakdown jsonb`, `royalty_rate`, `restrictions[]`, `terms_body`, `auto_renew`, `renewal_of`, `renewed_to`, `document_url`, `notes` |
| `license_items` | Lines. `license_id`, nullable `asset_id` / `collection_id` / `external_title` + `external_ref`, `version_label`, `rights_record_id` |
| `license_renewals` | Audit. `license_id`, `action` ∈ renewed/lapsed/terminated/grace_extended, `previous_end_date`, `new_end_date`, `fee_cents`, `note` |
| `royalty_rules` | `rights_holder_id`, `scope_kind` ∈ global/asset/collection/rights_record/template, `scope_id`, `rate_percent`, `flat_cents`, `minimum_guarantee_cents`, `recoupable`, `priority`, `is_active` |
| `royalty_lines` | `license_id`, `rights_holder_id`, `royalty_rule_id`, `basis_cents`, `rate_percent`, `amount_cents`, `period_start`, `status`, `statement_id` |
| `royalty_statements` | `rights_holder_id`, `period_start/end`, `gross_cents`, `royalty_cents`, `minimum_guarantee_cents`, `recouped_cents`, `payable_cents`, `status`, `issued_at`, `paid_at` |

## Data layer

Three focused modules, each mirroring `lib/supabase/creator.js` — guarded by
`isSupabaseConfigured()`, using `assetsClient()`, `normalize*` / `toRow` at the
snake↔camel boundary, returning `null` / `[]` / `false`, `console.error` on
failure, never throwing and never toasting.

- `lib/supabase/row_helpers.js` — the generic guarded CRUD primitives
  (`listRows`, `getRow`, `createRow`, `updateRow`, `softDeleteRow`, `hardDeleteRow`,
  `toRowGeneric`, `meta`) shared by the three modules below.
- `lib/supabase/rights.js` — rights holders + rights records.
- `lib/supabase/licensing.js` — licensees, templates, price rules, quotes,
  licences, licence items, renewals.
- `lib/supabase/royalties.js` — royalty rules, lines, statements.

## Pure logic modules (no UI, no DB)

- `pricing_engine.js` — `quoteLicense({ template, rules, scope })` returns
  `{ baseCents, factors[], totalCents }`. Drives the Pricing screen calculator and
  the issue dialog; the breakdown is frozen into `licenses.price_breakdown`.
- `conflicts.js` — `findConflicts(license, licenses, items)` detects exclusive
  overlap on subject × territory × channel × overlapping term;
  `checkCoverage(license, items, rightsRecords)` flags grants that exceed or fall
  outside the rights actually held.
- `royalty_engine.js` — `accrueForLicense(license, rules, items)` produces royalty
  lines; `buildStatement(holder, lines, period)` applies minimum guarantee and
  recoupment.
- `lib/csv.js` — `toCsv(rows, columns)` + `downloadCsv(filename, csv)`.

## Screens

Directory `components/internal/screens/projects/licensing/`. Each is a
`"use client"` `*Screen` export inside `MainScreenWrapper`, built from the shared
kit, with loading / empty / filtered-empty states, optimistic mutations +
`toast`, semantic colour tokens only, and CSV export in the toolbar.

1. `rights_inventory_screen.jsx` — rights records table + rights-holder manager dialog.
2. `license_templates_screen.jsx` — template list, duplicate, version bump, activate/archive.
3. `license_pricing_screen.jsx` — rate card by rule kind, live quote calculator, quote requests.
4. `issued_licenses_screen.jsx` + `license_detail.jsx` + `license_certificate.jsx` —
   the spine: issue dialog wired to the pricing engine with live conflict warnings;
   row click opens a tabbed detail (Scope & Terms · Licensed Items · Financials &
   Royalties · Renewals & History · Certificate).
5. `renewals_screen.jsx` — derived pipeline (expiring 30/60/90, in grace, expired,
   auto-renewing) with Renew / Lapse / Terminate / Extend grace actions that write
   `license_renewals` rows and link `renewed_to`.
6. `revenue_royalties_screen.jsx` — Recharts revenue-over-time + territory mix,
   royalty rules, accrued lines, and period statements.

## Wiring

- `components/internal/screens/registry.jsx` — six entries keyed by the exact
  `feature_registry.js` titles.
- `geiger-rbac.config.js` — a `LICENSING_SECTIONS` list so each sub-screen gets an
  `assets.<slug>.view` permission, matching how `CREATOR_SECTIONS` is handled.
- `components/internal/shared/module_kit.jsx` — the generic dialog/row-action/
  fetch-hook primitives extracted from `creator_kit.jsx`; `creator_kit.jsx` becomes
  a thin re-export so its public surface is unchanged.
