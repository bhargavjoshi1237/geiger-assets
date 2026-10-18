"use client";

// Creator Page — the builder for the public /c/<handle> page. Left: Sections
// (the Home tab's blocks), Design (theme, header, nav), Profile and Settings.
// Right: the real page in a live preview, fed every unsaved edit and viewable
// as any kind of fan.
//
// Saving stores profile details and the layout draft (creator_profiles.page_draft);
// fans keep seeing the last published layout (page_config) until Publish.

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EmptyState, LoadingArea, ScreenHeader, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { useProject } from "@/context/project-context";
import { ImagePickerDialog } from "@/components/internal/screens/projects/media/editing/editor/image_picker_dialog";
import { listAssets } from "@/lib/supabase/assets";
import {
  createCreatorProfile,
  getCreatorProfile,
  isHandleAvailable,
  listPpvPosts,
  listTiers,
  publishCreatorPage,
  updateCreatorProfile,
} from "@/lib/supabase/creator";
import { getUser } from "@/lib/supabase/user";
import { defaultPageConfig, normalizePageConfig, pageAssetIds } from "@/lib/creator/page_config";
import { cn } from "@/lib/utils";
import { centsToDollars, parseDollarsToCents } from "./constants";
import { SectionsPanel } from "./page_builder/sections_panel";
import { DesignPanel } from "./page_builder/design_panel";
import { ProfilePanel, SettingsPanel } from "./page_builder/profile_panels";
import { PreviewFrame } from "./page_builder/preview_frame";

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9_-]{1,30}[a-z0-9])$/;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const PANELS = [
  { value: "sections", label: "Sections" },
  { value: "design", label: "Design" },
  { value: "profile", label: "Profile" },
  { value: "settings", label: "Settings" },
];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function draftOf(p) {
  return {
    handle: p.handle,
    displayName: p.displayName,
    tagline: p.tagline,
    bio: p.bio,
    avatarAssetId: p.avatarAssetId,
    bannerAssetId: p.bannerAssetId,
    links: p.links,
    isPublished: p.isPublished,
    tipsEnabled: p.tipsEnabled,
    minTip: centsToDollars(p.minTipCents),
    suggestedTips: p.suggestedTips.map((c) => (c / 100).toString()).join(", "),
    messagesEnabled: p.messagesEnabled,
    welcomeMessage: p.welcomeMessage,
  };
}

function toInput(d, page) {
  return {
    handle: d.handle.trim().toLowerCase(),
    displayName: d.displayName.trim(),
    tagline: d.tagline.trim(),
    bio: d.bio,
    avatarAssetId: d.avatarAssetId || null,
    bannerAssetId: d.bannerAssetId || null,
    // Kept in step with the theme so fan-account cards elsewhere match the page.
    accentColor: page.theme.accent,
    links: d.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    isPublished: d.isPublished,
    tipsEnabled: d.tipsEnabled,
    minTipCents: Math.max(50, parseDollarsToCents(d.minTip)),
    suggestedTips: d.suggestedTips
      .split(",")
      .map((v) => parseDollarsToCents(v))
      .filter((c) => c > 0)
      .slice(0, 4),
    messagesEnabled: d.messagesEnabled,
    welcomeMessage: d.welcomeMessage,
  };
}

