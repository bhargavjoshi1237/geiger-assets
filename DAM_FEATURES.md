# Geiger Assets — Digital Asset Manager (DAM) Feature Blueprint

> Geiger Assets is the DAM module within the Geiger Studio suite (Geiger Flow, Geiger Notes, Geiger Assets, and future products). It manages the full lifecycle of digital assets — from upload to archival — while offering deep integration across the suite ecosystem.

---

## 🏗 Core DAM Features

### 1. Asset Library
- **Unified library view** — Grid, list, and gallery layouts with configurable columns
- **Folder-based organization** — Nested folders with drag-and-drop reordering
- **Quick filters** — By file type, date range, owner, tag, collection, status
- **Bulk operations** — Select multiple assets to move, tag, delete, or export
- **Asset preview** — In-browser preview for 50+ file types (images, video, PDF, SVG, code)
- **Version history** — Full version stack per asset with rollback and diff previews
- **Duplicate detection** — AI-powered detection of duplicate or near-duplicate assets

### 2. Collections & Smart Collections
- **Manual collections** — Curate groups of assets for campaigns, clients, or themes
- **Smart collections** — Auto-populate based on rules (tag = "hero", type = video, date > 2025)
- **Collection sharing** — Share collections with external stakeholders via password-protected links
- **Collection expiry** — Set time-based access windows for shared collections

### 3. Upload Center
- **Drag-and-drop upload** — Upload files, folders, or ZIP archives
- **Bulk import** — Import from cloud storage (Google Drive, Dropbox, OneDrive, S3)
- **Upload progress** — Real-time progress tracking with pause/resume
- **Auto-tagging on upload** — AI generates tags and metadata immediately after upload
- **Upload templates** — Predefined metadata schemas per upload batch (e.g., "Product Photos" template with required fields: SKU, colorway, season)

### 4. Tags & Metadata
- **Hierarchical tagging** — Nested tag taxonomy (e.g., Brand > Logo > Primary)
- **Custom metadata fields** — Define project-specific metadata schemas (text, number, date, select, multi-select)
- **Bulk metadata editing** — Inline batch-edit metadata across selected assets
- **EXIF/IPTC/XMP parsing** — Auto-extract and index camera and IPTC metadata
- **Metadata templates** — Save and reuse metadata presets for common asset types
- **AI auto-tagging** — Object detection, scene recognition, text extraction (OCR)

### 5. Advanced Search
- **Full-text search** — Search across filenames, descriptions, tags, and metadata
- **Visual similarity search** — Upload an image to find visually similar assets
- **Filter combinations** — Stack multiple filters with AND/OR logic
- **Saved searches** — Bookmark complex queries for quick access
- **Search within results** — Refine searches progressively
- **Content search** — OCR-based search inside documents and images

### 6. Brand Templates & Brand Portal
- **Template engine** — Create branded templates (social posts, presentations, letterheads)
- **Brand guidelines hub** — Centralized brand assets: logos, colors, fonts, usage rules
- **Brand portal** — Public-facing portal for partners/teams to download approved brand assets
- **Template locking** — Lock specific elements while allowing editable regions
- **Auto-format generation** — Export assets in predefined formats (Instagram square, LinkedIn banner, etc.)

### 7. Media Type Workflows
- **Images** — Built-in editor (crop, resize, filter, annotate), format conversion (PNG, WebP, AVIF)
- **Videos** — Thumbnail extraction, transcript generation, clip trimming, storyboard view
- **Audio** — Waveform preview, transcript generation, metadata extraction
- **Documents** — PDF preview, page thumbnails, text extraction
- **3D Models** — Interactive 3D viewer (rotate, zoom), thumbnail rendering
- **Design Files** — Figma/Sketch file parsing with layer extraction

### 8. Sharing & Collaboration
- **Asset sharing** — Share individual assets or collections via link
- **Permission levels** — Viewer, editor, manager, admin per project/collection
- **External sharing** — Password-protected links with expiry dates
- **Comments & annotations** — Pin comments directly on assets for review feedback
- **Approval workflows** — Submit assets for approval with multi-stage review
- **Embed codes** — Generate embed snippets for websites and apps

### 9. Workflows & Automation
- **Custom workflows** — Define multi-step approval/review pipelines (Upload → Tag → Review → Approve → Publish)
- **Auto-assign** — Route assets to teams based on type, tags, or metadata
- **Trigger actions** — Auto-tag, auto-organize, auto-convert on upload
- **Webhook events** — Notify external systems on asset lifecycle events
- **Scheduled exports** — Automatically sync approved assets to external storage

### 10. Archive & Retention
- **Soft archive** — Move outdated assets to archive without deleting
- **Retention policies** — Define auto-archive/delete rules by asset type or age
- **Legal hold** — Prevent deletion of assets under legal review
- **Archive search** — Search archived assets without restoring
- **Bulk restore** — Restore archived assets back to active library

---

## 🔮 Unique Features — Ecosystem Advantage

