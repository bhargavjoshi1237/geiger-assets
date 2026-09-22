"use client";

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronRight,
  Copy,
  Folder as FolderIcon,
  FolderInput,
  FolderOpen,
  FolderPlus,
  FolderSymlink,
  File,
  HardDrive,
  Link2,
  Pencil,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { SearchBar } from "@geiger/ui/search-bar";
import { ActionMenu } from "@geiger/ui/action-menu";
import { LogoLoading } from "@geiger/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import {
  listFolders,
  createFolder,
  updateFolder,
  softDeleteFolder,
} from "@/lib/supabase/folders";
import { listAssets, softDeleteAsset, updateAsset } from "@/lib/supabase/assets";
import { TYPE_ICONS, DEFAULT_ASSET_COLOR } from "@/components/internal/shared/asset_meta";
import { formatBytes } from "@/lib/format";

const ROOT_LABEL = "Project root";

export function folderPath(folder) {
  if (!folder) return "";
  return folder.path || (folder.name ? `/${folder.name}` : "");
}

function indexFiles(assets, folders) {
  const byPath = new Map();
  const byName = new Map();
  for (const f of folders) {
    const path = folderPath(f);
    if (path) byPath.set(path.toLowerCase(), f.id);
    if (f.name) byName.set(f.name.toLowerCase(), f.id);
  }
  const map = new Map();
  const push = (key, asset) => {
    const list = map.get(key);
    if (list) list.push(asset);
    else map.set(key, [asset]);
  };
  for (const asset of assets) {
    const raw = String(asset.folder ?? "").trim();
    if (!raw || raw === "root" || raw === "/") {
      push("root", asset);
      continue;
    }
    const key = raw.toLowerCase();
    const id = byPath.get(key) || byName.get(key) || byPath.get(`/${key}`);
    push(id || "root", asset);
  }
  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return map;
}

function indexChildren(folders) {
  const map = new Map();
  for (const f of folders) {
    const key = f.parentId ?? "root";
    const list = map.get(key);
    if (list) list.push(f);
    else map.set(key, [f]);
  }
  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return map;
}

function subtreeIds(childrenOf, id) {
  const out = new Set();
  const walk = (node) => {
    if (!node || out.has(node)) return;
    out.add(node);
    for (const kid of childrenOf.get(node) || []) walk(kid.id);
  };
  walk(id);
  return out;
}

function resolveValueId(value, folders) {
  if (!value) return null;
  if (typeof value === "object") return value.id ?? null;
  const raw = String(value).trim();
  if (!raw || raw === "root" || raw === "/") return null;
  const key = raw.toLowerCase();
  const match =
    folders.find((f) => f.id === raw) ||
    folders.find((f) => folderPath(f).toLowerCase() === key) ||
    folders.find((f) => f.name.toLowerCase() === key);
  return match?.id ?? null;
}

export function folderLabel(value) {
  if (!value) return "";
  if (typeof value === "object") return value.name || folderPath(value) || "";
  const raw = String(value).trim();
  if (!raw || raw === "root" || raw === "/") return "";
  return raw.split("/").filter(Boolean).pop() || raw;
}

function FolderGlyph({ color, open, className }) {
  const Icon = open ? FolderOpen : FolderIcon;
  return (
    <Icon
      className={cn("h-4 w-4 shrink-0", className)}
      style={{ color: color || DEFAULT_ASSET_COLOR }}
    />
  );
}

