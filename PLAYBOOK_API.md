# Playbook GraphQL API — Field Notes

Reverse-engineered from recorded browser sessions on playbook.com (the `render`
workspace, free plan) on 2026-09-25, then replayed from Node to confirm each
recipe. This is **competitor research**, not a supported integration: the API is
unofficial and undocumented, the operation IDs change when Playbook ships a new
frontend, and automated use may breach their Terms of Service. Use it to
understand how Playbook works and to inform geiger-assets — don't build product
features on top of it.

> **Never commit a Playbook JWT, cookie or magic-link token.** Every example below
> reads the token from `PB_JWT`. A JWT is a full account credential for ~30 days.

---

## 1. How the API works

| | |
|---|---|
| Endpoint | `https://www.playbook.com/graphql` (one endpoint for everything) |
| Server | Rails + graphql-ruby Pro, behind Cloudflare |
| Query style | **Persisted queries only** — the client sends an ID, never query text |
| Queries | `GET`, all params in the URL (edge-cacheable, `ETag`/`If-None-Match`) |
| Mutations | `POST`, JSON body |
| IDs | Every object is addressed by a 24-char public **token** (`AfWxtd2HMpGabkqpzZXw5JnM`), never a numeric id |

### Persisted query IDs

```
extensions = { "operationId": "graphql-frontend-prod/8addd1617887d1c2ffed4649f4b04a38" }
                               └─ client name ──────┘ └─ md5(query text) ─────────────┘
```

- This is graphql-ruby Pro's **OperationStore**. At build time
  `graphql-ruby-client sync` uploads each query and registers it under
  `md5(query text)`.
- The server looks the ID up and runs the stored document with your `variables`.
  You **cannot change the selection set**, and sending no ID fails:
  `{"errors":[{"message":"No query string was present"}]}`.
- The MD5 is one-way. The query text can't be recovered from it.
- **IDs change whenever Playbook edits a query.** If a call starts failing after
  their deploy, record a new session (§9) and update the IDs.

### Required headers

Only three matter. Sentry, New Relic, `anonid` and the other browser tracking
headers can be dropped.

```
authorization: Bearer <PB_JWT>
organization:  <workspace slug>      # e.g. "render"
clienttype:    web-app
```

### Request helper

```js
const PB = "https://www.playbook.com/graphql";
const HEADERS = {
  authorization: `Bearer ${process.env.PB_JWT}`,
  organization: "render",
  clienttype: "web-app",
  "content-type": "application/json",
};
const op = (hash) => `graphql-frontend-prod/${hash}`;

// Queries: GET with everything URL-encoded.
async function query(operationName, hash, variables = {}) {
  const url = `${PB}?${new URLSearchParams({
    operationName,
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({ operationId: op(hash) }),
  })}`;
  const json = await (await fetch(url, { headers: HEADERS })).json();
  if (json.errors) throw new Error(`${operationName}: ${JSON.stringify(json.errors)}`);
  return json.data;
}

// Mutations: POST with a JSON body.
async function mutate(operationName, hash, variables = {}) {
  const res = await fetch(PB, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ operationName, variables, extensions: { operationId: op(hash) } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(`${operationName}: ${JSON.stringify(json.errors)}`);
  return json.data;
}
```

---

## 2. Authentication

Login is **passwordless (magic link)**:

1. `RequestMagicLinkMutation({ email, state, force: false, userInput: null })` →
   `{ status: "SENT" }` and Playbook emails a link.
2. `MagicLoginMutation({ magicToken, signUpParamInput: {}, mfaDeviceToken: null })`
   → `{ jwt, user, isNewUser, mfaChallengeToken }`.

The JWT (HS256) payload looks like this:

```json
{ "id": 371750, "pwd_digest": "e3b0c442…", "exp": 1792977371, "jti": "23f11acf-…" }
```

- **Lifetime is ~30 days.** A login at 2026-09-25 13:16 UTC produced a token
  expiring 2026-10-26 01:16 UTC.
- **There is no refresh token.** No refresh mutation, header or field appeared in
  any recording. When the token expires, log in again by magic link.
