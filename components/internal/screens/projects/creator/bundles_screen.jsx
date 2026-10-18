"use client";

// Bundles — several posts sold together at one price on the public creator
// page. Buying a bundle unlocks every pay-per-view post in it for that fan.

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Package, PackagePlus, Pause, Play, SlidersHorizontal } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Checkbox } from "@geiger/ui/checkbox";
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
import { TIER_STATUS_META, centsToDollars, formatDate, formatMoney, parseDollarsToCents } from "./constants";
import {
  ClearFiltersButton,
  CreateDialog,
  FilterDropdown,
  FormSection,
  MoneyField,
  RowActions,
  TextAreaField,
  TextField,
  useCreatorRows,
} from "./creator_kit";
import { MediaPickerDialog } from "./media_picker_dialog";
import { createBundle, deleteBundle, listBundles, listPpvPosts, updateBundle } from "@/lib/supabase/creator";
import { listAssets } from "@/lib/supabase/assets";
import { getUser } from "@/lib/supabase/user";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "On sale" },
  { value: "paused", label: "Paused" },
];

const VISIBILITY_NOTE = { public: "public", members: "members", tier: "tier" };

function valueOf(postIds, postById) {
  return postIds.reduce((s, id) => {
    const p = postById.get(id);
    return s + (p?.visibility === "ppv" ? p.priceCents : 0);
  }, 0);
}

function draftOf(b) {
  return {
    title: b?.title ?? "",
    description: b?.description ?? "",
    price: b ? centsToDollars(b.priceCents) : "",
    postIds: b?.postIds ?? [],
    coverAssetId: b?.coverAssetId ?? null,
    isActive: b ? b.isActive : true,
  };
}