function TreeNode({
  folder,
  depth,
  childrenOf,
  expanded,
  onToggle,
  currentId,
  selectedId,
  onPick,
  dragFor,
}) {
  const kids = childrenOf.get(folder.id) || [];
  const isOpen = expanded.has(folder.id);
  const isCurrent = currentId === folder.id;
  const { active, ...dragProps } = dragFor?.(folder) || {};

  return (
    <li>
      <div
        {...dragProps}
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 transition-colors",
          isCurrent ? "bg-surface-active" : "hover:bg-surface-hover",
          active && "bg-primary/10 ring-1 ring-primary/40",
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          type="button"
          tabIndex={kids.length ? 0 : -1}
          aria-label={isOpen ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
          aria-expanded={kids.length ? isOpen : undefined}
          onClick={() => onToggle(folder.id)}
          className={cn(
            "flex h-6 w-5 shrink-0 items-center justify-center rounded text-text-tertiary transition-colors",
            kids.length ? "hover:text-foreground" : "invisible",
          )}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
        </button>
        <button
          type="button"
          onClick={() => onPick(folder)}
          aria-current={selectedId === folder.id ? "true" : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
        >
          <FolderGlyph color={folder.color} open={isOpen} />
          <span
            className={cn(
              "truncate text-sm",
              isCurrent ? "font-medium text-foreground" : "text-text-secondary",
            )}
          >
            {folder.name}
          </span>
        </button>
      </div>
      {isOpen && kids.length ? (
        <ul>
          {kids.map((child) => (
            <TreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              childrenOf={childrenOf}
              expanded={expanded}
              onToggle={onToggle}
              currentId={currentId}
              selectedId={selectedId}
              onPick={onPick}
              dragFor={dragFor}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ContentRow({ icon, title, meta, selected, onClick, onDoubleClick, action, drag }) {
  const { active, ...dragProps } = drag || {};
  return (
    <div
      {...dragProps}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
        selected
          ? "border-primary/40 bg-primary/10"
          : "border-transparent hover:border-border hover:bg-surface-hover",
        dragProps.draggable && "cursor-grab active:cursor-grabbing",
        active && "border-primary bg-primary/10 ring-1 ring-primary/40",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        disabled={!onClick}
        aria-current={selected ? "true" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{title}</span>
          <span className="block truncate text-xs text-text-tertiary">{meta}</span>
        </span>
      </button>
      {action}
    </div>
  );
}

function MoveTreeNode({ folder, depth, childrenOf, blocked, destId, onPick }) {
  const kids = childrenOf.get(folder.id) || [];
  const disabled = blocked.has(folder.id);

  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick(folder.id)}
        aria-current={destId === folder.id ? "true" : undefined}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        className={cn(
          "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left transition-colors",
          disabled
            ? "cursor-not-allowed text-text-tertiary opacity-50"
            : "hover:bg-surface-hover",
          destId === folder.id && "bg-primary/10 ring-1 ring-primary/40",
        )}
      >
        <FolderGlyph color={folder.color} />
        <span className="truncate text-sm text-foreground">{folder.name}</span>
      </button>
      {kids.length ? (
        <ul>
          {kids.map((kid) => (
            <MoveTreeNode
              key={kid.id}
              folder={kid}
              depth={depth + 1}
              childrenOf={childrenOf}
              blocked={blocked}
              destId={destId}
              onPick={onPick}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function MoveDialog({ target, childrenOf, currentParentId, onCancel, onMove }) {
  const [destId, setDestId] = useState(undefined);
  const [busy, setBusy] = useState(false);

  const blocked = useMemo(() => {
    const set = target.kind === "folder" ? subtreeIds(childrenOf, target.row.id) : new Set();
    if (currentParentId) set.add(currentParentId);
    return set;
  }, [target, childrenOf, currentParentId]);

  const roots = childrenOf.get("root") || [];
  const rootBlocked = currentParentId === null;
  const chosen = destId !== undefined && (destId !== null || !rootBlocked);

  const submit = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    await onMove(destId);
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? null : onCancel())}>
      <DialogContent className="max-w-md border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Move &ldquo;{target.row.name}&rdquo;
          </DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Choose the folder it should live in.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-surface-card p-1">
          <button
            type="button"
            disabled={rootBlocked}
            onClick={() => setDestId(null)}
            aria-current={destId === null && !rootBlocked ? "true" : undefined}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
              rootBlocked
                ? "cursor-not-allowed text-text-tertiary opacity-50"
                : "hover:bg-surface-hover",
              destId === null && !rootBlocked && "bg-primary/10 ring-1 ring-primary/40",
            )}
          >
            <HardDrive className="h-4 w-4 shrink-0 text-text-tertiary" />
            <span className="truncate text-sm text-foreground">{ROOT_LABEL}</span>
          </button>
          {roots.length ? (
            <ul>
              {roots.map((folder) => (
                <MoveTreeNode
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  childrenOf={childrenOf}
                  blocked={blocked}
                  destId={destId}
                  onPick={setDestId}
                />
              ))}
            </ul>
          ) : (
            <p className="px-2 py-3 text-xs text-text-tertiary">No other folders yet.</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={!chosen || busy}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FolderExplorer({
  projectId,
  value,
  onChange,
  onSubmit,
  onFoldersChange,
  onOpenDetails,
  footerActions,
  allowCreate = true,
  showFiles = true,
  className,
  ref,
}) {
  const [folders, setFolders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [busy, setBusy] = useState(false);

  const [moveTarget, setMoveTarget] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [dropId, setDropId] = useState(null);

  useImperativeHandle(ref, () => ({ startCreate: () => setCreating(true) }), []);

  const valueRef = useRef(value);

  useEffect(() => {
    let alive = true;
    Promise.all([listFolders(projectId), showFiles ? listAssets(projectId) : []]).then(
      ([folderRows, assetRows]) => {
        if (!alive) return;
        const rows = folderRows ?? [];
        const id = resolveValueId(valueRef.current, rows);
        const ancestors = new Set();
        if (id) {
          const map = new Map(rows.map((f) => [f.id, f]));
          let node = map.get(id);
          while (node?.parentId) {
            ancestors.add(node.parentId);
            node = map.get(node.parentId);
          }
          ancestors.add(id);
        }
        setFolders(rows);
        setAssets(assetRows ?? []);
        setSelectedId(id);
        setCurrentId(id);
        setExpanded(ancestors);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId, showFiles]);

  useEffect(() => {
    onFoldersChange?.(folders);
  }, [folders, onFoldersChange]);

  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const childrenOf = useMemo(() => indexChildren(folders), [folders]);
  const filesOf = useMemo(() => indexFiles(assets, folders), [assets, folders]);

  const trail = useMemo(() => {
    const crumbs = [];
    let node = currentId ? byId.get(currentId) : null;
    while (node) {
      crumbs.unshift(node);
      node = node.parentId ? byId.get(node.parentId) : null;
    }
    return crumbs;
  }, [currentId, byId]);

  const emit = useCallback(
    (id, row) => {
      setSelectedId(id);
      onChange?.(id ? row ?? byId.get(id) ?? null : null);
    },
    [byId, onChange],
  );

  const navigate = (id) => {
    setSearch("");
    setCreating(false);
    setCurrentId(id);
    emit(id);
    if (!id) return;
    setExpanded((prev) => new Set(prev).add(id));
  };

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const query = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!query) return [];
    return folders
      .filter((f) => f.name.toLowerCase().includes(query) || folderPath(f).toLowerCase().includes(query))
      .slice(0, 100);
  }, [folders, query]);

  const subfolders = childrenOf.get(currentId ?? "root") || [];
  const files = showFiles ? filesOf.get(currentId ?? "root") || [] : [];
  const roots = childrenOf.get("root") || [];
  const selectedFolder = selectedId ? byId.get(selectedId) ?? null : null;

  const submitNewFolder = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    const parent = currentId ? byId.get(currentId) : null;
    const id = crypto.randomUUID();
    const path = `${parent ? folderPath(parent) : ""}/${name}`;
    const optimistic = {
      id,
      projectId: projectId ?? null,
      name,
      parentId: currentId ?? null,
      path,
      storageLocation: "hot",
      color: DEFAULT_ASSET_COLOR,
      sizeBytes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setBusy(true);
    setFolders((rows) => [...rows, optimistic]);
    setNewName("");
    setCreating(false);
    const created = await createFolder({
      id,
      projectId: projectId ?? null,
      name,
      parentId: currentId ?? null,
      path,
      storageLocation: "hot",
      color: optimistic.color,
      sizeBytes: 0,
    });
    setBusy(false);
    if (created) {
      setFolders((rows) => rows.map((f) => (f.id === id ? created : f)));
      emit(id, created);
    } else {
      setFolders((rows) => rows.filter((f) => f.id !== id));
      toast.error("Couldn't create that folder.");
    }
  };

  const copyToClipboard = async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

  const startRename = (folder) => {
    setCreating(false);

    if (query) {
      setSearch("");
      setCurrentId(folder.parentId ?? null);
      setSelectedId(folder.id);
    }
    setRenamingId(folder.id);
    setRenameName(folder.name);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameName("");
  };

  const submitRename = async () => {
    const target = renamingId ? byId.get(renamingId) : null;
    const name = renameName.trim();
    cancelRename();
    if (!target || !name || name === target.name) return;

    const oldPath = folderPath(target);
    const parent = target.parentId ? byId.get(target.parentId) : null;
    const nextPath = `${parent ? folderPath(parent) : ""}/${name}`;
    const patches = [{ id: target.id, name, path: nextPath }];
    for (const folder of folders) {
      if (folder.id === target.id) continue;
      const path = folderPath(folder);
      if (oldPath && path.startsWith(`${oldPath}/`)) {
        patches.push({ id: folder.id, path: `${nextPath}${path.slice(oldPath.length)}` });
      }
    }

    const prev = folders;
    const byPatch = new Map(patches.map((patch) => [patch.id, patch]));
    setFolders((rows) => rows.map((f) => (byPatch.has(f.id) ? { ...f, ...byPatch.get(f.id) } : f)));
    const results = await Promise.all(
      patches.map(({ id: folderId, ...patch }) => updateFolder(folderId, patch)),
    );
    if (results.some((row) => !row)) {
      setFolders(prev);
      toast.error("Couldn't rename that folder.");
      return;
    }
    setFolders((rows) => rows.map((f) => results.find((row) => row.id === f.id) ?? f));
    if (selectedId === target.id) emit(target.id, { ...target, name, path: nextPath });
    toast.success("Folder renamed.");
  };

  const newSubfolder = (folder) => {
    navigate(folder.id);
    setCreating(true);
  };

  const removeFolder = async (folder) => {
    const prev = folders;
    setFolders((rows) => rows.filter((f) => f.id !== folder.id));
    if (currentId === folder.id) navigate(folder.parentId ?? null);
    else if (selectedId === folder.id) emit(null);
    const ok = await softDeleteFolder(folder.id);
    if (!ok) {
      setFolders(prev);
      toast.error("Couldn't delete that folder.");
      return;
    }
    toast.success(`"${folder.name}" deleted.`);
  };

  const removeAsset = async (asset) => {
    const prev = assets;
    setAssets((rows) => rows.filter((a) => a.id !== asset.id));
    const ok = await softDeleteAsset(asset.id);
    if (!ok) {
      setAssets(prev);
      toast.error("Couldn't delete that file.");
      return;
    }
    toast.success(`"${asset.name}" deleted.`);
  };

  const moveFolderTo = async (folder, destId) => {
    const dest = destId ? byId.get(destId) : null;
    if (destId === folder.id) return;
    if (destId && subtreeIds(childrenOf, folder.id).has(destId)) {
      toast.error("A folder can't move inside itself.");
      return;
    }
    if ((folder.parentId ?? null) === (destId ?? null)) return;

    const oldPath = folderPath(folder);
    const nextPath = `${dest ? folderPath(dest) : ""}/${folder.name}`;
    const patches = [{ id: folder.id, parentId: destId ?? null, path: nextPath }];
    for (const row of folders) {
      if (row.id === folder.id) continue;
      const path = folderPath(row);
      if (oldPath && path.startsWith(`${oldPath}/`)) {
        patches.push({ id: row.id, path: `${nextPath}${path.slice(oldPath.length)}` });
      }
    }

    const prev = folders;
    const byPatch = new Map(patches.map((patch) => [patch.id, patch]));
    setFolders((rows) => rows.map((f) => (byPatch.has(f.id) ? { ...f, ...byPatch.get(f.id) } : f)));
    const results = await Promise.all(
      patches.map(({ id: folderId, ...patch }) => updateFolder(folderId, patch)),
    );
    if (results.some((row) => !row)) {
      setFolders(prev);
      toast.error("Couldn't move that folder.");
      return;
    }
    setFolders((rows) => rows.map((f) => results.find((row) => row.id === f.id) ?? f));
    toast.success(`"${folder.name}" moved to ${dest ? dest.name : ROOT_LABEL}.`);
  };

  const moveAssetTo = async (asset, destId) => {
    const dest = destId ? byId.get(destId) : null;
    const nextFolder = dest ? folderPath(dest) : "root";
    if ((asset.folder || "root") === nextFolder) return;

    const prev = assets;
    setAssets((rows) => rows.map((a) => (a.id === asset.id ? { ...a, folder: nextFolder } : a)));
    const updated = await updateAsset(asset.id, { folder: nextFolder });
    if (!updated) {
      setAssets(prev);
      toast.error("Couldn't move that file.");
      return;
    }
    setAssets((rows) => rows.map((a) => (a.id === asset.id ? updated : a)));
    toast.success(`"${asset.name}" moved to ${dest ? dest.name : ROOT_LABEL}.`);
  };

  const runMove = (item, destId) =>
    item.kind === "folder" ? moveFolderTo(item.row, destId) : moveAssetTo(item.row, destId);

  const canDrop = (destId) => {
    if (!dragItem) return false;
    if (dragItem.kind === "folder") {
      if (destId === dragItem.row.id) return false;
      if (destId && subtreeIds(childrenOf, dragItem.row.id).has(destId)) return false;
      return (dragItem.row.parentId ?? null) !== (destId ?? null);
    }
    const dest = destId ? byId.get(destId) : null;
    return (dragItem.row.folder || "root") !== (dest ? folderPath(dest) : "root");
  };

  const dropKey = (destId) => destId ?? "root";

  const dragHandles = (kind, row) => ({
    draggable: allowCreate,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", row.id);
      setDragItem({ kind, row });
    },
    onDragEnd: () => {
      setDragItem(null);
      setDropId(null);
    },
  });

  const isDropTarget = (destId) => dropId === dropKey(destId);

  const dropHandles = (destId) => ({
    onDragOver: (e) => {
      if (!canDrop(destId)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropId(dropKey(destId));
    },
    onDragLeave: () => setDropId((cur) => (cur === dropKey(destId) ? null : cur)),
    onDrop: (e) => {
      e.preventDefault();
      const item = dragItem;
      setDragItem(null);
      setDropId(null);
      if (item && canDrop(destId)) runMove(item, destId);
    },
  });

  const folderMenuItems = (folder) => [
    { icon: FolderInput, label: "Open", onSelect: () => navigate(folder.id) },
    { icon: Check, label: "Select folder", onSelect: () => emit(folder.id) },
    allowCreate && { icon: Pencil, label: "Rename", onSelect: () => startRename(folder) },
    allowCreate && {
      icon: FolderPlus,
      label: "New subfolder",
      onSelect: () => newSubfolder(folder),
    },
    allowCreate && {
      icon: FolderSymlink,
      label: "Move to…",
      onSelect: () => setMoveTarget({ kind: "folder", row: folder }),
    },
    onOpenDetails && {
      icon: Settings2,
      label: "Details",
      onSelect: () => onOpenDetails(folder),
    },
    {
      icon: Copy,
      label: "Copy path",
      onSelect: () => copyToClipboard(folderPath(folder) || folder.name, "Path"),
    },
    allowCreate && { separator: true },
    allowCreate && {
      icon: Trash2,
      label: "Delete",
      variant: "destructive",
      onSelect: () => removeFolder(folder),
    },
  ];

  const fileMenuItems = (asset) => [
    {
      icon: Link2,
      label: "Copy link",
      onSelect: () => {
        const { origin, pathname } = window.location;
        copyToClipboard(`${origin}${pathname}?asset=${asset.id}`, "Link");
      },
    },
    { icon: Copy, label: "Copy name", onSelect: () => copyToClipboard(asset.name, "Name") },
    allowCreate && {
      icon: FolderSymlink,
      label: "Move to…",
      onSelect: () => setMoveTarget({ kind: "file", row: asset }),
    },
    { separator: true },
    {
      icon: Trash2,
      label: "Delete",
      variant: "destructive",
      onSelect: () => removeAsset(asset),
    },
  ];

  if (loading) {
    return (
      <div className={cn("flex min-h-[320px] items-center justify-center", className)}>
        <LogoLoading size={48} />
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-1 pb-3">
        <nav aria-label="Folder path" className="flex min-w-0 flex-1 items-center gap-1 text-sm">
          {trail.length ? (
            trail.map((crumb, i) => (
              <React.Fragment key={crumb.id}>
                {i > 0 ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate(crumb.id)}
                  className={cn(
                    "truncate rounded-md px-1.5 py-1 transition-colors hover:bg-surface-hover",
                    i === trail.length - 1
                      ? "font-medium text-foreground"
                      : "text-text-secondary hover:text-foreground",
                  )}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))
          ) : (
            <span className="truncate px-1.5 py-1 font-medium text-foreground">{ROOT_LABEL}</span>
          )}
        </nav>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            aria-label={ROOT_LABEL}
            title={ROOT_LABEL}
            onClick={() => navigate(null)}
            {...dropHandles(null)}
            className={cn(
              "shrink-0 bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground",
              currentId ? null : "bg-surface-active text-foreground",
              dropId === "root" && "border-primary bg-primary/10 text-foreground",
            )}
          >
            <HardDrive className="h-4 w-4" />
          </Button>
          <SearchBar
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search folders…"
            className="sm:w-56"
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 sm:grid-cols-[200px_minmax(0,1fr)]">

        <div className="hidden min-h-0 overflow-y-auto border-r border-border py-2 pr-2 sm:block">
          <button
            type="button"
            onClick={() => navigate(null)}
            {...dropHandles(null)}
            className={cn(
              "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
              currentId ? "hover:bg-surface-hover" : "bg-surface-active",
              dropId === "root" && "bg-primary/10 ring-1 ring-primary/40",
            )}
          >
            <HardDrive className="h-4 w-4 shrink-0 text-text-tertiary" />
            <span
              className={cn(
                "truncate text-sm",
                currentId ? "text-text-secondary" : "font-medium text-foreground",
              )}
            >
              {ROOT_LABEL}
            </span>
          </button>
          {roots.length ? (
            <ul>
              {roots.map((folder) => (
                <TreeNode
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  childrenOf={childrenOf}
                  expanded={expanded}
                  onToggle={toggle}
                  currentId={currentId}
                  selectedId={selectedId}
                  onPick={(f) => navigate(f.id)}
                  dragFor={(f) => ({
                    ...dragHandles("folder", f),
                    ...dropHandles(f.id),
                    active: isDropTarget(f.id),
                  })}
                />
              ))}
            </ul>
          ) : (
            <p className="px-2 py-3 text-xs text-text-tertiary">No folders yet.</p>
          )}
        </div>

        <div className="min-h-0 overflow-y-auto py-2 sm:pl-3">
          {query ? (
            <div className="space-y-1">
              <p className="px-1 pb-1 text-xs text-text-tertiary">
                {matches.length} folder{matches.length !== 1 ? "s" : ""} matching
                &ldquo;{search.trim()}&rdquo;
              </p>
              {matches.map((folder) => (
                <ContentRow
                  key={folder.id}
                  icon={<FolderGlyph color={folder.color} />}
                  title={folder.name}
                  meta={folderPath(folder) || ROOT_LABEL}
                  selected={selectedId === folder.id}
                  onClick={() => emit(folder.id)}
                  onDoubleClick={() => navigate(folder.id)}
                  drag={dragHandles("folder", folder)}
                  action={
                    <ActionMenu
                      label={`Actions for ${folder.name}`}
                      items={folderMenuItems(folder)}
                      contentClassName="border-border bg-surface-subtle text-foreground"
                    />
                  }
                />
              ))}
              {!matches.length ? (
                <p className="px-1 py-8 text-center text-sm text-text-tertiary">
                  No folders match that search.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1">
              {creating ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
                  <FolderIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
                  <Input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitNewFolder();
                      }
                      if (e.key === "Escape") {
                        setCreating(false);
                        setNewName("");
                      }
                    }}
                    placeholder="Folder name"
                    className="h-8 border-border bg-surface-subtle"
                  />
                  <Button size="sm" onClick={submitNewFolder} disabled={!newName.trim() || busy}>
                    Create
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-text-secondary hover:text-foreground"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}

              {subfolders.map((folder) => {
                const subs = (childrenOf.get(folder.id) || []).length;
                const count = (filesOf.get(folder.id) || []).length;
                if (renamingId === folder.id) {
                  return (
                    <div
                      key={folder.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2"
                    >
                      <FolderGlyph color={folder.color} />
                      <Input
                        autoFocus
                        value={renameName}
                        onChange={(e) => setRenameName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitRename();
                          }
                          if (e.key === "Escape") cancelRename();
                        }}
                        placeholder="Folder name"
                        className="h-8 border-border bg-surface-subtle"
                      />
                      <Button size="sm" onClick={submitRename} disabled={!renameName.trim()}>
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-text-secondary hover:text-foreground"
                        onClick={cancelRename}
                      >
                        Cancel
                      </Button>
                    </div>
                  );
                }
                return (
                  <ContentRow
                    key={folder.id}
                    icon={<FolderGlyph color={folder.color} />}
                    title={folder.name}
                    meta={[
                      subs ? `${subs} folder${subs !== 1 ? "s" : ""}` : null,
                      showFiles ? `${count} file${count !== 1 ? "s" : ""}` : null,
                      folder.sizeBytes ? formatBytes(folder.sizeBytes) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    selected={selectedId === folder.id}
                    onClick={() => emit(folder.id)}
                    onDoubleClick={() => navigate(folder.id)}
                    drag={{
                      ...dragHandles("folder", folder),
                      ...dropHandles(folder.id),
                      active: isDropTarget(folder.id),
                    }}
                    action={
                      <ActionMenu
                        label={`Actions for ${folder.name}`}
                        items={folderMenuItems(folder)}
                        contentClassName="border-border bg-surface-subtle text-foreground"
                      />
                    }
                  />
                );
              })}

              {files.map((asset) => {
                const Icon = TYPE_ICONS[asset.type] || File;
                return (
                  <ContentRow
                    key={asset.id}
                    icon={
                      <Icon
                        className="h-4 w-4 shrink-0"
                        style={{ color: asset.color || DEFAULT_ASSET_COLOR }}
                      />
                    }
                    title={asset.name}
                    meta={[asset.format || asset.type, formatBytes(asset.sizeBytes)]
                      .filter(Boolean)
                      .join(" · ")}
                    drag={dragHandles("file", asset)}
                    action={
                      <ActionMenu
                        label={`Actions for ${asset.name}`}
                        items={fileMenuItems(asset)}
                        contentClassName="border-border bg-surface-subtle text-foreground"
                      />
                    }
                  />
                );
              })}

              {!creating && !subfolders.length && !files.length ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <FolderOpen className="h-8 w-8 text-text-tertiary" />
                  <p className="text-sm text-text-secondary">This folder is empty.</p>
                  {allowCreate ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                      onClick={() => setCreating(true)}
                    >
                      <FolderPlus className="h-4 w-4" />
                      New folder here
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-1 pt-3">
        {allowCreate && !query ? (
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setCreating((v) => !v)}
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {footerActions}
          {onSubmit ? (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => onSubmit(selectedFolder)}
            >
              Select
            </Button>
          ) : null}
        </div>
      </div>

      {moveTarget ? (
        <MoveDialog
          target={moveTarget}
          childrenOf={childrenOf}
          currentParentId={
            moveTarget.kind === "folder"
              ? moveTarget.row.parentId ?? null
              : resolveValueId(moveTarget.row.folder, folders)
          }
          onCancel={() => setMoveTarget(null)}
          onMove={async (destId) => {
            const target = moveTarget;
            setMoveTarget(null);
            await runMove(target, destId);
          }}
        />
      ) : null}
    </div>
  );
}

function ExplorerDialogBody({
  projectId,
  value,
  onCancel,
  onConfirm,
  allowCreate,
  showFiles,
}) {
  const [draft, setDraft] = useState(typeof value === "object" ? value : null);

  return (
    <>
      <FolderExplorer
        projectId={projectId}
        value={value}
        onChange={setDraft}
        allowCreate={allowCreate}
        showFiles={showFiles}
        className="min-h-0 flex-1"
        footerActions={
          <>
            <Button
              variant="ghost"
              className="text-text-secondary hover:text-foreground"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => onConfirm(draft ?? null)}
            >
              Select {draft ? draft.name : ROOT_LABEL.toLowerCase()}
            </Button>
          </>
        }
      />
    </>
  );
}

export function FolderExplorerDialog({
  open,
  onOpenChange,
  projectId,
  value,
  onSelect,
  title = "Choose a folder",
  description = "Browse the project's folders and pick a destination.",
  allowCreate = true,
  showFiles = true,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(80vh,640px)] max-w-3xl flex-col gap-4 overflow-hidden bg-background">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {open ? (
          <ExplorerDialogBody
            projectId={projectId}
            value={value}
            allowCreate={allowCreate}
            showFiles={showFiles}
            onCancel={() => onOpenChange?.(false)}
            onConfirm={(folder) => {
              onSelect?.(folder);
              onOpenChange?.(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function FolderPicker({
  projectId,
  value,
  onChange,
  placeholder = ROOT_LABEL,
  allowCreate = true,
  showFiles = true,
  disabled = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const label = folderLabel(value);
  const hint = typeof value === "object" ? folderPath(value) : String(value ?? "");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "w-full justify-start gap-2 border-border bg-surface-card font-normal text-foreground hover:bg-surface-hover",
          className,
        )}
      >
        {label ? (
          <FolderIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
        ) : (
          <HardDrive className="h-4 w-4 shrink-0 text-text-tertiary" />
        )}
        <span className="min-w-0 flex-1 truncate text-left">{label || placeholder}</span>
        {label && hint && hint !== label ? (
          <span className="hidden shrink-0 text-xs text-text-tertiary sm:inline">{hint}</span>
        ) : null}
      </Button>
      <FolderExplorerDialog
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
        value={value}
        onSelect={onChange}
        allowCreate={allowCreate}
        showFiles={showFiles}
      />
    </>
  );
}

export default FolderPicker;