- `pwd_digest` is the user's password digest. For a magic-link account it is
  `sha256("")`. Changing the password changes it, which revokes every issued JWT.
  `jti` allows revoking a single token.
- The user object has a `cliJwt` field, which was `null` for us. It is probably a
  separate credential for a CLI or app login flow that we never triggered.
- The browser also carries the JWT as a `jwt` cookie plus a Rails `_session_id`
  cookie, but the `authorization` header alone is enough.

To get a token manually: log in at playbook.com, open DevTools → Network, pick any
`/graphql` request and copy its `authorization` header.

---

## 3. Recipes

The tokens below are the real test objects from the recording sessions:
workspace `render`, board "Glock 18" `ksoyBiS9bivbaZpEmqEggeJF`, and board
"Test Board" `YAVyS9RYfnpZzZEFaR1S7X3j`.

### 3.1 List workspaces

```js
const { organizationSwitcher } = await query("OrganizationSwitcherQuery", "e41c5ec6e4a1dcce1529c9ecda10238b", { limit: 50 });
// [{ slug, name, plan, currentUserRole, membersCount, hasBillingIssue, isPreferred }]
```

The `slug` is what goes in the `organization` header.

### 3.2 List boards

```js
const { treeCollections } = await query("BoardTreeQuery", "30e2815608a53cefd7e533902217b69a", {
  excludeEmpty: false, tokens: [], filterByTokens: false,
});
// Flat list of every board in the workspace (25 in `render`):
// { token, title, description, emoji, collectionType, parent: { token } | null,
//   hasChildren, hidden, isFavorited, isReadOnly, permissions[], viewMode, createdAt }
```

Rebuild the tree from `parent.token`. `BoardTreeTokensQuery`
(`3ec125790cac6e4247f085bd864e0d20`, `{ tokens: [] }`) returns just
`{ token, hidden }` for each board and is a cheap existence check.

### 3.3 Board details

```js
const { collection } = await query("CollectionQuery", "f198be2f083278b34998752011b72b51", {
  collectionToken: "ksoyBiS9bivbaZpEmqEggeJF", kept: true, assigneesLimit: 6,
});
```

Related board queries (all take `{ collectionToken }` unless noted):

| Operation | Hash | Returns |
|---|---|---|
| `CollectionStatsQuery` | `e5fee018f0dc4128885991a1af537406` | board stats |
| `CollectionAssetCountQuery` | `1af623582c0c5f920faec9f85c156fc1` | count (`+ kept, filters`) |
| `CollectionEffectiveRulesQuery` | `c1d894e983c5fd3459986ced35087252` | inherited upload rules |
| `BoardSharingMenuQuery` | `62e1d69aabafef446e20a755c5c3a977` | sharing settings |
| `ActiveSharedBoardLinkQuery` | `ebecaf4868e8a118afda308f2cc6709c` | public share link |
| `GetCollectionGuests` | `0f226fa5d98a76b7c387f44b4d6dc709` | guests |
| `CollectionEventsQuery` | `5f74e5353c69962f939697a411a8d620` | activity feed (`+ filterCollectionEventTypes[]`) |

### 3.4 List assets in a board

```js
const { collection } = await query("CollectionAssetsQuery", "6186a0412fcb737b2a951815ef1904c4", {
  collectionToken: "ksoyBiS9bivbaZpEmqEggeJF",
  first: 40,
  sort: { field: "CREATED_AT", direction: "DESC" },
  filters: {},
  includeSubboards: false,
  sortBySubboards: true,
  discarded: false,      // true = trashed assets
  includeGroups: false,
  incompleteOnly: false,
  // after: "<pageInfo.endCursor>"   // next page (cursor looks like an asset token)
});
const { edges, pageInfo } = collection.assetsCursor;   // pageInfo: { endCursor, hasNextPage }
const assets = edges.map((e) => e.node);
```

- Each node already includes a **signed `url`**, `thumbnails[]`, `displayUrl`,
  `blurhash`, `averageColor`, size, dimensions, tags, statuses and the licence.
  One list call gives temporary links for the whole page.
