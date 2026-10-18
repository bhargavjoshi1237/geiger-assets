"use client";

// Posts — the feed on the public creator page. Every post has a visibility:
// public, members (any tier), a minimum tier, or pay-per-view with its own
// price. The teaser shows to everyone; the body and media stay locked until the
// fan qualifies (enforced server-side on /c/<handle>).

import React, { useEffect, useMemo, useState } from "react";
import { Archive, Eye, FileText, Heart, MessageCircle, Pin, PinOff, SlidersHorizontal, SquarePen, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@geiger/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ListPagination, usePagination } from "@/components/internal/shared/pagination";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SettingRow,
  SettingsList,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { MediaPickerDialog } from "./media_picker_dialog";
import { PostCommentsDialog } from "./post_comments_dialog";
import {
  PPV_STATUS_META,
  POST_VISIBILITY_OPTIONS,
  centsToDollars,
  formatDate,
  formatMoney,
  parseDollarsToCents,
  statusFilterOptions,
} from "./constants";
import {
  ClearFiltersButton,
  CreateDialog,
  FieldRow,
  FilterDropdown,
  FormSection,
  MoneyField,
  RowActions,
  SelectField,
  TextAreaField,
  TextField,
  useCreatorRows,
} from "./creator_kit";
import { createPpvPost, deletePpvPost, getCreatorProfile, listPpvPosts, listTiers, updatePpvPost } from "@/lib/supabase/creator";
import { listAssets } from "@/lib/supabase/assets";
import { getUser } from "@/lib/supabase/user";

const STATUS_FILTERS = statusFilterOptions(PPV_STATUS_META, "All statuses");
const STATUS_OPTIONS = Object.entries(PPV_STATUS_META).map(([value, m]) => ({ value, label: m.label }));
const VISIBILITY_FILTERS = [{ value: "all", label: "All access" }, ...POST_VISIBILITY_OPTIONS];
const VISIBILITY_LABEL = Object.fromEntries(POST_VISIBILITY_OPTIONS.map((o) => [o.value, o.label]));

function draftOf(post) {
  return {
    title: post?.title ?? "",
    visibility: post?.visibility ?? "members",
    minTierId: post?.minTierId ?? "",
    price: post ? centsToDollars(post.priceCents) : "5.00",
    status: post?.status ?? "draft",
    teaserText: post?.teaserText ?? "",
    body: post?.body ?? "",
    assetIds: post?.assetIds ?? [],
    isPinned: Boolean(post?.isPinned),
  };
}

function PostDialog({ open, onOpenChange, initial, tiers, assets, onSubmit, title, submitLabel }) {
  const [draft, setDraft] = useState(() => draftOf(initial));
  const [picking, setPicking] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  React.useEffect(() => {
    if (open) setDraft(draftOf(initial));
  }, [initial, open]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  return (
    <>
      <CreateDialog
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description="The teaser shows to everyone; the body and media unlock for fans who qualify."
        submitLabel={submitLabel}
        size="lg"
        onSubmit={() =>
          onSubmit({
            title: draft.title.trim(),
            visibility: draft.visibility,
            minTierId: draft.visibility === "tier" ? draft.minTierId || null : null,
            priceCents: draft.visibility === "ppv" ? parseDollarsToCents(draft.price) : 0,
            status: draft.status,
            teaserText: draft.teaserText,
            body: draft.body,
            assetIds: draft.assetIds,
            assetId: draft.assetIds[0] || null,
            isPinned: draft.isPinned,
          })
        }
      >
        <FormSection title="Post">
          <TextField label="Title" value={draft.title} onChange={set("title")} placeholder="e.g. Behind the scenes — spring shoot" />
          <TextAreaField label="Teaser" value={draft.teaserText} onChange={set("teaserText")} placeholder="Visible to everyone — what makes fans want in?" rows={2} />
          <TextAreaField label="Body" value={draft.body} onChange={set("body")} placeholder="The full post, shown once unlocked." rows={5} />
          <Field label="Media" hint="Images, video, audio or files — several show as a carousel; the first is the cover.">
            <div className="flex flex-wrap items-center gap-2">
              {draft.assetIds.map((id, i) => (
                <div key={id} className="relative">
                  <AssetThumbnail asset={assetById.get(id)} assetId={id} className="h-14 w-14 rounded-lg" iconClassName="h-5 w-5" />
                  {i === 0 ? <span className="absolute bottom-0.5 left-0.5 rounded bg-background/80 px-1 text-[9px] text-foreground">Cover</span> : null}
                </div>
              ))}
              <Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => setPicking(true)}>
                {draft.assetIds.length ? "Edit media" : "Attach media"}
              </Button>
              {draft.assetIds.length ? (
                <Button variant="ghost" className="text-text-secondary hover:bg-surface-active hover:text-foreground" onClick={() => set("assetIds")([])}>
                  Clear
                </Button>
              ) : null}
            </div>
          </Field>
        </FormSection>
        <FormSection title="Access">
          <FieldRow>
            <SelectField label="Who can see it" value={draft.visibility} onChange={set("visibility")} options={POST_VISIBILITY_OPTIONS} />
            {draft.visibility === "tier" ? (
              <SelectField label="Minimum tier" value={draft.minTierId} onChange={set("minTierId")} placeholder="Select tier" options={tiers.map((t) => ({ value: t.id, label: t.name }))} />
            ) : draft.visibility === "ppv" ? (
              <MoneyField label="Unlock price (USD)" value={draft.price} onChange={set("price")} placeholder="5.00" />
            ) : (
              <SelectField label="Status" value={draft.status} onChange={set("status")} options={STATUS_OPTIONS} />
            )}
          </FieldRow>
          {draft.visibility === "tier" || draft.visibility === "ppv" ? (
            <SelectField label="Status" value={draft.status} onChange={set("status")} options={STATUS_OPTIONS} />
          ) : null}
          <SettingsList>
            <SettingRow icon={Pin} title="Pin to top" description="Pinned posts lead the feed." checked={draft.isPinned} onCheckedChange={set("isPinned")} />
          </SettingsList>
        </FormSection>
      </CreateDialog>
      <MediaPickerDialog
        open={picking}
        onOpenChange={setPicking}
        assets={assets}
        selected={draft.assetIds}
        title="Post media"
        onDone={(ids) => {
          set("assetIds")(ids);
          setPicking(false);
        }}
      />
    </>
  );
}