/** The layout the builder opens with: the saved draft, else the live page, else the starter. */
function savedPageOf(p) {
  return normalizePageConfig(p.pageDraft || p.pageConfig || defaultPageConfig(p));
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function CreatorPageScreen({ projectId }) {
  const { project } = useProject();
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [page, setPage] = useState(null);
  const [assets, setAssets] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [panel, setPanel] = useState("sections");
  const [picking, setPicking] = useState(null);
  const [focus, setFocus] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [origin, setOrigin] = useState("");
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    let alive = true;
    Promise.all([getCreatorProfile(projectId), listAssets(projectId), listTiers(projectId), listPpvPosts(projectId)]).then(([p, a, t, posts]) => {
      if (!alive) return;
      setOrigin(`${window.location.origin}${BASE}`);
      setAssets((a || []).filter((x) => x.type === "image" || x.type === "video"));
      setTiers((t || []).filter((x) => x.isActive).sort((x, y) => x.position - y.position));
      setPosts(posts || []);
      if (p && !p.missing) {
        setProfile(p);
        setDraft(draftOf(p));
        setPage(savedPageOf(p));
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const savedPage = useMemo(() => (profile ? savedPageOf(profile) : null), [profile]);
  const normalized = useMemo(() => (page ? normalizePageConfig(page) : null), [page]);
  const dirty = Boolean(profile && draft && page) && (!same(draftOf(profile), draft) || !same(normalized, savedPage));
  const livePage = profile?.pageConfig ? normalizePageConfig(profile.pageConfig) : null;
  const unpublished = Boolean(profile) && (!profile.isPublished || !livePage || !same(savedPage, livePage));
  const publicUrl = profile && origin ? `${origin}/c/${profile.handle}` : "";

  // Everything the preview needs to show unsaved edits without a round trip.
  const previewDraft = useMemo(() => {
    if (!profile || !draft || !page) return null;
    const handle = profile.handle;
    const shape = (a) =>
      a
        ? {
            id: a.id,
            type: a.type,
            color: a.color,
            thumbnailUrl: a.thumbnailUrl || "",
            miniThumbnailUrl: a.miniThumbnailUrl || "",
            url: `${BASE}/c/${encodeURIComponent(handle)}/media?page=${a.id}&preview=1`,
          }
        : null;
    const input = toInput(draft, normalized);
    return {
      profile: {
        displayName: input.displayName || handle,
        tagline: input.tagline,
        bio: input.bio,
        links: input.links,
        tipsEnabled: input.tipsEnabled,
        minTipCents: input.minTipCents,
        suggestedTips: input.suggestedTips,
        messagesEnabled: input.messagesEnabled,
      },
      page,
      pageAssets: Object.fromEntries(pageAssetIds(normalized).map((id) => [id, shape(assetById.get(id))]).filter(([, a]) => a)),
      avatar: shape(assetById.get(draft.avatarAssetId)),
      banner: shape(assetById.get(draft.bannerAssetId)),
    };
  }, [profile, draft, page, normalized, assetById]);

  const create = async () => {
    const handle = slugify(project?.slug || project?.name) || `creator-${String(projectId).slice(0, 6)}`;
    const available = await isHandleAvailable(handle);
    const user = await getUser();
    setSaving("create");
    const base = { displayName: project?.name || "", accentColor: "#f97316" };
    const created = await createCreatorProfile({
      id: crypto.randomUUID(),
      projectId,
      handle: available ? handle : `${handle}-${String(projectId).slice(0, 4)}`,
      displayName: base.displayName,
      isPublished: false,
      pageDraft: defaultPageConfig(base),
      createdBy: user?.id || null,
    });
    setSaving(null);
    if (!created) return toast.error("Couldn't create the creator page");
    setProfile(created);
    setDraft(draftOf(created));
    setPage(savedPageOf(created));
    toast.success("Creator page created — make it yours, then publish");
  };

  const validate = async (input) => {
    if (!HANDLE_RE.test(input.handle)) return "Handles are 3–32 lowercase letters, numbers, - or _";
    if (!input.displayName) return "Display name is required";
    if (input.handle !== profile.handle && !(await isHandleAvailable(input.handle, profile.id))) return "That handle is taken";
    return null;
  };

  const persist = async (mode) => {
    if (saving) return;
    const config = normalizePageConfig(page);
    const input = toInput(draft, config);
    const problem = await validate(input);
    if (problem) return toast.error(problem);
    setSaving(mode);
    const saved = mode === "publish" ? await publishCreatorPage(profile.id, input, config) : await updateCreatorProfile(profile.id, { ...input, pageDraft: config });
    setSaving(null);
    if (!saved) return toast.error(mode === "publish" ? "Couldn't publish the page" : "Couldn't save the page");
    setProfile(saved);
    setDraft(draftOf(saved));
    setPage(savedPageOf(saved));
    setReloadKey((k) => k + 1);
    if (mode === "publish") toast.success("Published — your page is live");
    else toast.success(saved.isPublished ? "Draft saved — publish to show fans" : "Draft saved");
  };

  const discard = () => {
    setDraft(draftOf(profile));
    setPage(savedPageOf(profile));
  };

  if (loading) {
    return (
      <MainScreenWrapper>
        <LoadingArea size={72} className="h-[60vh]" />
      </MainScreenWrapper>
    );
  }

  if (!profile) {
    return (
      <MainScreenWrapper>
        <ScreenHeader title="Creator Page" description="Your public page — where fans find your posts, join a tier, tip and message." />
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Sparkles}
            title="Set up your creator page"
            description="Design a page for your fans at /c/your-handle — your feed, tiers, bundles, tips and DMs, styled your way."
            action={
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={Boolean(saving)} onClick={create}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Create creator page
              </Button>
            }
          />
        </div>
      </MainScreenWrapper>
    );
  }

  const status = dirty ? "Unsaved changes" : !profile.isPublished ? "Not live" : unpublished ? "Draft not published" : "Live";
  const ctx = {
    tiers,
    posts,
    assetById,
    pickAsset: (opts) => setPicking(opts),
    focusSection: (id) => setFocus({ id, at: Date.now() }),
  };

  return (
    <MainScreenWrapper className="space-y-6 lg:max-w-[94%]">
      <ScreenHeader
        title="Creator Page"
        description="Design the page your fans see — sections, theme and layout, previewed live as any kind of fan."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-text-secondary">
              <span className={cn("h-1.5 w-1.5 rounded-full", status === "Live" ? "bg-emerald-400" : dirty ? "bg-amber-400" : "bg-text-tertiary")} />
              {status}
            </span>
            {profile.isPublished ? (
              <Button asChild variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground">
                <a href={`${BASE}/c/${profile.handle}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  View live
                </a>
              </Button>
            ) : null}
            {dirty ? (
              <Button variant="ghost" className="text-text-secondary hover:bg-surface-active hover:text-foreground" disabled={Boolean(saving)} onClick={discard}>
                <RotateCcw className="h-4 w-4" />
                Discard
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              disabled={!dirty || Boolean(saving)}
              onClick={() => persist("draft")}
            >
              {saving === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={(!dirty && !unpublished) || Boolean(saving)} onClick={() => persist("publish")}>
              {saving === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {profile.isPublished ? "Publish changes" : "Publish"}
            </Button>
          </div>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col rounded-xl border border-border bg-surface-subtle xl:sticky xl:top-4 xl:h-[calc(100dvh-7rem)]">
          <div className="border-b border-border p-3">
            <SegmentedTabs tabs={PANELS} value={panel} onChange={setPanel} fullWidth />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {panel === "sections" ? <SectionsPanel sections={page.sections} onChange={(sections) => setPage((p) => ({ ...p, sections }))} ctx={ctx} /> : null}
            {panel === "design" ? <DesignPanel page={page} onChange={setPage} ctx={ctx} /> : null}
            {panel === "profile" ? <ProfilePanel draft={draft} set={set} ctx={ctx} /> : null}
            {panel === "settings" ? (
              <SettingsPanel draft={draft} set={set} page={page} onPageChange={setPage} publicUrl={publicUrl} published={profile.isPublished} />
            ) : null}
          </div>
        </div>

        <div className="h-[78dvh] xl:sticky xl:top-4 xl:h-[calc(100dvh-7rem)]">
          <PreviewFrame handle={profile.handle} draft={previewDraft} tiers={tiers} focus={focus} reloadKey={reloadKey} />
        </div>
      </div>

      <ImagePickerDialog
        open={Boolean(picking)}
        onOpenChange={(v) => !v && setPicking(null)}
        assets={picking ? assets.filter((a) => picking.kinds.includes(a.type)) : []}
        currentLabel="Current"
        title={picking?.title || "Choose an image"}
        description="Pick from this project's library."
        onPick={(asset) => {
          picking.onPick(asset);
          setPicking(null);
        }}
      />
    </MainScreenWrapper>
  );
}

export default CreatorPageScreen;