- **Groups (versions/variants) come back as a single node** with `isGroup: true`,
  even with `includeGroups: false`. Expand them with §3.5 (`asset.children`).
- Pagination via `after` follows the Relay convention but is **unverified**: every
  board we tested fit on one page.
- `RollupViewCollectionQuery` (`d1a30c88e099f492f5520ef21f810d3b`,
  `{ token, kept, discarded, filters, first }`) and `RollupViewPaginatedQuery`
  (`2401c14518ac764fa22e5999cc10ce8f`, `{ fromBoard, depth, limit, kept, filters }`)
  return a board together with its sub-boards' assets.

### 3.5 Get one asset (and its temporary link)

```js
const { asset } = await query("FullAssetModalQuery", "8addd1617887d1c2ffed4649f4b04a38", {
  assetToken: "AfWxtd2HMpGabkqpzZXw5JnM",
});
asset.url;        // signed original, valid until 23:59:59 UTC today
asset.children;   // group members when asset.isGroup
asset.permalink;  // permanent public link, or null (see §4)
```

This returns every asset field: file info, EXIF, the group and its children, the
board breadcrumb, permissions, `assetUsageTerms` (licence),
approval, reactions, ratings, `viewEventCount`, `downloadEventCount`,
`identicalAssets` and `discardedAt`. Comments are separate:
`AssetCommentsQuery` (`c648c55fbea4fe6e0cc6edeb84c7ce67`, `{ assetToken }`).

### 3.6 Create and rename boards

```js
// Top-level board. The client may mint the token itself (the web app does).
await mutate("CreateCollectionMutation", "a44b4e9c77da1fb9fc74f704d3c7fc2e", {
  token: "<24-char token>", title: "Untitled board", assetTokens: [],
});
// Sub-board: pass the parent and let the server assign the token.
await mutate("CreateCollectionMutation", "a44b4e9c77da1fb9fc74f704d3c7fc2e", {
  title: "Test Sub Board", assetTokens: [], parentCollectionToken: "YAVyS9RYfnpZzZEFaR1S7X3j",
});
// Rename (other board fields are probably patchable the same way).
await mutate("UpdateCollectionMutation", "33be2321a8f09d08f80ec1f0129bd880", {
  token: "YAVyS9RYfnpZzZEFaR1S7X3j", title: "Test Board",
});
```

`assetTokens` seeds the new board with existing assets. The response returns the
full `collection`.

### 3.7 Upload a file

Upload happens in five steps: reserve the upload, send the bytes over
**tus 1.0** (the resumable-upload protocol) in 1 MiB chunks with a checksum on
each, verify, then register the asset. Tested with a 15.9 MB PDF (16 chunks) and a
3.5 KB PNG. The file downloaded afterwards had the same MD5 as the local copy.

