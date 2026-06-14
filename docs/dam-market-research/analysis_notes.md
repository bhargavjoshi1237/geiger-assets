# DAM Market Research Analysis Notes

## Reporting Contract

- Delivery mode: static HTML report
- Audience: product stakeholders
- Decision: define the credible DAM baseline, identify uncommon differentiation, and frame the gallery/licensing opportunity before selecting Geiger features and pricing
- Scope date: June 14, 2026
- Core comparison set: 12 DAM products
- Supporting benchmarks: transparent-price DAMs, gallery commerce platforms, and rights/royalty platforms

## Required Structure Mapping

| Required role | Report section |
|---|---|
| Title | Geiger Assets DAM Market and Feature Research |
| Executive summary | Executive Summary |
| Key findings with evidence | Competitor groups, vendor table, prevalence chart, gallery opportunity, license model, pricing framework |
| Recommended next steps | Recommended Product Sequence |
| Further questions | Questions to answer before feature selection |
| Caveats and assumptions | Caveats and Assumptions |

## Feature Matrix Rules

- `C`: explicitly supported in reviewed public product material
- `M`: supported through a named module, add-on, adjacent product, enterprise tier, or closely integrated product surface
- `U`: not confirmed in reviewed public material
- Prevalence counts include `C` and `M`
- `U` is not interpreted as proof of absence

## Prevalence Tiers

- Extremely common: 10-12 of 12 products
- Very common: 8-9 of 12 products
- Common: 5-7 of 12 products
- Uncommon: 2-4 of 12 products
- Extremely rare: 0-1 of 12 products

## Chart Map

| Report section | Analytical question | Chart family | Fields | Supported claim | Output |
|---|---|---|---|---|---|
| Feature prevalence creates a clear baseline | Which functions are baseline versus differentiating? | Ranked horizontal bar | Feature, confirmed competitor count | Conventional DAM functions are broadly common while the full commerce/licensing stack is absent from the reviewed core set | `feature_prevalence.png` |

Palette policy: single-root blue with direct count and tier labels. Bars start at zero. The 12-product denominator is displayed in every label.

## Validation Report

### Overall Assessment: Share with caveats

### Methodology Review

The report answers a product-strategy question rather than a procurement question. It uses a deliberately mixed competitor set to represent the enterprise feature ceiling, modern collaborative tools, specialist visual-media DAM, and developer-led media delivery. That is appropriate for product planning but should not be treated as an absolute market ranking.

### Issues And Caveats

1. Public marketing pages are incomplete and can understate enterprise capability. This is mitigated by using `U` for unconfirmed rather than absent.
2. Some capability labels combine related functions, such as visual, semantic, and natural-language search. Product-level implementation depth varies.
3. Pricing changes frequently and enterprise contracts are negotiated. Published prices are point-in-time anchors only.
4. A complete gallery commerce and outbound licensing workflow may be available through custom integrations even when it is not a native public product proposition.
5. Legal, accounting, tax, and merchant-of-record requirements are outside this product research and require specialist review.

### Calculation Spot Checks

- Denominator: verified at 12 core products for every feature row
- Tier thresholds: verified against the stated 12-product denominator
- Commerce/licensing rows: verified as 0 of 12 in the current public-evidence matrix
- Public self-serve pricing: verified as 3 of 12 in the current matrix
- Free forever plan: verified as 2 of 12 in the current matrix

### Visualization Review

- Horizontal bars are appropriate for long feature labels
- Axis begins at zero and ends beyond 12 to reserve direct-label space
- Counts and prevalence tiers are directly labeled
- PNG was inspected standalone and inside the final HTML report
- The chart is long but remains readable at full width and preserves every feature instead of hiding the long tail

## Recommended Evidence Refresh

Before finalizing a build roadmap or pricing:

1. Recheck the seven most decision-sensitive competitors: Canto, Bynder, Brandfolder, Frontify, Air, Dash, and Cloudinary.
2. Run five to ten customer interviews in the chosen initial segment.
3. Validate willingness to pay for gallery commerce and outbound license management separately.
4. Confirm payment, tax, storage, bandwidth, transcoding, and AI unit economics.
5. Have counsel review the proposed license template and merchant-of-record model.
