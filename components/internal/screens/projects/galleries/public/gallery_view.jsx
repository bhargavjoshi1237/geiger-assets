"use client";

// The visitor's view of a published gallery. Access was already resolved
// server-side (see app/g/[slug]/page.js) — by the time this renders, the
// visitor is allowed to see the content. What happens here is the interactive
// half: identifying the visitor, favorites, download requests and the event
// trail the Showcase screen reads.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Download, Heart, Lock, Send } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { GalleryGrid } from "../galleries_kit";
import { TYPOGRAPHY_CLASS, withThemeDefaults } from "../constants";
import {
  addFavorite,
  createDownloadRequest,
  listFavorites,
  mintVisitorToken,
  recordGalleryEvent,
  removeFavorite,
  resolveVisitor,
} from "@/lib/supabase/gallery_audience";

const TOKEN_KEY = "geiger_gallery_visitor";

/** Per-browser visitor identity, stable across visits to any gallery. */
function readVisitorToken() {
  try {
    const existing = window.localStorage.getItem(TOKEN_KEY);
    if (existing) return existing;
    const minted = mintVisitorToken();
    window.localStorage.setItem(TOKEN_KEY, minted);
    return minted;
  } catch {
    // Private mode or blocked storage — fall back to a per-session identity.
    return mintVisitorToken();
  }
}