```js
import { createHash, randomUUID } from "node:crypto";

const bytes = readFileSync(file);
const uuid = randomUUID();                       // client-side id for this file
const size = String(bytes.length);               // sizes are strings
const mediaType = "application/pdf";

// 1. Reserve the upload.
const { beginBatchUpload: begin } = await mutate("BeginBatchUpload", "76be9dfa53c446d431c321b757bf3e32", {
  collectionToken: board, confirmedOverageTb: null,
  uploadAttributes: [{ uuid, title, mediaType, size }],
});
const slot = begin.uploadAssets[0];
// slot: { gcsId, signedGcsId, signedTusUploadUrl, uploadUrl, fileExtension,
//         encryptedOrganizationMetadata, storageProvider: "gcs", errors[] }

// 2. Create the tus upload → 201 + Location on a storage shard (/upload/tus/sh2/<id>).
const created = await fetch(slot.signedTusUploadUrl, {
  method: "POST",
  headers: {
    "tus-resumable": "1.0.0",
    "upload-length": size,
    "x-upload-content-type": mediaType,
    "x-amz-meta-encrypted-organization-metadata": slot.encryptedOrganizationMetadata,
    "x-amz-meta-extension": slot.fileExtension,
    "playbook-upload-trace": `${slot.gcsId}/0`,
  },
});
const location = created.headers.get("location");

// 3. PATCH 1 MiB chunks, each with a sha256 checksum → 204 + new upload-offset.
for (let offset = 0; offset < bytes.length; offset += 1024 * 1024) {
  const chunk = bytes.subarray(offset, offset + 1024 * 1024);
  await fetch(location, {
    method: "PATCH",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Offset": String(offset),
      "Content-Type": "application/offset+octet-stream",
      "Upload-Checksum": `sha256 ${createHash("sha256").update(chunk).digest("base64")}`,
      "playbook-upload-trace": `${slot.gcsId}/0`,
    },
    body: chunk,
  });
}

// 4. HEAD must report upload-offset === upload-length.
await fetch(location, { method: "HEAD", headers: { "Tus-Resumable": "1.0.0" } });

// 5. Register the asset → returns { token, title, size, url }.
const { completeBatchUpload } = await mutate("CompleteBatchUpload", "c8ea09df85aeab5fee0dbe3e83f6a93c", {
  batchId: begin.batchId, collectionToken: board, folderContexts: [""],
  dropzone: false, disableAutoCleanup: false,
  uploadAttributes: [{
    uuid, signedGcsId: slot.signedGcsId, title, mediaType, size, position: 0,
    md5: createHash("md5").update(bytes).digest("hex"),   // whole-file md5
    uploadStartedAt: new Date().toISOString(),
    // width, height: the browser sends these for images; optional (omitting them worked)
  }],
});
```

Notes:

- The signed tus URL is valid for a day, and the tus upload itself can be resumed
  for ~2 days (`upload-expires`). `uploadUrl` is a non-resumable alternative that
  we didn't test.
- The whole-file `md5` is probably what powers duplicate detection
  (`identicalAssets`).
- `BeginBatchUpload`/`CompleteBatchUpload` take arrays, so one batch can hold many
  files. On the free plan `simultaneousUploadsLimit` is 1 and a batch holds at
  most 1,000 files (`UploadLimitQuery`).
- `CollectionsByTitlesMutation` (`8bbb97cad7d5b220e05bfb366e423c5b`,
  `{ collectionTitles[], collectionToken }`) runs before each upload. It maps
  dropped folder names to sub-boards and is a no-op for single files.
- `confirmedOverageTb` and `confirmationRequired` are the over-quota handshake.

### 3.8 Delete (to Trash) and archive

```js
// Soft delete: sets discardedAt, moves the asset to Trash, frees a quota slot.
await mutate("DeleteAssetsMutation", "ae050cbe867f36ca1589baed1858abed", { assetTokens: [token] });
// Archive: moves the asset into the special "Archive" board, frees a quota slot.
await mutate("ArchiveAssetsMutation", "69cf92bd383ded5e3bf8f5a162c4448e", { tokens: [token] });

// Browse them
await query("DeletedAssetsQuery", "638debffe3b7f2c80e18b66a4831d793", { limit: 40, offset: 0 });
await query("ArchiveCollectionsQuery", "605f9549b04be9bbb045b605db10563f");   // → the Archive board's token
```

Not recorded yet: emptying the Trash (permanent delete), restoring from Trash or
Archive, and moving assets between boards.

### 3.9 Check quota

```js
const { organization: o } = await query("OrganizationStorageQuery", "b8ebf656b90993df5dd964c9bdd8f55a");
// { assetCount, billableAssets, assetsLimitRemaining, availableUploadSlots, pendingUploadsCount,
//   assetSize, effectiveIncludedStorage, plan: { name, assetsLimit, storageLimit, includedStorage } }
```

---

## 4. Links: temporary vs permanent

| Field | Example | Expires | Auth to fetch |
|---|---|---|---|
| `url` (original) | `prod.playbookstatic.com/v0/8/<gcsId>?ttl=daily&verify=<epoch>-<sig>` | **daily**, at 23:59:59 UTC | none |
| `displayUrl` | `img.playbook.com/<sig>/s:W:H/exp:<epoch>/<b64 src>` | `exp:` (~2 days) | none |
| `thumbnails[]` / `safeThumbnail` | `img.playbook.com/<sig>/w:750/<b64 src>` | no `exp`, but the encoded source is the daily-signed `url` | none |
| `permalink` | `img.playbook.com/<sig>/<b64 "gs://playbook-assets-public/<uuid>">` | **never** (until revoked) | none |

