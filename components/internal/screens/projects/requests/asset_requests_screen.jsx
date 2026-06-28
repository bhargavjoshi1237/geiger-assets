"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Eye,
  PlayCircle,
  CheckCircle2,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  Loader2,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  PRIORITY_META,
  STATUS_META,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  SORT_OPTIONS,
  formatDate,
  isOverdue,
} from "./constants";
import {
  listRequests,
  createRequest,
  updateRequest,
  softDeleteRequest,
} from "@/lib/supabase/requests";
import { AssetRequestDetailScreen } from "./asset_request_detail";

const EMPTY_DRAFT = {
  title: "",
  description: "",
  requester: "",
  assignee: "",
  priority: "medium",
  status: "open",
  dueDate: "",
};

function FilterDropdown({ value, onValueChange, options, placeholder, icon: Icon }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-8 gap-1.5 rounded-md border-border bg-surface-card px-3 text-xs font-medium text-foreground hover:bg-surface-subtle"
        >
          {Icon ? <Icon className="h-3.5 w-3.5 text-text-secondary" /> : null}
          {options.find((o) => o.value === value)?.label || placeholder}
          <ChevronDown className="h-3 w-3 text-text-secondary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="cursor-pointer text-xs focus:bg-surface-hover focus:text-foreground"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowActions({ request, onOpen, onStatus, onDelete }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Request actions"
            className="h-7 w-7 text-text-secondary hover:bg-surface-hover hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border-border bg-surface-subtle text-foreground" align="end">
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onOpen(request)}
          >
            <Eye className="mr-2 h-3.5 w-3.5" /> Open
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onStatus(request, "in_progress")}
          >
            <PlayCircle className="mr-2 h-3.5 w-3.5" /> Mark In Progress
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-xs focus:bg-surface-hover"
            onClick={() => onStatus(request, "approved")}
          >
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Mark Approved
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-surface-hover" />
          <DropdownMenuItem
            className="cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-400"
            onClick={() => onDelete(request)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CreateRequestDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState("");
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.title.trim()) {
      setError("A title is required.");
      return;
    }
    onCreate({ ...draft, title: draft.title.trim() });
    setDraft(EMPTY_DRAFT);
    setError("");
    onOpenChange(false);
  };

  const close = (next) => {
    if (!next) {
      setDraft(EMPTY_DRAFT);
      setError("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Request</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Request missing creative work and assign it for delivery.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Title" htmlFor="req-title">
            <Input
              id="req-title"
              value={draft.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="e.g. Spring campaign hero banner"
              className="border-border bg-surface-card text-foreground"
            />
          </Field>
          <Field label="Description" htmlFor="req-desc">
            <Textarea
              id="req-desc"
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Describe what's needed…"
              className="min-h-20 border-border bg-surface-card text-foreground"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Requester" htmlFor="req-requester">
              <Input
                id="req-requester"
                value={draft.requester}
                onChange={(e) => set("requester")(e.target.value)}
                placeholder="Who is asking?"
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
            <Field label="Assignee" htmlFor="req-assignee">
              <Input
                id="req-assignee"
                value={draft.assignee}
                onChange={(e) => set("assignee")(e.target.value)}
                placeholder="Who will deliver?"
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority">
              <Select value={draft.priority} onValueChange={set("priority")}>
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={draft.status} onValueChange={set("status")}>
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle text-foreground">
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Due date" htmlFor="req-due">
            <Input
              id="req-due"
              type="date"
              value={draft.dueDate}
              onChange={(e) => set("dueDate")(e.target.value)}
              className="border-border bg-surface-card text-foreground"
            />
          </Field>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            Create Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssetRequestsScreen({ projectId }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortValue, setSortValue] = useState("updated-desc");
  const [openId, setOpenId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    listRequests(projectId).then((rows) => {
      setRequests(rows ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let result = [...requests];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.requester.toLowerCase().includes(q) ||
          r.assignee.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (priorityFilter !== "all") result = result.filter((r) => r.priority === priorityFilter);

    const [field, direction] = sortValue.split("-");
    result.sort((a, b) => {
      let cmp = 0;
      if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "due") cmp = new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
      else if (field === "title") cmp = a.title.localeCompare(b.title);
      return direction === "desc" ? -cmp : cmp;
    });
    return result;
  }, [requests, search, statusFilter, priorityFilter, sortValue]);

  const stats = useMemo(() => {
    const open = requests.filter((r) => r.status === "open").length;
    const inProgress = requests.filter((r) => r.status === "in_progress").length;
    const overdue = requests.filter((r) => isOverdue(r.dueDate, r.status)).length;
    const closed = requests.filter((r) => r.status === "closed").length;
    return [
      { label: "Open", value: String(open), footer: "awaiting pickup" },
      { label: "In Progress", value: String(inProgress), footer: "being worked on" },
      { label: "Overdue", value: String(overdue), footer: "past due date" },
      { label: "Closed", value: String(closed), footer: "wrapped up" },
    ];
  }, [requests]);

  const hasActiveFilters =
    statusFilter !== "all" || priorityFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setSearch("");
  };

  const handleCreate = async (draft) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic = {
      id,
      projectId: null,
      referenceAssetId: null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      ...draft,
    };
    setRequests((rows) => [optimistic, ...rows]);
    const created = await createRequest({ id, ...draft });
    if (created) {
      setRequests((rows) => rows.map((r) => (r.id === id ? created : r)));
    } else {
      setRequests((rows) => rows.filter((r) => r.id !== id));
    }
  };

  const handleStatus = async (request, status) => {
    if (request.status === status) return;
    const prev = requests;
    setRequests((rows) =>
      rows.map((r) => (r.id === request.id ? { ...r, status } : r)),
    );
    const updated = await updateRequest(request.id, { status });
    if (updated) {
      setRequests((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
    } else {
      setRequests(prev);
    }
  };

  const handleDelete = async (request) => {
    const prev = requests;
    setRequests((rows) => rows.filter((r) => r.id !== request.id));
    const ok = await softDeleteRequest(request.id);
    if (!ok) setRequests(prev);
  };

  const syncRow = (updated) =>
    setRequests((rows) => rows.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));

  const columns = [
    {
      key: "title",
      header: "Request",
      render: (r) => (
        <div className="min-w-0">
          <p className="max-w-[280px] truncate text-sm font-medium text-foreground">{r.title}</p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
            {r.requester ? `Requested by ${r.requester}` : "Unassigned requester"}
          </p>
        </div>
      ),
    },
    {
      key: "assignee",
      header: "Assignee",
      className: "text-xs text-text-secondary hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (r) => r.assignee || "—",
    },
    {
      key: "priority",
      header: "Priority",
      render: (r) => {
        const meta = PRIORITY_META[r.priority] || PRIORITY_META.medium;
        return (
          <Badge className={cn("border px-1.5 py-0 text-[10px]", meta.className)}>
            {meta.label}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status={r.status} map={STATUS_META} className="text-[10px]" />,
    },
    {
      key: "due",
      header: "Due",
      className: "text-xs text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (r) => (
        <span className={cn(isOverdue(r.dueDate, r.status) && "text-red-400")}>
          {formatDate(r.dueDate)}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      className: "text-xs text-text-secondary hidden lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (r) => formatDate(r.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <RowActions
          request={r}
          onOpen={(x) => setOpenId(x.id)}
          onStatus={handleStatus}
          onDelete={handleDelete}
        />
      ),
    },
  ];

  if (openId) {
    return (
      <AssetRequestDetailScreen
        key={openId}
        id={openId}
        onBack={() => setOpenId(null)}
        onChange={syncRow}
        projectId={projectId}
      />
    );
  }

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Asset Requests"
        description="Request missing creative work and track delivery."
        actions={
          <Button
            className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Request
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search requests..."
            className="w-full sm:w-64"
          />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_FILTER_OPTIONS}
            placeholder="Status"
            icon={SlidersHorizontal}
          />
          <FilterDropdown
            value={priorityFilter}
            onValueChange={setPriorityFilter}
            options={PRIORITY_FILTER_OPTIONS}
            placeholder="Priority"
          />
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground"
              onClick={clearFilters}
            >
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          ) : null}
        </div>
        <FilterDropdown
          value={sortValue}
          onValueChange={setSortValue}
          options={SORT_OPTIONS}
          placeholder="Sort"
          icon={ArrowUpDown}
        />
      </Toolbar>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(r) => r.id}
          onRowClick={(r) => setOpenId(r.id)}
          empty={
            <EmptyState
              icon={Inbox}
              title="No requests found"
              description={
                hasActiveFilters
                  ? "Try adjusting your filters or search query."
                  : "Create your first request to get started."
              }
              action={
                hasActiveFilters ? (
                  <Button
                    variant="outline"
                    className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    New Request
                  </Button>
                )
              }
            />
          }
        />
      )}

      {!loading && filtered.length > 0 ? (
        <div className="text-xs text-text-secondary">
          Showing {filtered.length} of {requests.length} requests
        </div>
      ) : null}

      <CreateRequestDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={handleCreate}
      />
    </MainScreenWrapper>
  );
}

export default AssetRequestsScreen;
