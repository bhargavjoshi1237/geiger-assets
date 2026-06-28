"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  FolderPlus,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  FolderInput,
  Settings2,
  Folder as FolderIcon,
  FolderOpen,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  StatsBar,
  SearchInput,
  StatusPill,
  EmptyState,
  DataTable,
  Toolbar,
  Field,
} from "@/components/internal/shared/screen_kit";
import {
  STORAGE_META,
  STORAGE_OPTIONS,
  FOLDER_COLORS,
  formatBytes,
  formatDate,
} from "./constants";
import {
  listFolders,
  createFolder,
  softDeleteFolder,
} from "@/lib/supabase/folders";
import { FolderDetailScreen } from "./folder_detail";

function FolderGlyph({ color, open }) {
  const Icon = open ? FolderOpen : FolderIcon;
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
      style={{ background: `${color}15`, borderColor: `${color}25` }}
    >
      <Icon className="h-4 w-4" style={{ color: color || "#737373" }} />
    </div>
  );
}

function RowActions({ folder, onOpen, onDetails, onDelete }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Folder actions"
            className="h-7 w-7 text-text-secondary hover:bg-surface-hover hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="end">
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onOpen(folder)}
          >
            <FolderInput className="mr-2 h-3.5 w-3.5" /> Open
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onDetails(folder)}
          >
            <Settings2 className="mr-2 h-3.5 w-3.5" /> Details
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-surface-hover" />
          <DropdownMenuItem
            className="cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400"
            onClick={() => onDelete(folder)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const EMPTY_DRAFT = {
  name: "",
  parentId: null,
  storageLocation: "hot",
  color: FOLDER_COLORS[0],
};

function CreateFolderDialog({ open, onOpenChange, folders, defaultParentId, onCreate }) {
  const [draft, setDraft] = useState(() => ({ ...EMPTY_DRAFT, parentId: defaultParentId ?? null }));
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    await onCreate(draft);
    setBusy(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Folder</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Create a folder and choose where its source files live.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" htmlFor="folder-name">
            <Input
              id="folder-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Brand Assets"
              className="border-border bg-surface-card text-foreground"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Parent">
              <Select
                value={draft.parentId ?? "root"}
                onValueChange={(v) => set("parentId")(v === "root" ? null : v)}
              >
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  <SelectItem value="root" className="text-xs">
                    Root
                  </SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Storage Location">
              <Select value={draft.storageLocation} onValueChange={set("storageLocation")}>
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {STORAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Color">
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use color ${c}`}
                  onClick={() => set("color")(c)}
                  className={cn(
                    "h-7 w-7 rounded-md border transition-transform hover:scale-105",
                    draft.color === c ? "border-border-strong ring-2 ring-border" : "border-border",
                  )}
                  style={{ background: `${c}25`, borderColor: `${c}40` }}
                >
                  <span
                    className="mx-auto block h-3 w-3 rounded-full"
                    style={{ background: c }}
                  />
                </button>
              ))}
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={busy || !draft.name.trim()}
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Create Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FoldersScreen({ projectId }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentParentId, setCurrentParentId] = useState(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [openFolderId, setOpenFolderId] = useState(null);

  useEffect(() => {
    listFolders(projectId).then((rows) => {
      setFolders(rows ?? []);
      setLoading(false);
    });
  }, []);

  const byId = useMemo(() => {
    const map = new Map();
    folders.forEach((f) => map.set(f.id, f));
    return map;
  }, [folders]);

  // Breadcrumb trail from the current folder up to the root.
  const trail = useMemo(() => {
    const crumbs = [];
    let node = currentParentId ? byId.get(currentParentId) : null;
    while (node) {
      crumbs.unshift(node);
      node = node.parentId ? byId.get(node.parentId) : null;
    }
    return crumbs;
  }, [currentParentId, byId]);

  const searching = Boolean(search.trim());

  const visible = useMemo(() => {
    if (searching) {
      const q = search.toLowerCase();
      return folders.filter((f) => f.name.toLowerCase().includes(q));
    }
    return folders.filter((f) => (f.parentId ?? null) === currentParentId);
  }, [folders, search, searching, currentParentId]);

  const childCount = useMemo(() => {
    const counts = new Map();
    folders.forEach((f) => {
      const key = f.parentId ?? "root";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [folders]);

  const stats = useMemo(() => {
    const totalBytes = folders.reduce((sum, f) => sum + f.sizeBytes, 0);
    const hot = folders.filter((f) => f.storageLocation === "hot").length;
    const cloud = folders.filter((f) => f.storageLocation?.startsWith("cloud")).length;
    return [
      { label: "Total Folders", value: String(folders.length), footer: "in this project" },
      { label: "Storage Used", value: formatBytes(totalBytes), footer: "across all folders" },
      { label: "Hot", value: String(hot), footer: "fast-access tier" },
      { label: "Cloud", value: String(cloud), footer: "object storage" },
    ];
  }, [folders]);

  const handleCreate = async (draft) => {
    const id = crypto.randomUUID();
    const parent = draft.parentId ? byId.get(draft.parentId) : null;
    const basePath = parent ? parent.path || `/${parent.name}` : "";
    const path = `${basePath}/${draft.name.trim()}`;
    const optimistic = {
      id,
      name: draft.name.trim(),
      parentId: draft.parentId ?? null,
      path,
      storageLocation: draft.storageLocation,
      color: draft.color,
      sizeBytes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setFolders((rows) => [...rows, optimistic]);
    const created = await createFolder({
      id,
      name: optimistic.name,
      parentId: optimistic.parentId,
      path,
      storageLocation: optimistic.storageLocation,
      color: optimistic.color,
      sizeBytes: 0,
    });
    if (created) {
      setFolders((rows) => rows.map((f) => (f.id === id ? created : f)));
    } else {
      setFolders((rows) => rows.filter((f) => f.id !== id));
    }
  };

  const handleDelete = async (folder) => {
    const prev = folders;
    setFolders((rows) => rows.filter((f) => f.id !== folder.id));
    const ok = await softDeleteFolder(folder.id);
    if (!ok) setFolders(prev);
  };

  const syncRow = (updated) =>
    setFolders((rows) => rows.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));

  const navigateInto = (folder) => {
    setSearch("");
    setCurrentParentId(folder.id);
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (f) => {
        const subs = childCount.get(f.id) || 0;
        return (
          <div className="flex items-center gap-3">
            <FolderGlyph color={f.color} open={subs > 0} />
            <div className="min-w-0">
              <p className="max-w-[280px] truncate text-sm font-medium text-foreground">
                {f.name}
              </p>
              <p className="mt-0.5 text-[11px] text-text-tertiary">
                {subs > 0 ? `${subs} subfolder${subs === 1 ? "" : "s"}` : "No subfolders"}
                {searching && f.path ? ` · ${f.path}` : ""}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "location",
      header: "Location",
      render: (f) => (
        <StatusPill status={f.storageLocation} map={STORAGE_META} className="text-[10px]" />
      ),
    },
    {
      key: "size",
      header: "Size",
      className: "tabular-nums text-xs text-muted-foreground",
      render: (f) => formatBytes(f.sizeBytes),
    },
    {
      key: "updated",
      header: "Updated",
      className: "text-xs text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (f) => formatDate(f.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (f) => (
        <RowActions
          folder={f}
          onOpen={navigateInto}
          onDetails={(x) => setOpenFolderId(x.id)}
          onDelete={handleDelete}
        />
      ),
    },
  ];

  if (openFolderId) {
    return (
      <FolderDetailScreen
        key={openFolderId}
        id={openFolderId}
        onBack={() => setOpenFolderId(null)}
        onChange={syncRow}
        projectId={projectId}
      />
    );
  }

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Folders & Storage"
        description="Structure storage and control where source files live."
        actions={
          <Button
            className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowCreate(true)}
          >
            <FolderPlus className="mr-1.5 h-4 w-4" />
            New Folder
          </Button>
        }
      />

      <StatsBar stats={stats} />

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setCurrentParentId(null);
          }}
          className={cn(
            "rounded-md px-2 py-1 font-medium transition-colors hover:bg-surface-hover",
            currentParentId === null ? "text-foreground" : "text-text-secondary",
          )}
        >
          All Folders
        </button>
        {trail.map((crumb) => (
          <React.Fragment key={crumb.id}>
            <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCurrentParentId(crumb.id);
              }}
              className={cn(
                "max-w-[200px] truncate rounded-md px-2 py-1 font-medium transition-colors hover:bg-surface-hover",
                crumb.id === currentParentId ? "text-foreground" : "text-text-secondary",
              )}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      <Toolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search folders..."
          className="w-full sm:w-64"
        />
        {searching ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={() => setSearch("")}
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        ) : null}
      </Toolbar>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          getRowKey={(f) => f.id}
          onRowClick={(f) => navigateInto(f)}
          empty={
            <EmptyState
              icon={FolderIcon}
              title={searching ? "No folders found" : "This folder has no subfolders"}
              description={
                searching
                  ? "Try a different search query."
                  : "Create a subfolder to organize this branch of storage."
              }
              action={
                <Button
                  className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                  onClick={() => setShowCreate(true)}
                >
                  <FolderPlus className="mr-1.5 h-4 w-4" />
                  New Folder
                </Button>
              }
            />
          }
        />
      )}

      {!loading && visible.length > 0 ? (
        <div className="text-xs text-text-secondary">
          {searching
            ? `Showing ${visible.length} of ${folders.length} folders`
            : `${visible.length} folder${visible.length === 1 ? "" : "s"} here`}
        </div>
      ) : null}

      <CreateFolderDialog
        key={showCreate ? `open-${currentParentId ?? "root"}` : "closed"}
        open={showCreate}
        onOpenChange={setShowCreate}
        folders={folders}
        defaultParentId={currentParentId}
        onCreate={handleCreate}
      />
    </MainScreenWrapper>
  );
}

export default FoldersScreen;