**Temporary links, which are unlimited:**

- Any query that returns an asset gives a fresh `url`. It is **the same string all
  day**, because the signature is deterministic per day, so you can cache it until
  midnight UTC.
- It serves the **byte-for-byte original** (the MD5 matched) with no login.
- The signature is enforced: a modified signature or no query string returns `403`.
- A stable permanent URL can be built on top of this: a proxy that fetches today's
  `url` and redirects to it.

**Permanent permalinks, which are limited (10 on the free plan):**

- `CreateAssetPermalinksMutation` (`a14a20b700a23b6d7de713d2e1c5e598`,
  `{ assetTokens: [...] }`) returns `{ token, permalink }` for each asset.
- `PermalinksQuery` (`c0ac478b044e7540a34c7b7f3c67a09f`, `{ limit, offset }`) →
  `organization.permalinkCount / permalinkLimit`.
- The link points at a **processed copy in a public GCS bucket** (107,290 bytes
  against a 115,372-byte original) and is served with
  `Cache-Control: public, max-age=31536000`. Anyone with the URL can hotlink it
  forever, and Playbook can't meter it. That uncontrolled bandwidth is why
  permalinks are capped.
- The img.playbook.com URLs are imgproxy style: `<signature>/<processing
  options>/<base64url of the source URL, split into path segments>`.

---

## 5. Plan limits and what counts

Free plan limits, read from the API:

| Limit | Value | Source |
|---|---|---|
| Assets | **300** | `plan.assetsLimit` |
| Storage | 100 GB | `plan.storageLimit` |
| Permalinks | 10 | `permalinkLimit` |
| Shared links | 5 | `plan.sharedLinkLimit` |
| Searches | 10 | `plan.searchQueriesLimit` |
| Users | 3 | `plan.userLimit` |
| Simultaneous uploads / files per batch | 1 / 1,000 | `UploadLimitQuery` |
| Transcription minutes | 0 | `plan.monthlyTranscriptionMinutesLimit` |

**The asset limit is a cap on stored files, not "300 uploads a month":**

- `assetsLimitRemaining = assetsLimit − billableAssets`, computed on the server.
  There is no period or reset field.
- **Each upload uses one slot, whatever its size.** A 3.5 KB PNG took one slot,
  the same as a 15.9 MB PDF. Uploads through the API count exactly like browser
  uploads (171 → 172 billable, immediately).

| Action | `assetCount` | `billableAssets` | Counts toward the limit | Links still work |
|---|---|---|---|---|
| Upload | +1 | +1 | yes | yes |
| Delete (Trash) | unchanged* | −1 | **no** | **yes** (`FullAssetModalQuery` still returns a working `url`) |
| Archive | unchanged | −1 | **no** | **yes** (original and thumbnails serve `200`) |

\* The asset remains, with `discardedAt` set.