function BundleDialog({ open, onOpenChange, initial, posts, assets, onSubmit, title, submitLabel }) {
  const [draft, setDraft] = useState(() => draftOf(initial));
  const [picking, setPicking] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  React.useEffect(() => {
    if (open) setDraft(draftOf(initial));
  }, [initial, open]);

  const postById = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  const cover = assets.find((a) => a.id === draft.coverAssetId);
  const value = valueOf(draft.postIds, postById);
  const price = parseDollarsToCents(draft.price);
  const toggle = (id) => set("postIds")(draft.postIds.includes(id) ? draft.postIds.filter((x) => x !== id) : [...draft.postIds, id]);

  return (
    <>
      <CreateDialog
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description="Sell several posts together — buying unlocks every pay-per-view post in the bundle."
        submitLabel={submitLabel}
        size="lg"
        footerNote={value ? `Worth ${formatMoney(value)} separately${price && price < value ? ` · ${Math.round((1 - price / value) * 100)}% off` : ""}` : null}
        onSubmit={() =>
          onSubmit({
            title: draft.title.trim(),
            description: draft.description,
            priceCents: price,
            postIds: draft.postIds,
            coverAssetId: draft.coverAssetId || null,
            isActive: draft.isActive,
          })
        }
      >
        <FormSection title="Bundle">
          <TextField label="Title" value={draft.title} onChange={set("title")} placeholder="e.g. Spring shoot — everything" />
          <TextAreaField label="Description" value={draft.description} onChange={set("description")} rows={2} placeholder="What's inside and why it's a deal." />
          <MoneyField label="Bundle price (USD)" value={draft.price} onChange={set("price")} placeholder="19.99" />
          <Field label="Cover" hint="Shown on the bundle card — visible to everyone.">
            <div className="flex items-center gap-3">
              <AssetThumbnail asset={cover} assetId={draft.coverAssetId} className="h-14 w-24 rounded-lg" iconClassName="h-5 w-5" />
              <Button variant="outline" className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground" onClick={() => setPicking(true)}>
                {cover ? "Change" : "Choose cover"}
              </Button>
            </div>
          </Field>
        </FormSection>
        <FormSection title={`Posts (${draft.postIds.length})`} description="Only pay-per-view posts count toward the unlock — others are included for context.">
          {posts.length ? (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border bg-surface-card">
              {posts.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-hover">
                    <Checkbox checked={draft.postIds.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                      {p.visibility === "ppv" ? formatMoney(p.priceCents, p.currency) : VISIBILITY_NOTE[p.visibility]}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-text-tertiary">Publish some posts first.</p>
          )}
        </FormSection>
        <SettingsList>
          <SettingRow title="On sale" description="Paused bundles disappear from your page; buyers keep what they unlocked." checked={draft.isActive} onCheckedChange={set("isActive")} />
        </SettingsList>
      </CreateDialog>
      <MediaPickerDialog
        open={picking}
        onOpenChange={setPicking}
        assets={assets.filter((a) => a.type === "image")}
        selected={draft.coverAssetId ? [draft.coverAssetId] : []}
        max={1}
        title="Bundle cover"
        onDone={(ids) => {
          set("coverAssetId")(ids[0] || null);
          setPicking(false);
        }}
      />
    </>
  );
}

export function BundlesScreen({ projectId }) {
  const [rows, setRows, loading] = useCreatorRows(listBundles, projectId);
  const [allPosts] = useCreatorRows(listPpvPosts, projectId);
  const [assets] = useCreatorRows(listAssets, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const posts = useMemo(() => allPosts.filter((p) => p.status === "published"), [allPosts]);
  const postById = useMemo(() => new Map(allPosts.map((p) => [p.id, p])), [allPosts]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((b) => b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((b) => (b.isActive ? "active" : "paused") === statusFilter);
    return r;
  }, [rows, search, statusFilter]);

  const pager = usePagination(filtered, { resetKey: `${search}|${statusFilter}` });

  const stats = useMemo(() => {
    const sales = rows.reduce((s, b) => s + b.salesCount, 0);
    const revenue = rows.reduce((s, b) => s + b.revenueCents, 0);
    const discounts = rows
      .map((b) => ({ value: valueOf(b.postIds, postById), price: b.priceCents }))
      .filter((x) => x.value > x.price && x.value > 0)
      .map((x) => 1 - x.price / x.value);
    return [
      { label: "Bundles", value: String(rows.length), footer: `${rows.filter((b) => b.isActive).length} on sale` },
      { label: "Sales", value: String(sales), footer: "bundles bought" },
      { label: "Revenue", value: formatMoney(revenue), footer: "gross from bundles" },
      { label: "Avg discount", value: discounts.length ? `${Math.round((discounts.reduce((s, d) => s + d, 0) / discounts.length) * 100)}%` : "—", footer: "vs buying separately" },
    ];
  }, [rows, postById]);

  const replace = (next) => setRows((list) => list.map((b) => (b.id === next.id ? next : b)));

  const validate = (input) => {
    if (!input.title) return "Title is required";
    if (!input.priceCents) return "Set a bundle price";
    if (!input.postIds.some((id) => postById.get(id)?.visibility === "ppv")) return "Add at least one pay-per-view post";
    return null;
  };

  const handleCreate = async (input) => {
    const error = validate(input);
    if (error) return toast.error(error);
    const user = await getUser();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const payload = { ...input, id, projectId, createdBy: user?.id || null };
    setRows((prev) => [{ ...payload, currency: "usd", salesCount: 0, revenueCents: 0, createdAt: now, updatedAt: now }, ...prev]);
    setShowCreate(false);
    const created = await createBundle(payload);
    if (created) {
      replace(created);
      toast.success("Bundle created");
    } else {
      setRows((prev) => prev.filter((b) => b.id !== id));
      toast.error("Could not create the bundle");
    }
  };

  const persist = async (bundle, patch, message) => {
    const prev = rows;
    replace({ ...bundle, ...patch });
    const saved = await updateBundle(bundle.id, patch);
    if (!saved) {
      setRows(prev);
      toast.error("Could not save the bundle");
    } else {
      replace(saved);
      toast.success(message);
    }
  };

  const handleSave = async (input) => {
    if (!editing) return;
    const error = validate(input);
    if (error) return toast.error(error);
    const bundle = editing;
    setEditing(null);
    await persist(bundle, input, "Bundle updated");
  };

  const handleDelete = async (bundle) => {
    const prev = rows;
    setRows((list) => list.filter((b) => b.id !== bundle.id));
    const ok = await deleteBundle(bundle.id);
    if (!ok) {
      setRows(prev);
      toast.error("Could not delete the bundle");
    } else toast.success("Bundle deleted");
  };

  const columns = [
    {
      key: "bundle",
      header: "Bundle",
      render: (b) => (
        <div className="flex min-w-0 items-center gap-3">
          {b.coverAssetId ? (
            <AssetThumbnail asset={assetById.get(b.coverAssetId)} assetId={b.coverAssetId} className="h-10 w-14 shrink-0 rounded-lg" iconClassName="h-4 w-4" />
          ) : (
            <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
              <Package className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{b.title}</p>
            <p className="truncate text-[11px] text-text-tertiary">{b.postIds.length} posts</p>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      className: "whitespace-nowrap tabular-nums text-xs",
      render: (b) => {
        const value = valueOf(b.postIds, postById);
        return (
          <span>
            {formatMoney(b.priceCents, b.currency)}
            {value > b.priceCents ? <span className="ml-1.5 text-text-tertiary line-through">{formatMoney(value)}</span> : null}
          </span>
        );
      },
    },
    { key: "sales", header: "Sales", className: "hidden tabular-nums text-xs sm:table-cell", headClassName: "hidden sm:table-cell", render: (b) => `${b.salesCount} · ${formatMoney(b.revenueCents)}` },
    { key: "status", header: "Status", render: (b) => <StatusPill status={b.isActive ? "active" : "paused"} map={TIER_STATUS_META} className="text-[10px]" /> },
    { key: "updated", header: "Updated", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (b) => formatDate(b.updatedAt) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (b) => (
        <RowActions
          onEdit={() => setEditing(b)}
          onDelete={() => handleDelete(b)}
          extra={[
            b.isActive
              ? { icon: Pause, label: "Pause sales", onSelect: () => persist(b, { isActive: false }, "Bundle paused") }
              : { icon: Play, label: "Put on sale", onSelect: () => persist(b, { isActive: true }, "Bundle on sale") },
          ]}
        />
      ),
    },
  ];

  const hasFilters = statusFilter !== "all" || Boolean(search);
  const clear = () => {
    setStatusFilter("all");
    setSearch("");
  };
  const newBundle = (
    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
      <PackagePlus className="h-4 w-4" />
      New bundle
    </Button>
  );

  return (
    <MainScreenWrapper>
      <ScreenHeader title="Bundles" description="Sell several pay-per-view posts together at one price." actions={newBundle} />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          {hasFilters ? <ClearFiltersButton onClick={clear} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search bundles..." className="w-full sm:w-64" />
      </Toolbar>
      {loading ? (
        <LoadingArea panel className="h-64 py-0" />
      ) : (
        <DataTable
          columns={columns}
          data={pager.pageItems}
          getRowKey={(b) => b.id}
          onRowClick={setEditing}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={Package}
                title={hasFilters ? "No bundles match" : "No bundles yet"}
                description={hasFilters ? "Try adjusting your filters." : "Group pay-per-view posts into a discounted bundle."}
                action={hasFilters ? <ClearFiltersButton onClick={clear} /> : newBundle}
              />
            </div>
          }
        />
      )}
      {!loading ? <ListPagination {...pager} itemLabel="bundles" /> : null}
      <BundleDialog open={showCreate} onOpenChange={setShowCreate} posts={posts} assets={assets} title="New bundle" submitLabel="Create bundle" onSubmit={handleCreate} />
      {editing ? (
        <BundleDialog
          open={Boolean(editing)}
          onOpenChange={(v) => !v && setEditing(null)}
          initial={editing}
          posts={posts}
          assets={assets}
          title={`Edit ${editing.title}`}
          submitLabel="Save changes"
          onSubmit={handleSave}
        />
      ) : null}
    </MainScreenWrapper>
  );
}

export default BundlesScreen;
