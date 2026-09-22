"use client";

import React, { useEffect, useState } from "react";
import { Download, FolderOpen, Layers, Link2Off, Lock } from "lucide-react";

import { EmptyState, LoadingArea } from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";

import { resolveShareToken, touchShareToken } from "@/lib/supabase/shares";
import { getAsset } from "@/lib/supabase/assets";
import { getCollection, listCollectionAssets } from "@/lib/supabase/collections";

import { formatDate, initials } from "./constants";

function AssetTile({ asset }) {
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
      <div className="flex aspect-[4/3] items-center justify-center bg-surface-card">
        {asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailUrl}
            alt={asset.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className="flex h-14 w-14 items-center justify-center rounded-xl text-base font-semibold text-text-secondary"
            style={asset.color ? { backgroundColor: `${asset.color}20` } : undefined}
            aria-hidden="true"
          >
            {initials(asset.name)}
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-medium text-foreground">{asset.name}</p>
        <p className="text-xs text-text-secondary">
          {asset.type}
          {asset.format ? ` · ${asset.format}` : ""}
        </p>
      </div>
    </li>
  );
}

/**
 * The recipient's view of a shared link. Read-only by design in this pass —
 * see the route file for what is and isn't enforced.
 */
export function SharedLinkView({ token }) {
  const [link, setLink] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    resolveShareToken(token).then(async (resolved) => {
      if (!alive) return;
      if (!resolved) {
        setLink(null);
        setLoading(false);
        return;
      }
      setLink(resolved);
      touchShareToken(token);

      if (resolved.subjectType === "collection") {
        const [collection, rows] = await Promise.all([
          getCollection(resolved.subjectId),
          listCollectionAssets(resolved.subjectId),
        ]);
        if (!alive) return;
        setLink((prev) => ({ ...prev, targetName: collection?.name || prev.name }));
        // listCollectionAssets returns join rows — unwrap to the assets themselves.
        setAssets((rows ?? []).map((row) => row.asset).filter(Boolean));
      } else {
        const asset = await getAsset(resolved.subjectId);
        if (!alive) return;
        setLink((prev) => ({ ...prev, targetName: asset?.name || prev.name }));
        setAssets(asset ? [asset] : []);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4">
        <LoadingArea size={72} label="Opening shared link…" />
      </main>
    );
  }

  if (!link) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Link2Off}
            title="This link isn't available"
            description="It may have expired, been revoked, or never existed. Ask whoever shared it for a new link."
          />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">
            {link.subjectType === "collection" ? (
              <>
                <Layers className="h-3 w-3" /> Collection
              </>
            ) : (
              <>
                <FolderOpen className="h-3 w-3" /> Asset
              </>
            )}
          </Badge>
          {link.hasPassword ? (
            <Badge variant="warning">
              <Lock className="h-3 w-3" /> Password set
            </Badge>
          ) : null}
          {link.allowDownload ? (
            <Badge variant="info">
              <Download className="h-3 w-3" /> Downloads allowed
            </Badge>
          ) : null}
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {link.targetName || link.name}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Shared with you via Geiger Assets
          {link.expiresAt ? ` · access ends ${formatDate(link.expiresAt)}` : ""}
        </p>
      </header>

      {assets.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <AssetTile key={asset.id} asset={asset} />
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={FolderOpen}
            title="Nothing to show"
            description="This link resolves, but the assets behind it aren't available."
          />
        </div>
      )}
    </main>
  );
}

export default SharedLinkView;