export function PostsScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listPpvPosts, projectId);
  const [tiers] = useCreatorRows(listTiers, projectId);
  const [assets] = useCreatorRows(listAssets, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [moderating, setModerating] = useState(null);
  const [creatorName, setCreatorName] = useState("");

  useEffect(() => {
    let alive = true;
    getCreatorProfile(projectId).then((p) => {
      if (alive && p && !p.missing) setCreatorName(p.displayName);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const orderedTiers = useMemo(() => [...tiers].sort((a, b) => a.position - b.position), [tiers]);
  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((p) => p.title.toLowerCase().includes(q) || p.teaserText.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((p) => p.status === statusFilter);
    if (visibilityFilter !== "all") r = r.filter((p) => p.visibility === visibilityFilter);
    return [...r].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
  }, [rows, search, statusFilter, visibilityFilter]);

  const pager = usePagination(filtered, { resetKey: `${search}|${statusFilter}|${visibilityFilter}` });

  const stats = useMemo(() => {
    const published = rows.filter((p) => p.status === "published");
    const ppv = rows.filter((p) => p.visibility === "ppv");
    return [
      { label: "Posts", value: String(rows.length), footer: `${published.length} published` },
      { label: "Members-only", value: String(published.filter((p) => p.visibility === "members" || p.visibility === "tier").length), footer: `${published.filter((p) => p.visibility === "public").length} public` },
      { label: "PPV unlocks", value: String(ppv.reduce((s, p) => s + p.unlockCount, 0)), footer: `across ${ppv.length} PPV posts` },
      { label: "PPV revenue", value: formatMoney(ppv.reduce((s, p) => s + p.revenueCents, 0)), footer: "gross from unlocks" },
    ];
  }, [rows]);

  const replace = (next) => setRows((list) => list.map((p) => (p.id === next.id ? next : p)));

  const validate = (input) => {
    if (!input.title) return "Title is required";
    if (input.visibility === "tier" && !input.minTierId) return "Pick the minimum tier";
    if (input.visibility === "ppv" && !input.priceCents) return "Pay-per-view posts need a price";
    return null;
  };

  const withPublishedAt = (input, current) =>
    input.status === "published" && !current?.publishedAt ? { ...input, publishedAt: new Date().toISOString() } : input;

  const handleCreate = async (raw) => {
    const error = validate(raw);
    if (error) return toast.error(error);
    const user = await getUser();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const input = { ...withPublishedAt(raw), id, projectId, createdBy: user?.id || null };
    setRows((prev) => [{ currency: "usd", unlockCount: 0, revenueCents: 0, likeCount: 0, commentCount: 0, createdAt: now, updatedAt: now, ...input }, ...prev]);
    setShowCreate(false);
    const created = await createPpvPost(input);
    if (created) {
      replace(created);
      toast.success(created.status === "published" ? "Post published" : "Post saved as draft");
    } else {
      setRows((prev) => prev.filter((p) => p.id !== id));
      toast.error("Could not create the post");
    }
  };

  const persist = async (post, patch, message) => {
    const prev = rows;
    replace({ ...post, ...patch });
    const saved = await updatePpvPost(post.id, patch);
    if (!saved) {
      setRows(prev);
      toast.error("Could not save the post");
    } else {
      replace(saved);
      toast.success(message);
    }
  };

  const handleSave = async (raw) => {
    if (!editing) return;
    const error = validate(raw);
    if (error) return toast.error(error);
    const post = editing;
    setEditing(null);
    await persist(post, withPublishedAt(raw, post), "Post updated");
  };

  const handleDelete = async (post) => {
    const prev = rows;
    setRows((list) => list.filter((p) => p.id !== post.id));
    const ok = await deletePpvPost(post.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete the post");
    } else toast.success("Post deleted");
  };

  const accessLabel = (p) => {
    if (p.visibility === "ppv") return formatMoney(p.priceCents, p.currency);
    if (p.visibility === "tier") return `${tierById.get(p.minTierId)?.name || "Tier"}+`;
    return VISIBILITY_LABEL[p.visibility] || "—";
  };

  const columns = [
    {
      key: "title",
      header: "Post",
      render: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          {p.assetIds.length ? (
            <div className="relative shrink-0">
              <AssetThumbnail asset={assetById.get(p.assetIds[0])} assetId={p.assetIds[0]} className="h-10 w-10 rounded-lg" iconClassName="h-4 w-4" />
              {p.assetIds.length > 1 ? (
                <span className="absolute -right-1 -top-1 rounded-full border border-border bg-surface-strong px-1 text-[9px] tabular-nums text-foreground">{p.assetIds.length}</span>
              ) : null}
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
              <FileText className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
              {p.isPinned ? <Pin className="h-3 w-3 shrink-0 text-text-tertiary" /> : null}
              <span className="truncate">{p.title}</span>
            </p>
            <p className="truncate text-[11px] text-text-tertiary">{p.teaserText || "No teaser"}</p>
          </div>
        </div>
      ),
    },
    { key: "access", header: "Access", className: "whitespace-nowrap text-xs", render: accessLabel },
    {
      key: "unlocks",
      header: "Unlocks",
      className: "hidden tabular-nums text-xs sm:table-cell",
      headClassName: "hidden sm:table-cell",
      render: (p) => (p.visibility === "ppv" ? `${p.unlockCount} · ${formatMoney(p.revenueCents)}` : "—"),
    },
    {
      key: "engagement",
      header: "Engagement",
      className: "hidden whitespace-nowrap text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (p) => (
        <span className="inline-flex items-center gap-3 tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {p.likeCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {p.commentCount}
          </span>
        </span>
      ),
    },
    { key: "status", header: "Status", render: (p) => <StatusPill status={p.status} map={PPV_STATUS_META} className="text-[10px]" /> },
    {
      key: "date",
      header: "Published",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (p) => formatDate(p.publishedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <RowActions
          onEdit={() => setEditing(p)}
          onDelete={() => handleDelete(p)}
          extra={[
            { icon: MessageCircle, label: `Comments (${p.commentCount})`, onSelect: () => setModerating(p) },
            p.status === "published"
              ? { icon: Archive, label: "Archive", onSelect: () => persist(p, { status: "archived" }, "Post archived") }
              : { icon: Upload, label: "Publish", onSelect: () => persist(p, withPublishedAt({ status: "published" }, p), "Post published") },
            p.isPinned
              ? { icon: PinOff, label: "Unpin", onSelect: () => persist(p, { isPinned: false }, "Post unpinned") }
              : { icon: Pin, label: "Pin to top", onSelect: () => persist(p, { isPinned: true }, "Post pinned") },
          ]}
        />
      ),
    },
  ];

  const hasFilters = statusFilter !== "all" || visibilityFilter !== "all" || Boolean(search);
  const clear = () => {
    setStatusFilter("all");
    setVisibilityFilter("all");
    setSearch("");
  };
  const newPost = (
    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
      <SquarePen className="h-4 w-4" />
      New post
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Posts" description="Your feed — public posts, members-only and tier posts, and pay-per-view unlocks." actions={newPost} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={visibilityFilter} onValueChange={setVisibilityFilter} options={VISIBILITY_FILTERS} placeholder="Access" icon={Eye} />
          {hasFilters ? <ClearFiltersButton onClick={clear} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search posts..." className="w-full sm:w-64" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" />
      ) : (
        <DataTable
          columns={columns}
          data={pager.pageItems}
          getRowKey={(p) => p.id}
          onRowClick={setEditing}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={SquarePen}
                title={hasFilters ? "No posts match" : "No posts yet"}
                description={hasFilters ? "Try adjusting your filters." : "Post something for fans — free, members-only or pay-per-view."}
                action={hasFilters ? <ClearFiltersButton onClick={clear} /> : newPost}
              />
            </div>
          }
        />
      )}
      {!loading ? <ListPagination {...pager} itemLabel="posts" /> : null}
      <PostDialog open={showCreate} onOpenChange={setShowCreate} tiers={orderedTiers} assets={assets} title="New post" submitLabel="Create post" onSubmit={handleCreate} />
      {editing ? (
        <PostDialog
          open={Boolean(editing)}
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing}
          tiers={orderedTiers}
          assets={assets}
          title={`Edit ${editing.title}`}
          submitLabel="Save changes"
          onSubmit={handleSave}
        />
      ) : null}
      {moderating ? (
        <PostCommentsDialog
          post={moderating}
          creatorName={creatorName || "Creator"}
          onOpenChange={(v) => !v && setModerating(null)}
          onCount={(commentCount) => {
            replace({ ...moderating, commentCount });
            updatePpvPost(moderating.id, { commentCount });
          }}
        />
      ) : null}
    </MainScreenWrapper>
  );
}

export default PostsScreen;
