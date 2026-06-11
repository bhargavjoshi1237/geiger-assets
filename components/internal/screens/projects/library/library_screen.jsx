"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Upload,
  FolderPlus,
  Grid3X3,
  List,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Download,
  Trash2,
  Share2,
  Tag,
  Eye,
  Star,
  Copy,
  Move,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  Image,
  Film,
  Music,
  FileText,
  Boxes,
  File,
  HardDrive,
  Users,
  Loader2,
  Clock,
  StarOff,
  Info,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  StatsBar,
  SearchInput,
  StatusPill,
  EmptyState,
} from "@/components/internal/shared/screen_kit";
import {
  ASSETS,
  FOLDERS,
  STATUS_META,
  FILE_TYPE_COLORS,
  ASSET_STATS,
} from "./sample_data";

const TYPE_ICONS = {
  image: Image,
  video: Film,
  audio: Music,
  document: FileText,
  "3d": Boxes,
  raw: File,
  pdf: FileText,
  archive: File,
};

const FILE_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Documents" },
  { value: "pdf", label: "PDFs" },
  { value: "3d", label: "3D Models" },
  { value: "raw", label: "Raw Files" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "In Review" },
  { value: "processing", label: "Processing" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS = [
  { value: "modified-desc", label: "Last Modified" },
  { value: "modified-asc", label: "Oldest Modified" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "size-desc", label: "Largest Size" },
  { value: "size-asc", label: "Smallest Size" },
  { value: "date-desc", label: "Newest Upload" },
  { value: "date-asc", label: "Oldest Upload" },
  { value: "downloads-desc", label: "Most Downloaded" },
];

const DATE_OPTIONS = [
  { value: "all", label: "Any Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
];

function getBreadcrumb(folderId) {
  const path = [];
  let current = FOLDERS.find((f) => f.id === folderId);
  while (current) {
    path.unshift(current);
    current = FOLDERS.find((f) => f.id === current.parent);
  }
  return path;
}

function getChildFolders(folderId) {
  return FOLDERS.filter((f) => f.parent === folderId);
}

function FilterDropdown({ value, onValueChange, options, placeholder, icon: Icon }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="bg-surface-card border-border text-foreground hover:bg-surface-subtle text-xs px-3 h-8 rounded-md font-medium gap-1.5"
        >
          {Icon && <Icon className="h-3.5 w-3.5 text-text-secondary" />}
          {options.find((o) => o.value === value)?.label || placeholder}
          <ChevronDown className="w-3 h-3 text-text-secondary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-surface-subtle border-border text-foreground" align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="text-xs focus:bg-surface-hover focus:text-foreground cursor-pointer"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssetThumbnail({ asset, size = "md" }) {
  const Icon = TYPE_ICONS[asset.type] || File;
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-full aspect-square",
    lg: "w-full aspect-square",
    xs: "w-6 h-6",
  };
  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-10 w-10",
    xs: "h-3 w-3",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg overflow-hidden",
        sizeClasses[size],
        size === "md" || size === "lg" ? "bg-surface-card border border-border" : "",
      )}
      style={
        size === "md" || size === "lg"
          ? {
              background: `linear-gradient(135deg, ${asset.color}15 0%, ${asset.color}08 100%)`,
              borderColor: `${asset.color}20`,
            }
          : undefined
      }
    >
      <Icon
        className={cn(iconSizes[size])}
        style={{ color: asset.color || "#737373" }}
      />
    </div>
  );
}

function FolderCard({ folder, assetCount, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface-subtle hover:bg-surface-card hover:border-border transition-colors text-left group w-full"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-border text-muted-foreground group-hover:text-foreground transition-colors">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-foreground transition-colors">
          {folder.name}
        </p>
        <p className="text-xs text-text-secondary">{assetCount} assets</p>
      </div>
      <ChevronRight className="h-4 w-4 text-text-tertiary group-hover:text-muted-foreground transition-colors shrink-0" />
    </button>
  );
}

