"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Code2, Copy, History, Link2, Loader2, Trash2 } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { ActionMenu } from "@geiger/ui/action-menu";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { listAssets, listVersions } from "@/lib/supabase/assets";
import {
  createShareLink,
  listShareLinks,
  revokeShareLink,
} from "@/lib/supabase/delivery";
import {
  EMBED_KIND_OPTIONS,
  SHARE_SCOPE_MAP,
  SHARE_TTL_OPTIONS,
  SHARE_VARIANT_OPTIONS,
  formatDateTime,
} from "./constants";

// Embeds & Headless — stable URLs and embed codes for using assets outside the
// DAM UI, built on the signed share-link route (POST /api/media/share).
//
// Two URL families: session URLs (`/api/media/<id>/<variant>`) that keep the
// workspace permission check, and bearer token URLs (`/t/<token>`) that carry
// their own expiry and need no session. Only the token form is embeddable
// externally. Tokens pin an asset, not a version — the version list below is
// context showing what a link resolves to today.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function stableUrl(assetId, variant) {
  if (!assetId) return "";
  const suffix = variant && variant !== "original" ? `/${variant}` : "";
  return `${BASE}/api/media/${assetId}${suffix}`;
}

function embedFor(kind, { url, name, variant, scope, expiresAt }) {
  const safeName = String(name || "Embedded asset").replace(/"/g, "");
  if (kind === "img") {
    return `<img src="${url}" alt="${safeName}" loading="lazy" />`;
  }
  if (kind === "json") {
    return JSON.stringify(
      { asset: safeName, variant, scope, url, expiresAt },
      null,
      2,
    );
  }
  return `<iframe src="${url}" width="960" height="540" loading="lazy" allow="fullscreen" title="${safeName}"></iframe>`;
}

export function EmbedsHeadlessScreen({ projectId }) {
  const [assets, setAssets] = useState([]);
  const [versions, setVersions] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [assetId, setAssetId] = useState("");
  const [variant, setVariant] = useState("original");
  const [scope, setScope] = useState("view");
  const [ttl, setTtl] = useState("86400");
  const [embedKind, setEmbedKind] = useState("iframe");
  const [minting, setMinting] = useState(false);
  const [minted, setMinted] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listAssets(projectId), listShareLinks(projectId)]).then(
      ([assetRows, linkRows]) => {
        if (!alive) return;
        const list = assetRows ?? [];
        setAssets(list);
        setLinks(linkRows ?? []);
        if (list.length > 0) setAssetId(list[0].id);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!assetId) {
      setVersions([]);
      return;
    }
    let alive = true;
    setVersionsLoading(true);
    listVersions(assetId).then((rows) => {
      if (!alive) return;
      setVersions(rows ?? []);
      setVersionsLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [assetId]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return assets;
    return assets.filter((asset) =>
      `${asset.name} ${asset.type} ${asset.format}`.toLowerCase().includes(needle),
    );
  }, [assets, search]);

  const selected = useMemo(
    () => assets.find((asset) => asset.id === assetId) || null,
    [assets, assetId],
  );

  const stats = useMemo(() => {
    const active = links.filter((link) => {
      if (!link.expiresAt) return true;
      return new Date(link.expiresAt).getTime() > Date.now();
    });
    return [
      { label: "Assets", value: String(assets.length), footer: "embeddable in this project" },
      { label: "Share links", value: String(links.length), footer: "minted bearer URLs" },
      { label: "Unexpired", value: String(active.length), footer: "still resolving today" },
      { label: "Versions", value: String(versions.length), footer: "on the selected asset" },
    ];
  }, [assets, links, versions]);

  const selectAsset = (id) => {
    setAssetId(id);
    setMinted(null);
  };

  const mintLink = async () => {
    if (!selected || minting) return;
    setMinting(true);
    try {
      const res = await fetch(`${BASE}/api/media/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selected.id,
          variant,
          scope,
          ttlSeconds: Number(ttl),
        }),
      });
      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      if (!res.ok || !payload?.token || !payload?.url) {
        toast.error(
          payload?.error === "signing_unconfigured"
            ? "Token signing is not configured on the server."
            : "Could not mint a share link.",
        );
        return;
      }
      const record = { token: payload.token, url: payload.url, expiresAt: payload.expiresAt ?? null };
      setMinted(record);
      // Ledger only — the bearer token itself is never stored, just a prefix.
      const id = crypto.randomUUID();
      const optimistic = {
        id,
        projectId,
        assetId: selected.id,
        variant,
        scope,
        tokenPrefix: String(payload.token).slice(0, 12),
        expiresAt: record.expiresAt,
        createdAt: new Date().toISOString(),
      };
      setLinks((rows) => [optimistic, ...rows]);
      const created = await createShareLink({
        id,
        projectId,
        assetId: selected.id,
        variant,
        scope,
        tokenPrefix: String(payload.token).slice(0, 12),
        expiresAt: record.expiresAt,
      });
      if (created) {
        setLinks((rows) => rows.map((l) => (l.id === id ? created : l)));
      } else {
        setLinks((rows) => rows.filter((l) => l.id !== id));
      }
      toast.success("Share link minted.");
    } catch (e) {
      console.error("[embeds.mint]", e);
      toast.error("Could not mint a share link.");
    } finally {
      setMinting(false);
    }
  };

  const revoke = async (link) => {
    const previous = links;
    setLinks((rows) => rows.filter((l) => l.id !== link.id));
    const ok = await revokeShareLink(link.id);
    if (!ok) {
      setLinks(previous);
      toast.error("Could not revoke the link.");
      return;
    }
    toast.success("Share link revoked.");
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Copy failed — select the text manually.");
    }
  };

  const embedCode = useMemo(() => {
    if (!minted || !selected) return "";
    return embedFor(embedKind, {
      url: minted.url,
      name: selected.name,
      variant,
      scope,
      expiresAt: minted.expiresAt,
    });
  }, [minted, selected, embedKind, variant, scope]);

  const linkColumns = [
    {
      key: "link",
      header: "Link",
      render: (link) => {
        const asset = assets.find((a) => a.id === link.assetId);
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="max-w-[240px] truncate font-medium text-foreground">
              {asset?.name || "Deleted asset"}
            </span>
            <span className="font-mono text-[11px] text-text-tertiary">
              {link.tokenPrefix ? `${link.tokenPrefix}…` : "—"}
              {` · expires ${formatDateTime(link.expiresAt)}`}
            </span>
          </div>
        );
      },
    },
    {
      key: "variant",
      header: "Variant",
      render: (link) => <Badge variant="neutral">{link.variant}</Badge>,
    },
    {
      key: "scope",
      header: "Scope",
      render: (link) => <StatusPill status={link.scope} map={SHARE_SCOPE_MAP} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (link) => (
        <ActionMenu
          label="Actions for share link"
          items={[
            {
              icon: Trash2,
              label: "Revoke",
              destructive: true,
              onSelect: () => revoke(link),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Embeds & Headless"
        description="Use assets in applications without coupling to the DAM UI."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={mintLink}
            disabled={!selected || minting}
          >
            {minting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Generate embed
          </Button>
        }
      />

      <StatsBar stats={stats} />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading embeds" />
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Code2}
            title="No assets to embed"
            description="Upload an asset first — embeds always point at a real stored object."
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <SectionCard
            title="Source asset"
            description="The token names this asset and one variant."
            className="lg:col-span-2"
          >
            <div className="space-y-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Search assets…" />
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={Code2}
                    title="No assets match"
                    description="Try a different search term."
                    action={
                      search.trim() ? (
                        <Button
                          variant="outline"
                          className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                          onClick={() => setSearch("")}
                        >
                          Clear search
                        </Button>
                      ) : null
                    }
                  />
                ) : (
                  filtered.map((asset) => {
                    const active = asset.id === assetId;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => selectAsset(asset.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                          active
                            ? "border-border-strong bg-surface-active"
                            : "border-border bg-surface-card hover:bg-surface-hover"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {asset.name || "Untitled asset"}
                          </span>
                          <span className="block truncate text-[11px] text-text-tertiary">
                            {[asset.type, asset.format].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </span>
                        {active ? <Badge variant="info">Source</Badge> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </SectionCard>

          <div className="space-y-6 lg:col-span-3">
            <SectionCard
              title="Share-link options"
              description="Minted by the share route — bearer URLs with their own expiry."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Variant" htmlFor="embed-variant">
                  <Select value={variant} onValueChange={setVariant}>
                    <SelectTrigger id="embed-variant" className="bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHARE_VARIANT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Scope" htmlFor="embed-scope">
                  <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger id="embed-scope" className="bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View</SelectItem>
                      <SelectItem value="download">Download</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Expires in" htmlFor="embed-ttl">
                  <Select value={ttl} onValueChange={setTtl}>
                    <SelectTrigger id="embed-ttl" className="bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHARE_TTL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="mt-4 rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-xs text-text-secondary">
                Stable URL (session-gated, not embeddable externally):{" "}
                <span className="text-foreground">{stableUrl(selected?.id, variant) || "—"}</span>
              </div>
            </SectionCard>

            {minted ? (
              <SectionCard
                title="Embed code"
                description={`Expires ${formatDateTime(minted.expiresAt)}.`}
                action={
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-card p-1">
                    {EMBED_KIND_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setEmbedKind(option.value)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          embedKind === option.value
                            ? "bg-surface-active text-foreground"
                            : "text-text-secondary hover:text-foreground"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                }
              >
                <pre className="overflow-x-auto rounded-md border border-border bg-surface-card p-3 font-mono text-xs leading-relaxed text-foreground">
                  {embedCode}
                </pre>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                    onClick={() => copyText(embedCode, "Embed code")}
                  >
                    <Copy className="h-4 w-4" /> Copy embed code
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <SectionCard
                title="Embed code"
                description="Generate an embed to get a token URL plus iframe, img-tag, and JSON snippets."
              >
                <p className="text-sm text-text-secondary">
                  Pick a variant, scope, and expiry, then generate. Headless clients take
                  the JSON form; pages and CMS rich-text fields take the iframe or img tag.
                </p>
              </SectionCard>
            )}

            <SectionCard
              title="Version-aware embeds"
              description="Tokens pin the asset — they always resolve to the current version below."
            >
              {versionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LogoLoading size={40} aria-label="Loading versions" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  No versions recorded for this asset yet — links serve the stored file.
                </p>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          v{version.versionNumber}
                          {version.label ? ` — ${version.label}` : ""}
                        </span>
                        <span className="block truncate text-[11px] text-text-tertiary">
                          {version.note || formatDateTime(version.createdAt)}
                        </span>
                      </span>
                      {version.isCurrent ? <Badge variant="success">Current</Badge> : null}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      <Toolbar>
        <span className="text-xs text-text-tertiary">
          The ledger below records what was minted — prefixes only, never the bearer token.
        </span>
      </Toolbar>
      <DataTable
        columns={linkColumns}
        data={links}
        getRowKey={(link) => link.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={History}
              title="No share links yet"
              description="Minted links are recorded here so they can be identified and revoked."
            />
          </div>
        }
      />
    </MainScreenWrapper>
  );
}

export default EmbedsHeadlessScreen;