**Retention.** The API has no retention field (`expiresAt` belongs to the licence
feature and is always `null`). According to Playbook's
[Terms of Service](https://www.playbook.com/p/terms/):

- Archive is "a temporary state". Archived content inactive for "an extended
  period" **may be moved to Trash and permanently deleted**. No number of days is
  given.
- If an account exceeds plan limits, Playbook **may archive content
  automatically**.
- Free workspaces unused for **6 months** may be deleted, after notice.
- The Playbook FAQ mentions **45-day backups**.

So the "trash or archive to stay under the limit" loophole exists technically, but
it isn't durable and it isn't something to rely on.

---

## 6. Data model (observed)

- **Organization (workspace):** plan and limits, feature flags, storage totals,
  custom status types.
- **Collection (board):** a nested tree (depth-limited). It carries a title,
  emoji, description, view mode (grid/list/kanban), permissions, guests, share
  links, favourite/follow state, and `CollectionRules`, which are inherited by
  child boards: required licence, copyright, expiry date and tags, plus
  statuses/tags applied automatically. The "Archive" board is a special
  collection with `isArchived: true`.
- **Asset:** the file plus `thumbnails`, `blurhash`, `averageColor`, EXIF,
  `mediaType`, dimensions, `size` (string), `originalExtension`. Assets can form a
  **group** (versions/variants, `isGroup` + `children`, `variantBadges`). An asset
  also carries `assetUsageTerms` (licence, e.g. CC BY-NC), `approved`, tags
  (manual/managed/AI auto-tags), `statuses`, ratings, reactions, comments,
  `viewEventCount`/`downloadEventCount`, and `identicalAssets` (duplicates, likely
  by MD5).
- **StatusType → Status:** custom workflow fields (name, colour, sort, pinned).
- **Tag:** name, colour, `assetCount`, `isManaged`/`isManual`.
- **Event:** analytics via `CreateEventMutation` (`7effc34c78833655cf7a708cd03ebcec`,
  `{ eventType, collectionToken, assetToken }`, e.g. `VIEW_BOARD`). These feed the
  view counts and the "recent" suggestions.

---

## 7. Operation catalogue

All IDs are `graphql-frontend-prod/<hash>`, captured 2026-09-25.

| Operation | Kind | Hash | Variables |
|---|---|---|---|
| ActiveSharedBoardLinkQuery | query | `ebecaf4868e8a118afda308f2cc6709c` | `collectionToken` |
| AiAgentConversationsQuery | query | `1e29010a93a3e685938fdf6e7059eddf` | `limit, offset` |
| AiHistoryQuery | query | `e578029bc4d9bbe3383cf0f592446c1f` | `limit` |
| AiSearchSuggestions | query | `29d7f596bc985b92fd71ff2fd6e448c3` | — |
| AllMediaUnreadCommentCountQuery | query | `029d83050d526068ff57ba2501df53f5` | — |
| ArchiveAssetsMutation | mutation | `69cf92bd383ded5e3bf8f5a162c4448e` | `tokens[]` |
| ArchiveCollectionsQuery | query | `605f9549b04be9bbb045b605db10563f` | — |
| AssetCommentsQuery | query | `c648c55fbea4fe6e0cc6edeb84c7ce67` | `assetToken` |
| AsyncServiceJobsQuery | query | `4b54072d57d9b4fd60137ffaf69ab39a` | — |
| AutoTagLimitQuery | query | `4c193568a58cd9d8ddd670c8733835f0` | — |
| AvailableCouponQuery | query | `1339bf6c66c34bf589467f3f17f9a774` | `planName, billingPeriod, couponType` |
| BeginBatchUpload | mutation | `76be9dfa53c446d431c321b757bf3e32` | `collectionToken, confirmedOverageTb, uploadAttributes[]` |
| BoardSharingMenuQuery | query | `62e1d69aabafef446e20a755c5c3a977` | `collectionToken` |
| BoardTreeQuery | query | `30e2815608a53cefd7e533902217b69a` | `excludeEmpty, tokens[], filterByTokens` |
| BoardTreeTokensQuery | query | `3ec125790cac6e4247f085bd864e0d20` | `tokens[]` |
| CollectionAssetCountQuery | query | `1af623582c0c5f920faec9f85c156fc1` | `collectionToken, kept, filters` |
| CollectionAssetsQuery | query | `6186a0412fcb737b2a951815ef1904c4` | see §3.4 |
| CollectionEffectiveRulesQuery | query | `c1d894e983c5fd3459986ced35087252` | `collectionToken` |
| CollectionEventsCollectionContextQuery | query | `9446aa1585b945b6484d1f50120d4431` | `collectionToken` |
| CollectionEventsQuery | query | `5f74e5353c69962f939697a411a8d620` | `collectionToken, filterCollectionEventTypes[]` |
| CollectionFavoritesQuery | query | `873ba9f2db17f3d72534f290a4f4539b` | — |
| CollectionGuestsLimitQuery | query | `f2c7a77c849c224a929655fc93f21f56` | `collectionToken` |
| CollectionQuery | query | `f198be2f083278b34998752011b72b51` | `collectionToken, kept, assigneesLimit` |
| CollectionStatsQuery | query | `e5fee018f0dc4128885991a1af537406` | `collectionToken` |
| CollectionTreeDepthLimitQuery | query | `7b9a09a83f2e0297b5d8e2aa874b4cc6` | `collectionToken` |
| CollectionUnreadCommentCountQuery | query | `a58958758b7f4db4179dbde8472056ff` | `collectionToken` |
| CollectionsByTitlesMutation | mutation | `8bbb97cad7d5b220e05bfb366e423c5b` | `collectionTitles[], collectionToken` |
| CompleteBatchUpload | mutation | `c8ea09df85aeab5fee0dbe3e83f6a93c` | see §3.7 |
| CreateAssetPermalinksMutation | mutation | `a14a20b700a23b6d7de713d2e1c5e598` | `assetTokens[]` |
| CreateCollectionMutation | mutation | `a44b4e9c77da1fb9fc74f704d3c7fc2e` | `token?, title, assetTokens[], parentCollectionToken?` |
| CreateEventMutation | mutation | `7effc34c78833655cf7a708cd03ebcec` | `eventType, collectionToken, assetToken?` |
| CustomPageLayouts | query | `4c9f3b3c8a611c687205fcbd04c79582` | — |
| DeleteAssetsMutation | mutation | `ae050cbe867f36ca1589baed1858abed` | `assetTokens[]` |
| DeletedAssetsQuery | query | `638debffe3b7f2c80e18b66a4831d793` | `limit, offset` |
| FeatureFlagsQuery | query | `56f597b662f792e8caf984304e7efa6e` | `slug` |
| FullAssetModalQuery | query | `8addd1617887d1c2ffed4649f4b04a38` | `assetToken` |
| GetCollectionGuests | query | `0f226fa5d98a76b7c387f44b4d6dc709` | `collectionToken` |
| ImportRunsQuery | query | `c47b2936e6ad9f3388c52943b0bffb70` | — |
| MagicLoginMutation | mutation | `377a57533368f819f2178288797b8430` | `magicToken, signUpParamInput, mfaDeviceToken` |
| MeQuery | query | `40dc64ce0d3c58b99db2684c7a4740eb` | — |
| OrgPartnerSubscriptionQuery | query | `ac9308abace44d782c689dfda64ae050` | `partnerName` |
| OrganizationMediaTypesQuery | query | `837552115218eb68af9c33a06a1698f3` | — |
| OrganizationRootQuery | query | `207458dc171e44a458fb577ef25cd02e` | — |
| OrganizationSearchLimitQuery | query | `2d97fa16d618c76df421eadb8ae97624` | — |
| OrganizationStatusTypesQuery | query | `859d59270ec0d2e086f38129e2ef67f3` | — |
| OrganizationStatusesQuery | query | `ff754851275b32a0732569fd1b97ca87` | — |
| OrganizationStorageQuery | query | `b8ebf656b90993df5dd964c9bdd8f55a` | — |
| OrganizationSwitcherQuery | query | `e41c5ec6e4a1dcce1529c9ecda10238b` | `limit` |
| PermalinksQuery | query | `c0ac478b044e7540a34c7b7f3c67a09f` | `limit, offset` |
| PlanMemberLimitQuery | query | `e68afee1a7ee9f3350d7728921aeb516` | `planName` |
| PopularTagsQuery | query | `f01fbae248f05593250819d4642c3fa3` | — |
| PurchaseQuery | query | `e1abf926001cfa03b954c6269ab38020` | `planName` |
| ReactjisQuery | query | `41b7e0a3feda3cbbdc80dd3378faa351` | `assetToken` |
| RecentSuggestionsQuery | query | `906d8627fddc5297b7be359aa63c5076` | `limit, aiSearchEnabled` |
| RequestMagicLinkMutation | mutation | `64031fae1d4cd9f415d4d37f8850ef77` | `email, state, force, userInput` |
| RollupViewCollectionQuery | query | `d1a30c88e099f492f5520ef21f810d3b` | `token, kept, discarded, filters, first` |
| RollupViewPaginatedQuery | query | `2401c14518ac764fa22e5999cc10ce8f` | `fromBoard, depth, limit, kept, filters` |
| SearchOrganizationsQuery | query | `ab39ff0d70e9d8caa48b431434a600bd` | `query, limit, restrictToMembership` |
| SearchSimilarAssetsQuery | query | `bd6b5e97ca447c5274194e2801210c66` | `token, limit` |
| UpdateCollectionMutation | mutation | `33be2321a8f09d08f80ec1f0129bd880` | `token, title` |
| UploadLimitQuery | query | `2573c5e9368a4a32d239ef836ccdf5d2` | — |
| UserNotificationsQuery | query | `5c8512d40b2760cfa09b9e6b0eeb0639` | — |

---

## 8. Not yet recorded

- Permanent delete / empty Trash, and restore from Trash or Archive
- Revoking a permalink
- Moving and copying assets between boards
- Deleting and archiving boards
- Tags, statuses, ratings, comments and licence writes
- Share links (create/revoke)
- Search (text and AI)
- Pagination with `after` on large boards
- The `cliJwt` flow
- Trash/Archive retention in days (not published)

---

## 9. How to record more

The notes above came from Chrome's DevTools Protocol, not from a proxy:

1. Launch Chrome with a throwaway profile. Chrome refuses remote debugging on the
   default profile, so you'll have to log in again once:
   ```sh
   chrome.exe --remote-debugging-port=9222 --user-data-dir=<scratch>/chrome-profile https://www.playbook.com/
   ```
2. Attach a small Node 22+ recorder (built-in `WebSocket`) to
   `http://127.0.0.1:9222/json/version` → `webSocketDebuggerUrl`. It should:
   - send `Target.setDiscoverTargets`, then attach to each page with
     `Target.attachToTarget({ flatten: true })` and call `Network.enable`;
   - on `Network.requestWillBeSent`, keep `/graphql` calls plus non-GET fetch/XHR
     calls (to catch the tus upload);
   - on `Network.loadingFinished`, fetch the response body with
     `Network.getResponseBody` and append one JSON line per call;
   - **strip `authorization`, `cookie` and `set-cookie`** before writing.
3. Perform one action at a time, a few seconds apart, then close Chrome.
4. Group the lines by `operationName` to get each new operation's hash, variables
   and response shape.

The capture still contains credentials in response bodies (`MagicLoginMutation`
returns a JWT). Keep captures and the Chrome profile out of the repo and delete
them afterwards.

---

## 10. What this means for geiger-assets

- **Unlimited files.** Playbook's free plan caps stored assets at 300, whatever
  their size. Charge for storage and bandwidth, not file count.
- **Unlimited permanent links are cheap for us.** Our `/d/<project>/<asset>/…`
  route (`app/d/[projectId]/[assetId]/[...rest]/route.js`) is a stable URL that
  redirects to a short-lived signed URL. It makes no public copy, can be switched
  off per asset (`delivery_enabled`), and is metered in `api_usage`. Meter
  bandwidth, not links.
- **Deleted and archived files must stop serving.** Playbook still returns working
  links for trashed and archived assets. Our delivery route already 404s on
  `deleted_at`; any new archive state should do the same.
- **Publish a clear retention policy** ("archive is kept until you delete it;
  Trash empties after N days"). Playbook's archive "may be deleted after an
  extended period", with no date.
- **Long-lived API credentials.** Playbook has only a 30-day JWT with magic-link
  re-login. Our `gk_live_…` project API keys (`lib/api/auth.js`: hashed,
  permission-scoped, optional expiry, revocable, usage-tracked) are the better
  model for scripts and integrations.
- **Ideas worth adopting:**
  - resumable tus uploads with per-chunk checksums;
  - a two-step reserve → register upload flow;
  - client-computed MD5 for duplicate detection;
  - batch endpoints (arrays everywhere);
  - asset groups for versions/variants;
  - board rules inherited by sub-boards (require licence/copyright/expiry/tags,
    auto-apply statuses);
  - blurhash + average colour placeholders.