function AssetGridCard({ asset, isSelected, onSelect, onOpen }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-surface-subtle overflow-hidden transition-all cursor-pointer",
        isSelected
          ? "border-white/30 ring-1 ring-white/10"
          : "border-border hover:border-border hover:bg-[#1e1e1e]",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(asset)}
    >
      <div className="absolute top-2.5 left-2.5 z-10">
        <div
          className={cn(
            "transition-opacity",
            hovered || isSelected ? "opacity-100" : "opacity-0",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(asset.id);
          }}
        >
          <Checkbox
            checked={isSelected}
            className="border-[#525252] bg-background/80 backdrop-blur-sm data-[state=checked]:bg-white data-[state=checked]:border-white data-[state=checked]:text-[#161616]"
          />
        </div>
      </div>

      <div className="absolute top-2.5 right-2.5 z-10">
        <div
          className={cn(
            "transition-opacity",
            hovered ? "opacity-100" : "opacity-0",
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 bg-background/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="bg-surface-subtle border-border text-foreground"
              align="end"
            >
              <DropdownMenuItem className="text-xs focus:bg-surface-hover cursor-pointer">
                <Eye className="h-3.5 w-3.5 mr-2" /> Preview
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-surface-hover cursor-pointer">
                <Download className="h-3.5 w-3.5 mr-2" /> Download
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-surface-hover cursor-pointer">
                <Share2 className="h-3.5 w-3.5 mr-2" /> Share
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-surface-hover cursor-pointer">
                <Star className="h-3.5 w-3.5 mr-2" /> Favorite
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-surface-hover cursor-pointer">
                <Copy className="h-3.5 w-3.5 mr-2" /> Copy link
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-surface-hover cursor-pointer">
                <Move className="h-3.5 w-3.5 mr-2" /> Move to...
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs focus:bg-surface-hover cursor-pointer">
                <Tag className="h-3.5 w-3.5 mr-2" /> Edit tags
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-surface-hover" />
              <DropdownMenuItem className="text-xs focus:bg-red-500/10 text-red-400 focus:text-red-400 cursor-pointer">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {asset.status === "processing" && (
        <div className="absolute bottom-2.5 right-2.5 z-10">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30">
            <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
            <span className="text-[10px] text-blue-300">Processing</span>
          </div>
        </div>
      )}

      <div className="aspect-square flex items-center justify-center p-6">
        <AssetThumbnail asset={asset} size="lg" />
      </div>

      <div className="px-3 pb-3 space-y-1.5">
        <p className="text-sm font-medium text-foreground truncate">{asset.name}</p>
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              "text-[10px] px-1.5 py-0 border",
              FILE_TYPE_COLORS[asset.type],
            )}
          >
            {asset.format}
          </Badge>
          <span className="text-xs text-text-secondary">{asset.size}</span>
          {asset.dimensions && (
            <span className="text-xs text-text-tertiary hidden sm:inline">
              {asset.dimensions}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetDetailPanel({ asset, open, onClose }) {
  if (!asset) return null;

  const Icon = TYPE_ICONS[asset.type] || File;
  const statusMeta = STATUS_META[asset.status];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="bg-surface-subtle border-border text-foreground w-full sm:max-w-md p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  background: `${asset.color}15`,
                  border: `1px solid ${asset.color}25`,
                }}
              >
                <Icon className="h-4 w-4" style={{ color: asset.color }} />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-sm font-semibold text-foreground truncate">
                  {asset.name}
                </SheetTitle>
                <SheetDescription className="text-xs text-text-secondary">
                  {asset.format} &middot; {asset.size}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-5 space-y-5">
              <div className="aspect-video rounded-xl bg-surface-card border border-border flex items-center justify-center">
                <AssetThumbnail asset={asset} size="lg" />
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active text-xs h-8"
                >
                  <Share2 className="h-3.5 w-3.5 mr-1.5" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active text-xs h-8 px-2"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Details
                </h4>
                <div className="space-y-2.5">
                  <DetailRow label="Status">
                    <StatusPill
                      status={asset.status}
                      map={STATUS_META}
                      className="text-[10px]"
                    />
                  </DetailRow>
                  {asset.dimensions && (
                    <DetailRow label="Dimensions">{asset.dimensions}</DetailRow>
                  )}
                  <DetailRow label="Uploaded by">{asset.uploadedBy}</DetailRow>
                  <DetailRow label="Uploaded">{asset.uploadedAt}</DetailRow>
                  <DetailRow label="Modified">{asset.modifiedAt}</DetailRow>
                  <DetailRow label="Versions">{asset.versions}</DetailRow>
                  <DetailRow label="Downloads">
                    {asset.downloads.toLocaleString()}
                  </DetailRow>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Tags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {asset.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] border-border text-muted-foreground bg-surface-card hover:bg-surface-hover cursor-pointer"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Location
                </h4>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 text-text-tertiary" />
                  {FOLDERS.find((f) => f.id === asset.folder)?.name || "Root"}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-text-secondary shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right">{children}</span>
    </div>
  );
}

function UploadDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-subtle border-border text-foreground max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Upload Assets</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Drag and drop files or click to browse.
          </DialogDescription>
        </DialogHeader>
        <div className="border-2 border-dashed border-border rounded-xl p-10 text-center hover:border-border-strong transition-colors cursor-pointer">
          <Upload className="h-10 w-10 mx-auto text-text-tertiary mb-3" />
          <p className="text-sm font-medium text-foreground">
            Drop files here or click to upload
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Supports images, videos, audio, documents, and more
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewFolderDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-subtle border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Folder</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Create a new folder to organize your assets.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Folder name</label>
            <Input
              placeholder="Enter folder name"
              className="bg-surface-card border-border text-foreground placeholder:text-text-tertiary focus-visible:border-border-strong"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
            Create Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LibraryScreen({ id }) {
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortValue, setSortValue] = useState("modified-desc");
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  const [currentFolder, setCurrentFolder] = useState("root");
  const [detailAsset, setDetailAsset] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);

  const breadcrumb = useMemo(() => getBreadcrumb(currentFolder), [currentFolder]);
  const childFolders = useMemo(() => getChildFolders(currentFolder), [currentFolder]);

  const filteredAssets = useMemo(() => {
    let result = ASSETS.filter((a) => a.folder === currentFolder);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = ASSETS.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.tags.some((t) => t.includes(q)) ||
          a.format.toLowerCase().includes(q),
      );
    }

    if (typeFilter !== "all") {
      result = result.filter((a) => a.type === typeFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }

    if (dateFilter !== "all") {
      const now = new Date();
      const cutoffs = {
        today: 1,
        week: 7,
        month: 30,
        quarter: 90,
        year: 365,
      };
      const days = cutoffs[dateFilter];
      if (days) {
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        result = result.filter((a) => new Date(a.uploadedAt) >= cutoff);
      }
    }

    const [field, direction] = sortValue.split("-");
    result.sort((a, b) => {
      let cmp = 0;
      switch (field) {
        case "modified":
          cmp = new Date(a.modifiedAt) - new Date(b.modifiedAt);
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "size":
          cmp = a.sizeBytes - b.sizeBytes;
          break;
        case "date":
          cmp = new Date(a.uploadedAt) - new Date(b.uploadedAt);
          break;
        case "downloads":
          cmp = a.downloads - b.downloads;
          break;
      }
      return direction === "desc" ? -cmp : cmp;
    });

    return result;
  }, [searchQuery, typeFilter, statusFilter, dateFilter, sortValue, currentFolder]);

  const folderAssetCounts = useMemo(() => {
    const counts = {};
    FOLDERS.forEach((f) => {
      counts[f.id] = ASSETS.filter((a) => a.folder === f.id).length;
    });
    return counts;
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedAssets.size === filteredAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(filteredAssets.map((a) => a.id)));
    }
  }, [selectedAssets.size, filteredAssets]);

  const handleOpenAsset = useCallback((asset) => {
    setDetailAsset(asset);
  }, []);

  const statsData = [
    {
      label: "Total Assets",
      value: ASSET_STATS.total,
      delta: "+12.5%",
      trend: "up",
      footer: "across all folders",
    },
    {
      label: "Storage Used",
      value: ASSET_STATS.storage,
      delta: "+8.2%",
      trend: "up",
      footer: "of 10 GB",
    },
    {
      label: "Shared",
      value: ASSET_STATS.shared,
      delta: "+15.3%",
      trend: "up",
      footer: "external links active",
    },
    {
      label: "Processing",
      value: ASSET_STATS.processing,
      delta: null,
      trend: null,
      footer: "uploads in queue",
    },
  ];

  const hasActiveFilters =
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    dateFilter !== "all" ||
    searchQuery;

  const clearFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setDateFilter("all");
    setSearchQuery("");
  };

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Library"
        description="Browse, manage, and organize all your digital assets in one place."
        actions={
          <>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground text-xs h-9"
              onClick={() => setShowNewFolderDialog(true)}
            >
              <FolderPlus className="h-4 w-4 mr-1.5" />
              New Folder
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9"
              onClick={() => setShowUploadDialog(true)}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Upload
            </Button>
          </>
        }
      />

      <StatsBar stats={statsData} />

      <div className="flex items-center gap-2 flex-wrap">
        {breadcrumb.map((folder, i) => (
          <React.Fragment key={folder.id}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />}
            <button
              type="button"
              onClick={() => setCurrentFolder(folder.id)}
              className={cn(
                "text-xs font-medium px-2 py-1 rounded-md transition-colors",
                folder.id === currentFolder
                  ? "text-foreground bg-surface-card"
                  : "text-text-secondary hover:text-foreground hover:bg-surface-card",
              )}
            >
              {folder.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search assets..."
            className="w-full sm:w-64"
          />
          <FilterDropdown
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={FILE_TYPE_OPTIONS}
            placeholder="Type"
            icon={SlidersHorizontal}
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder="Status"
          />
          <FilterDropdown
            value={dateFilter}
            onValueChange={setDateFilter}
            options={DATE_OPTIONS}
            placeholder="Date"
            icon={Clock}
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-text-secondary hover:text-foreground hover:bg-surface-active h-8 px-2"
              onClick={clearFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <FilterDropdown
            value={sortValue}
            onValueChange={setSortValue}
            options={SORT_OPTIONS}
            placeholder="Sort"
            icon={ArrowUpDown}
          />
          <div className="flex items-center border border-border rounded-lg bg-surface-subtle p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded-md transition-colors",
                viewMode === "grid"
                  ? "bg-surface-hover text-white"
                  : "text-text-secondary hover:text-muted-foreground",
              )}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded-md transition-colors",
                viewMode === "list"
                  ? "bg-surface-hover text-white"
                  : "text-text-secondary hover:text-muted-foreground",
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>



      {childFolders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {childFolders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              assetCount={folderAssetCounts[folder.id] || 0}
              onClick={() => {
                setCurrentFolder(folder.id);
                setSelectedAssets(new Set());
              }}
            />
          ))}
        </div>
      )}

      {viewMode === "grid" ? (
        filteredAssets.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredAssets.map((asset) => (
              <AssetGridCard
                key={asset.id}
                asset={asset}
                isSelected={selectedAssets.has(asset.id)}
                onSelect={toggleSelect}
                onOpen={handleOpenAsset}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Image}
            title="No assets found"
            description={
              hasActiveFilters
                ? "Try adjusting your filters or search query."
                : "Upload your first asset to get started."
            }
            action={
              hasActiveFilters ? (
                <Button
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active text-xs"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              ) : (
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                  onClick={() => setShowUploadDialog(true)}
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Upload Assets
                </Button>
              )
            }
          />
        )
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={
                      filteredAssets.length > 0 &&
                      selectedAssets.size === filteredAssets.length
                    }
                    onCheckedChange={selectAll}
                    className="border-[#525252] data-[state=checked]:bg-white data-[state=checked]:border-white data-[state=checked]:text-[#161616]"
                  />
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-text-secondary">
                  Name
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-text-secondary">
                  Type
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-text-secondary">
                  Size
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-text-secondary hidden md:table-cell">
                  Dimensions
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-text-secondary hidden lg:table-cell">
                  Uploaded
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-text-secondary">
                  Status
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-text-secondary hidden lg:table-cell">
                  Downloads
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <EmptyState
                      icon={Image}
                      title="No assets found"
                      description={
                        hasActiveFilters
                          ? "Try adjusting your filters or search query."
                          : "Upload your first asset to get started."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssets.map((asset) => {
                  const Icon = TYPE_ICONS[asset.type] || File;
                  const statusMeta = STATUS_META[asset.status];
                  return (
                    <TableRow
                      key={asset.id}
                      className={cn(
                        "border-border cursor-pointer",
                        selectedAssets.has(asset.id) && "bg-surface-card",
                      )}
                      onClick={() => handleOpenAsset(asset)}
                    >
                      <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedAssets.has(asset.id)}
                          onCheckedChange={() => toggleSelect(asset.id)}
                          className="border-[#525252] data-[state=checked]:bg-white data-[state=checked]:border-white data-[state=checked]:text-[#161616]"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <AssetThumbnail asset={asset} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                              {asset.name}
                            </p>
                            <div className="flex gap-1 mt-0.5">
                              {asset.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] text-text-tertiary"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "text-[10px] px-1.5 py-0 border",
                            FILE_TYPE_COLORS[asset.type],
                          )}
                        >
                          {asset.format}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-xs text-muted-foreground">
                        {asset.size}
                      </TableCell>
                      <TableCell className="tabular-nums text-xs text-text-secondary hidden md:table-cell">
                        {asset.dimensions || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary hidden lg:table-cell">
                        {asset.uploadedAt}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          status={asset.status}
                          map={STATUS_META}
                          className="text-[10px]"
                        />
                      </TableCell>
                      <TableCell className="tabular-nums text-xs text-text-secondary hidden lg:table-cell">
                        {asset.downloads.toLocaleString()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-7 w-7 text-text-secondary hover:text-foreground hover:bg-surface-hover"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="bg-surface-subtle border-border text-foreground"
                            align="end"
                          >
                            <DropdownMenuItem className="text-xs focus:bg-surface-hover cursor-pointer">
                              <Eye className="h-3.5 w-3.5 mr-2" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs focus:bg-surface-hover cursor-pointer">
                              <Download className="h-3.5 w-3.5 mr-2" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs focus:bg-surface-hover cursor-pointer">
                              <Share2 className="h-3.5 w-3.5 mr-2" /> Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-surface-hover" />
                            <DropdownMenuItem className="text-xs focus:bg-red-500/10 text-red-400 focus:text-red-400 cursor-pointer">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {filteredAssets.length > 0 && (
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>
            Showing {filteredAssets.length} of {ASSETS.length} assets
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active text-xs h-7 px-2.5"
              disabled
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-surface-card text-foreground hover:bg-surface-active text-xs h-7 w-7 px-0"
            >
              1
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active text-xs h-7 px-2.5"
              disabled
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AssetDetailPanel
        asset={detailAsset}
        open={!!detailAsset}
        onClose={() => setDetailAsset(null)}
      />
      <UploadDialog open={showUploadDialog} onOpenChange={setShowUploadDialog} />
      <NewFolderDialog
        open={showNewFolderDialog}
        onOpenChange={setShowNewFolderDialog}
      />
    </MainScreenWrapper>
  );
}