function IdentityDialog({ open, onSubmit, galleryName }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Welcome</DialogTitle>
          <DialogDescription>
            {galleryName
              ? `Tell us who you are before opening ${galleryName}.`
              : "Tell us who you are before opening this gallery."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="bg-surface-card"
          />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="bg-surface-card"
          />
        </div>
        <DialogFooter>
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!valid}
            onClick={() => onSubmit({ name: name.trim(), email: email.trim() })}
          >
            Open gallery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDialog({ open, onOpenChange, onSubmit, count }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const close = (next) => {
    if (!next) setMessage("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Request download</DialogTitle>
          <DialogDescription>
            {count > 0
              ? `Ask for the ${count} asset${count === 1 ? "" : "s"} you favorited.`
              : "Ask for access to the files in this gallery."}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What do you need these for? (optional)"
          rows={3}
          className="bg-surface-card"
        />
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit(message.trim());
              setBusy(false);
              close(false);
            }}
          >
            <Send className="h-4 w-4" />
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GalleryView({ gallery, items }) {
  const theme = useMemo(() => withThemeDefaults(gallery.theme), [gallery.theme]);
  const [visitor, setVisitor] = useState(null);
  const [needsIdentity, setNeedsIdentity] = useState(false);
  const [favorites, setFavorites] = useState(() => new Map());
  const [showRequest, setShowRequest] = useState(false);
  const [requested, setRequested] = useState(false);

  // Identify the visitor, record the visit, and pull back what they already
  // favorited here. A gallery that asks for details holds the dialog open until
  // they're given.
  useEffect(() => {
    let alive = true;
    const token = readVisitorToken();
    resolveVisitor({ galleryId: gallery.id, token, projectId: gallery.projectId }).then(
      async (resolved) => {
        if (!alive) return;
        setVisitor(resolved);
        setNeedsIdentity(Boolean(gallery.requireEmail) && !resolved?.email);
        if (resolved) {
          recordGalleryEvent({
            projectId: gallery.projectId,
            galleryId: gallery.id,
            visitorId: resolved.id,
            kind: "view",
          });
          const rows = await listFavorites(gallery.id);
          if (!alive) return;
          setFavorites(
            new Map(
              (rows ?? [])
                .filter((f) => f.visitorId === resolved.id)
                .map((f) => [f.assetId, f.id]),
            ),
          );
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [gallery.id, gallery.projectId, gallery.requireEmail]);

  const handleIdentity = useCallback(
    async ({ name, email }) => {
      const token = readVisitorToken();
      const updated = await resolveVisitor({
        galleryId: gallery.id,
        token,
        projectId: gallery.projectId,
        name,
        email,
      });
      if (updated) {
        setVisitor(updated);
        setNeedsIdentity(false);
      } else {
        toast.error("Couldn't save your details.");
      }
    },
    [gallery.id, gallery.projectId],
  );

  const favoriteIds = useMemo(() => new Set(favorites.keys()), [favorites]);

  const handleToggleFavorite = async (asset) => {
    if (!visitor) return;
    const existing = favorites.get(asset.id);
    if (existing) {
      setFavorites((prev) => {
        const next = new Map(prev);
        next.delete(asset.id);
        return next;
      });
      const ok = await removeFavorite(existing);
      if (ok) {
        recordGalleryEvent({
          projectId: gallery.projectId,
          galleryId: gallery.id,
          visitorId: visitor.id,
          assetId: asset.id,
          kind: "unfavorite",
        });
      } else {
        setFavorites((prev) => new Map(prev).set(asset.id, existing));
        toast.error("Couldn't update your favorites.");
      }
      return;
    }

    const optimisticId = crypto.randomUUID();
    setFavorites((prev) => new Map(prev).set(asset.id, optimisticId));
    const created = await addFavorite({
      id: optimisticId,
      projectId: gallery.projectId,
      galleryId: gallery.id,
      visitorId: visitor.id,
      assetId: asset.id,
    });
    if (created) {
      recordGalleryEvent({
        projectId: gallery.projectId,
        galleryId: gallery.id,
        visitorId: visitor.id,
        assetId: asset.id,
        kind: "favorite",
      });
    } else {
      setFavorites((prev) => {
        const next = new Map(prev);
        next.delete(asset.id);
        return next;
      });
      toast.error("Couldn't save that favorite.");
    }
  };

  const handleRequest = async (message) => {
    if (!visitor) return;
    const assetIds = Array.from(favoriteIds);
    const created = await createDownloadRequest({
      id: crypto.randomUUID(),
      projectId: gallery.projectId,
      galleryId: gallery.id,
      visitorId: visitor.id,
      scope: assetIds.length > 0 ? "selection" : "gallery",
      assetIds,
      message,
      status: "pending",
    });
    if (created) {
      setRequested(true);
      recordGalleryEvent({
        projectId: gallery.projectId,
        galleryId: gallery.id,
        visitorId: visitor.id,
        kind: "request",
      });
      toast.success("Request sent.");
    } else {
      toast.error("Couldn't send the request.");
    }
  };

  const handleOpen = (asset) => {
    if (!visitor) return;
    recordGalleryEvent({
      projectId: gallery.projectId,
      galleryId: gallery.id,
      visitorId: visitor.id,
      assetId: asset.id,
      kind: "item_view",
    });
  };

  const light = theme.ground === "light";

  return (
    <div
      className={cn(
        "min-h-screen",
        TYPOGRAPHY_CLASS[theme.typography] || TYPOGRAPHY_CLASS.sans,
        light ? "bg-zinc-100 text-zinc-900" : "bg-background text-foreground",
      )}
    >
      <header
        className={cn(
          "border-b",
          light ? "border-zinc-300" : "border-border",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{gallery.name}</h1>
            {gallery.headline ? (
              <p className={cn("truncate text-sm", light ? "text-zinc-600" : "text-muted-foreground")}>
                {gallery.headline}
              </p>
            ) : null}
          </div>

          <nav className="flex flex-wrap items-center gap-4">
            {(gallery.nav || [])
              .filter((link) => link.label && link.href)
              .map((link, i) => (
                <a
                  key={`${link.href}-${i}`}
                  href={link.href}
                  className={cn(
                    "text-sm transition-colors hover:underline",
                    light ? "text-zinc-700" : "text-text-secondary",
                  )}
                  style={{ textDecorationColor: theme.accent }}
                >
                  {link.label}
                </a>
              ))}

            {gallery.downloadMode === "request" ? (
              <Button
                size="sm"
                disabled={requested}
                onClick={() => setShowRequest(true)}
                style={{ background: theme.accent }}
                className="text-white hover:opacity-90"
              >
                {requested ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                {requested ? "Requested" : "Request download"}
              </Button>
            ) : null}

            {gallery.downloadMode === "off" ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  light ? "text-zinc-500" : "text-text-tertiary",
                )}
              >
                <Lock className="h-3 w-3" aria-hidden="true" />
                Downloads off
              </span>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {gallery.description ? (
          <p
            className={cn(
              "mb-6 max-w-2xl text-sm",
              light ? "text-zinc-600" : "text-muted-foreground",
            )}
          >
            {gallery.description}
          </p>
        ) : null}

        {items.length === 0 ? (
          <p
            className={cn(
              "py-24 text-center text-sm",
              light ? "text-zinc-500" : "text-text-tertiary",
            )}
          >
            This gallery is empty.
          </p>
        ) : (
          <GalleryGrid
            items={items}
            theme={theme}
            layout={gallery.layout}
            favorites={favoriteIds}
            onToggleFavorite={
              gallery.allowFavorites && visitor ? handleToggleFavorite : undefined
            }
            onOpen={handleOpen}
          />
        )}

        {gallery.allowFavorites && favoriteIds.size > 0 ? (
          <p
            className={cn(
              "mt-6 inline-flex items-center gap-1.5 text-xs",
              light ? "text-zinc-600" : "text-text-secondary",
            )}
          >
            <Heart className="h-3 w-3 fill-red-400 text-red-400" aria-hidden="true" />
            {favoriteIds.size} favorite{favoriteIds.size === 1 ? "" : "s"} saved
          </p>
        ) : null}
      </main>

      <IdentityDialog
        open={needsIdentity}
        onSubmit={handleIdentity}
        galleryName={gallery.name}
      />
      <RequestDialog
        open={showRequest}
        onOpenChange={setShowRequest}
        onSubmit={handleRequest}
        count={favoriteIds.size}
      />
    </div>
  );
}

export default GalleryView;