### 11. Geiger Flow Integration (Issue → Asset Linking)
- **Issue-asset linking** — Attach design assets directly to Geiger Flow issues as evidence or deliverables
- **Task deliverables** — Link approved assets as task completion proof
- **Auto-attach on status change** — When a Flow issue moves to "Done", auto-link all associated assets
- **Cross-product breadcrumbs** — Navigate from an asset to the Flow issue that created it

### 12. Geiger Notes Integration (Asset Documentation)
- **Asset-embedded notes** — Attach Geiger Notes to any asset for context, briefs, or revision history
- **Brief templates** — Create creative briefs in Notes that auto-create asset Upload templates in Assets
- **Research linking** — Link mood board assets from Notes to Assets projects
- **One-click documentation** — Generate a Note document from an asset's full metadata + history

### 13. Universal Asset Graph
- **Relationship mapping** — See which assets are derived from or connected to other assets (e.g., final ad → source photo → raw file)
- **Usage tracking** — Track where each asset is used across the entire Geiger suite (Flow issues, Notes docs, Collections)
- **Impact analysis** — Before deleting an asset, see everything it's connected to

### 14. AI-Powered Asset Intelligence
- **Smart categorization** — AI auto-sorts uploads into the right folders and collections
- **Duplicate recommendation** — "This looks like an existing asset — merge or keep separate?"
- **Usage predictions** — AI suggests which assets to archive based on access patterns
- **Auto-description** — Generate alt text and marketing descriptions for accessibility and SEO
- **Content-aware resizing** — AI-aware cropping that preserves key subjects

### 15. Studio-Wide Search
- **Unified search across suite** — Search once, see results from Assets, Notes, and Flow
- **Cross-app deeplinks** — Click a search result to jump directly to the asset/note/issue
- **Contextual panels** — See related assets when viewing a Flow issue or Notes document

### 16. Asset Version Branching (Git-like)
- **Branching** — Create variations of an asset (e.g., different colorways of a logo) as branches
- **Merge variants** — Promote a branch to the "main" version
- **Compare view** — Side-by-side comparison of asset versions
- **Variant thumbnails** — See all branches as thumbnails on the parent asset

### 17. Real-Time Collaboration
- **Live cursors** — See team members' cursors when browsing the same collection
- **Co-browsing** — Share your current view with a teammate for instant visual alignment
- **Presence indicators** — See who's viewing or editing an asset in real-time
- **Activity feed** — Live stream of all actions across the project

### 18. Asset API & Developer Platform
- **REST API** — Full CRUD API for assets, collections, tags, and metadata
- **GraphQL endpoint** — Flexible querying for complex asset relationships
- **SDK** — JavaScript/TypeScript SDK for embedding asset management in custom apps
- **Webhooks** — Real-time event notifications for integrations
- **Headless DAM** — Use Geiger Assets as a headless CMS for media delivery

### 19. Smart CDN & Delivery
- **On-the-fly transforms** — Resize, crop, format-convert images via URL parameters
- **Global CDN** — Edge-cached asset delivery for fast worldwide access
- **Responsive breakpoints** — Auto-generate responsive image sets
- **Lazy-signed URLs** — Time-limited secure URLs for private assets
- **Bandwidth analytics** — Track asset delivery metrics per project

### 20. Compliance & Governance
- **License tracking** — Track asset licenses (Creative Commons, commercial, editorial-only)
- **Expiry alerts** — Get notified before licensed assets expire
- **Rights management** — Define who can use which assets based on license terms
- **Audit trail** — Immutable log of every action taken on every asset
- **GDPR/DMCA tools** — Flag and remove assets containing personal data

---

## 🗺 Product Suite Cross-Sell Opportunities

| Feature | Assets + Flow | Assets + Notes | All Three |
|---|---|---|---|
| Asset proof for tasks | ✅ Link deliverables to issues | | ✅ Approval chain |
| Creative brief → upload | | ✅ Notes brief triggers upload template | ✅ End-to-end pipeline |
| Brand consistency checks | ✅ Auto-flag off-brand assets in issues | | ✅ Compliance dashboard |
| Meeting recordings | | ✅ Notes from meetings linked to assets | ✅ Fully searchable archive |
| Cross-product search | ✅ Find assets from Flow | ✅ Find assets from Notes | ✅ Universal search |
| Unified activity feed | ✅ Asset + issue timeline | ✅ Asset + note timeline | ✅ Single timeline |

---

## 📋 Suggested Priority Roadmap

**Phase 1 — Foundation**
1. Asset library (upload, browse, preview, versions)
2. Collections (manual + smart)
3. Tags & metadata (manual + AI auto-tag)
4. Search (full-text + filters)

**Phase 2 — Collaboration**
5. Sharing & permissions
6. Comments & annotations
7. Approval workflows
8. Brand templates & portal

**Phase 3 — Ecosystem**
9. Geiger Flow integration (issue-asset linking)
10. Geiger Notes integration (asset documentation)
11. Universal search across suite
12. Asset API & webhooks

**Phase 4 — Intelligence**
13. AI-powered auto-categorization
14. Duplicate detection
15. Version branching
16. Smart CDN delivery

**Phase 5 — Enterprise**
17. Compliance & governance
18. License tracking
19. Real-time collaboration
20. Headless DAM mode
