"use client";

import {
  ActionMenu,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  LogoLoading,
  Textarea,
} from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  ExternalLink,
  History,
  Lock,
  LockOpen,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
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
import {
  APPROVAL_STATUS_FILTER_OPTIONS,
  APPROVAL_STATUS_MAP,
  APPROVAL_STATUS_OPTIONS,
  SORT_OPTIONS,
  formatDate,
  formatDateTime,
} from "./constants";
import {
  createApproval,
  listApprovals,
  softDeleteApproval,
  updateApproval,
} from "@/lib/supabase/collaboration";

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

const EMPTY_DRAFT = {
  title: "",
  assetId: "",
  requester: "",
  reviewer: "",
  versionLabel: "",
  description: "",
};

function CreateApprovalDialog({ open, onOpenChange, onCreate }) {
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
          <DialogTitle className="text-lg font-semibold">New approval request</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Send an asset for review so it can move from draft to approved.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Title" htmlFor="approval-title">
            <Input
              id="approval-title"
              value={draft.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="e.g. Hero banner v3 — final sign-off"
              className="border-border bg-surface-card text-foreground"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Asset ID" htmlFor="approval-asset">
              <Input
                id="approval-asset"
                value={draft.assetId}
                onChange={(e) => set("assetId")(e.target.value)}
                placeholder="Asset UUID"
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
            <Field label="Version" htmlFor="approval-version">
              <Input
                id="approval-version"
                value={draft.versionLabel}
                onChange={(e) => set("versionLabel")(e.target.value)}
                placeholder="e.g. v3"
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Requester" htmlFor="approval-requester">
              <Input
                id="approval-requester"
                value={draft.requester}
                onChange={(e) => set("requester")(e.target.value)}
                placeholder="Who is asking?"
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
            <Field label="Reviewer" htmlFor="approval-reviewer">
              <Input
                id="approval-reviewer"
                value={draft.reviewer}
                onChange={(e) => set("reviewer")(e.target.value)}
                placeholder="Who decides?"
                className="border-border bg-surface-card text-foreground"
              />
            </Field>
          </div>
          <Field label="Description" htmlFor="approval-desc">
            <Textarea
              id="approval-desc"
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What should the reviewer look at?"
              className="min-h-20 border-border bg-surface-card text-foreground"
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
            Request approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function externalApprovalUrl(token) {
  if (!token) return "";
  if (typeof window === "undefined") return `/approve/${token}`;
  return new URL(`/approve/${token}`, window.location.origin).toString();
}

export function ApprovalsScreen({ projectId }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("updated-desc");
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [decisionNote, setDecisionNote] = useState("");

  useEffect(() => {
    let alive = true;
    listApprovals(projectId).then((rows) => {
      if (!alive) return;
      setApprovals(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const openApproval = openId ? approvals.find((a) => a.id === openId) ?? null : null;

  const filtered = useMemo(() => {
    let result = [...approvals];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.requester || "").toLowerCase().includes(q) ||
          (a.reviewer || "").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") result = result.filter((a) => a.status === statusFilter);

    const [field, direction] = sortValue.split("-");
    result.sort((a, b) => {
      let cmp = 0;
      if (field === "updated") cmp = new Date(a.updatedAt) - new Date(b.updatedAt);
      else if (field === "created") cmp = new Date(a.createdAt) - new Date(b.createdAt);
      else if (field === "title") cmp = a.title.localeCompare(b.title);
      return direction === "desc" ? -cmp : cmp;
    });
    return result;
  }, [approvals, search, statusFilter, sortValue]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${sortValue}`,
  });

  const stats = useMemo(
    () => [
      {
        label: "Pending review",
        value: String(approvals.filter((a) => a.status === "pending").length),
        footer: "awaiting a decision",
      },
      {
        label: "Approved",
        value: String(approvals.filter((a) => a.status === "approved").length),
        footer: "cleared for use",
      },
      {
        label: "Changes requested",
        value: String(approvals.filter((a) => a.status === "changes_requested").length),
        footer: "sent back",
      },
      {
        label: "Locked versions",
        value: String(approvals.filter((a) => a.isLocked).length),
        footer: "frozen after approval",
      },
    ],
    [approvals],
  );

  const hasActiveFilters = statusFilter !== "all" || Boolean(search);

  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  const handleCreate = async (draft) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic = {
      id,
      projectId: projectId ?? null,
      assetId: draft.assetId.trim() || null,
      title: draft.title,
      description: draft.description,
      requester: draft.requester,
      reviewer: draft.reviewer,
      status: "pending",
      versionLabel: draft.versionLabel,
      isLocked: false,
      externalToken: "",
      note: "",
      decidedAt: "",
      decidedBy: "",
      history: [{ at: now, by: draft.requester || "Workspace", decision: "pending", note: "Review requested" }],
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    };
    setApprovals((rows) => [optimistic, ...rows]);
    const created = await createApproval({
      id,
      assetId: optimistic.assetId,
      title: draft.title,
      description: draft.description,
      requester: draft.requester,
      reviewer: draft.reviewer,
      versionLabel: draft.versionLabel,
      metadata: { history: optimistic.history },
    });
    if (created) {
      setApprovals((rows) => rows.map((a) => (a.id === id ? created : a)));
      toast.success("Approval requested");
    } else {
      setApprovals((rows) => rows.filter((a) => a.id !== id));
      toast.error("Couldn't request approval.");
    }
  };

  // A decision appends to the history trail and stamps decidedAt/decidedBy so
  // the queue, the detail view and the history read from the same row.
  const handleDecide = async (approval, status, note = "") => {
    if (approval.isLocked) {
      toast.error("This version is locked — unlock it to change the decision.");
      return;
    }
    if (approval.status === status && !note) return;
    const prev = approvals;
    const now = new Date().toISOString();
    const entry = {
      at: now,
      by: approval.reviewer || "Reviewer",
      decision: status,
      note: note || "",
    };
    const next = {
      ...approval,
      status,
      note,
      decidedAt: now,
      decidedBy: approval.reviewer || "",
      history: [...(approval.history || []), entry],
    };
    setApprovals((rows) => rows.map((a) => (a.id === approval.id ? next : a)));
    const saved = await updateApproval(approval.id, {
      status,
      note,
      decidedAt: now,
      decidedBy: approval.reviewer || "",
      history: next.history,
    });
    if (saved) {
      setApprovals((rows) => rows.map((a) => (a.id === saved.id ? saved : a)));
      const label = APPROVAL_STATUS_MAP[status]?.label || status;
      toast.success(`Marked as ${label.toLowerCase()}`);
    } else {
      setApprovals(prev);
      toast.error("Couldn't save the decision.");
    }
  };

  const handleLock = async (approval, locked) => {
    const prev = approvals;
    setApprovals((rows) =>
      rows.map((a) => (a.id === approval.id ? { ...a, isLocked: locked } : a)),
    );
    const saved = await updateApproval(approval.id, { isLocked: locked });
    if (saved) {
      setApprovals((rows) => rows.map((a) => (a.id === saved.id ? saved : a)));
      toast.success(locked ? "Version locked" : "Version unlocked");
    } else {
      setApprovals(prev);
      toast.error("Couldn't change the lock.");
    }
  };

  const handleExternalLink = async (approval) => {
    if (approval.externalToken) {
      try {
        await navigator.clipboard.writeText(externalApprovalUrl(approval.externalToken));
        toast.success("External approval link copied");
      } catch {
        toast.error("Couldn't copy the link.");
      }
      return;
    }
    const token = crypto.randomUUID().replace(/-/g, "");
    const prev = approvals;
    setApprovals((rows) =>
      rows.map((a) => (a.id === approval.id ? { ...a, externalToken: token } : a)),
    );
    const saved = await updateApproval(approval.id, { externalToken: token });
    if (saved) {
      setApprovals((rows) => rows.map((a) => (a.id === saved.id ? saved : a)));
      try {
        await navigator.clipboard.writeText(externalApprovalUrl(token));
        toast.success("External approval link created and copied");
      } catch {
        toast.success("External approval link created");
      }
    } else {
      setApprovals(prev);
      toast.error("Couldn't create the external link.");
    }
  };

  const handleDelete = async (approval) => {
    const prev = approvals;
    setApprovals((rows) => rows.filter((a) => a.id !== approval.id));
    if (openId === approval.id) setOpenId(null);
    const ok = await softDeleteApproval(approval.id);
    if (ok) toast.success("Approval deleted");
    else {
      setApprovals(prev);
      toast.error("Couldn't delete the approval.");
    }
  };

  const columns = [
    {
      key: "title",
      header: "Review",
      render: (a) => (
        <div className="min-w-0">
          <p className="flex max-w-[280px] items-center gap-1.5 truncate text-sm font-medium text-foreground">
            <span className="truncate">{a.title || "Untitled review"}</span>
            {a.isLocked ? <Lock className="h-3 w-3 shrink-0 text-text-tertiary" aria-label="Version locked" /> : null}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
            {a.requester ? `From ${a.requester}` : "No requester"}
            {a.versionLabel ? ` · ${a.versionLabel}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "reviewer",
      header: "Reviewer",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => a.reviewer || "—",
    },
    {
      key: "status",
      header: "Status",
      render: (a) => (
        <StatusPill status={a.status} map={APPROVAL_STATUS_MAP} className="text-[10px]" />
      ),
    },
    {
      key: "updated",
      header: "Updated",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (a) => formatDate(a.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) => (
        <ActionMenu
          label={`Actions for ${a.title}`}
          items={[
            !a.isLocked && a.status !== "approved"
              ? {
                  icon: CheckCircle2,
                  label: "Approve",
                  onSelect: () => handleDecide(a, "approved"),
                }
              : null,
            !a.isLocked && a.status !== "rejected"
              ? {
                  icon: XCircle,
                  label: "Reject",
                  onSelect: () => handleDecide(a, "rejected"),
                }
              : null,
            {
              icon: a.isLocked ? LockOpen : Lock,
              label: a.isLocked ? "Unlock version" : "Lock version",
              onSelect: () => handleLock(a, !a.isLocked),
            },
            {
              icon: ExternalLink,
              label: a.externalToken ? "Copy external link" : "Create external link",
              onSelect: () => handleExternalLink(a),
            },
            { separator: true },
            {
              icon: Trash2,
              label: "Delete",
              destructive: true,
              onSelect: () => handleDelete(a),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title="Approvals"
        description="Move assets from draft to approved with clear decisions."
        actions={
          <Button
            className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New request
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={APPROVAL_STATUS_FILTER_OPTIONS}
            placeholder="Status"
            icon={SlidersHorizontal}
          />
          <FilterDropdown
            value={sortValue}
            onValueChange={setSortValue}
            options={SORT_OPTIONS}
            placeholder="Sort"
            icon={ArrowUpDown}
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
        <SearchInput value={search} onChange={setSearch} placeholder="Search reviews..." />
      </Toolbar>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable
            columns={columns}
            data={pager.pageItems}
            getRowKey={(a) => a.id}
            onRowClick={(a) => {
              setDecisionNote("");
              setOpenId(a.id);
            }}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                {approvals.length === 0 ? (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="No approval requests yet"
                    description="Request your first review to start the approval flow."
                    action={
                      <Button
                        className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                        onClick={() => setShowCreate(true)}
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        New request
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="No matching reviews"
                    description="No reviews match the current search and filter."
                    action={
                      <Button variant="ghost" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                )}
              </div>
            }
          />
          <ListPagination {...pager} itemLabel="reviews" />
        </div>
      )}

      <CreateApprovalDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={handleCreate}
      />

      <Dialog
        open={Boolean(openId)}
        onOpenChange={(next) => {
          if (!next) {
            setOpenId(null);
            setDecisionNote("");
          }
        }}
      >
        <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
          {openApproval ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="truncate">{openApproval.title || "Untitled review"}</span>
                  {openApproval.isLocked ? (
                    <Lock className="h-4 w-4 shrink-0 text-text-tertiary" aria-label="Version locked" />
                  ) : null}
                </DialogTitle>
                <DialogDescription className="text-sm text-text-secondary">
                  {openApproval.requester ? `Requested by ${openApproval.requester}` : "Approval review"}
                  {openApproval.reviewer ? ` · reviewer ${openApproval.reviewer}` : ""}
                  {openApproval.versionLabel ? ` · ${openApproval.versionLabel}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={openApproval.status} map={APPROVAL_STATUS_MAP} />
                  {openApproval.decidedAt ? (
                    <span className="text-xs text-text-tertiary">
                      Decided {formatDateTime(openApproval.decidedAt)}
                      {openApproval.decidedBy ? ` by ${openApproval.decidedBy}` : ""}
                    </span>
                  ) : null}
                </div>
                {openApproval.description ? (
                  <p className="text-sm text-text-secondary">{openApproval.description}</p>
                ) : null}

                <SectionCard title="Decision" description="Approve, reject, or send back for changes.">
                  <Field label="Note for the requester" htmlFor="approval-note">
                    <Textarea
                      id="approval-note"
                      value={decisionNote}
                      onChange={(e) => setDecisionNote(e.target.value)}
                      placeholder="What changed, or what still needs work?"
                      disabled={openApproval.isLocked}
                      className="min-h-20 border-border bg-surface-card text-foreground"
                    />
                  </Field>
                  {openApproval.isLocked ? (
                    <p className="text-xs text-text-tertiary">
                      This version is locked — unlock it to record another decision.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={openApproval.isLocked}
                      className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                      onClick={() => handleDecide(openApproval, "approved", decisionNote)}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={openApproval.isLocked}
                      className="border-border bg-surface-card text-xs text-foreground hover:bg-surface-active"
                      onClick={() => handleDecide(openApproval, "changes_requested", decisionNote)}
                    >
                      Request changes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={openApproval.isLocked}
                      className="border-border bg-surface-card text-xs text-red-400 hover:bg-red-500/10"
                      onClick={() => handleDecide(openApproval, "rejected", decisionNote)}
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </SectionCard>

                <SectionCard
                  title="History"
                  description="Every decision on this review, newest last."
                >
                  {(openApproval.history || []).length === 0 ? (
                    <p className="flex items-center gap-2 text-xs text-text-tertiary">
                      <History className="h-3.5 w-3.5" /> No decisions recorded yet.
                    </p>
                  ) : (
                    <ol className="space-y-3">
                      {(openApproval.history || []).map((h, i) => (
                        <li key={`${h.at}-${i}`} className="flex gap-3">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border-strong" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">
                              {APPROVAL_STATUS_MAP[h.decision]?.label || h.decision}
                              <span className="ml-1.5 font-normal text-text-tertiary">
                                {h.by} · {formatDateTime(h.at)}
                              </span>
                            </p>
                            {h.note ? (
                              <p className="mt-0.5 text-xs text-text-secondary">{h.note}</p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </SectionCard>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">External approval link</p>
                    <p className="truncate text-xs text-text-secondary">
                      {openApproval.externalToken
                        ? externalApprovalUrl(openApproval.externalToken)
                        : "Let someone outside the workspace decide."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-border bg-transparent text-xs text-foreground hover:bg-surface-active"
                    onClick={() => handleExternalLink(openApproval)}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    {openApproval.externalToken ? "Copy" : "Create"}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <div className="flex w-full items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border bg-transparent text-xs text-foreground hover:bg-surface-active"
                    onClick={() => handleLock(openApproval, !openApproval.isLocked)}
                  >
                    {openApproval.isLocked ? (
                      <>
                        <LockOpen className="mr-1.5 h-3.5 w-3.5" /> Unlock version
                      </>
                    ) : (
                      <>
                        <Lock className="mr-1.5 h-3.5 w-3.5" /> Lock version
                      </>
                    )}
                  </Button>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <span className="text-text-tertiary">Status:</span>
                      <select
                        value={openApproval.status}
                        disabled={openApproval.isLocked}
                        onChange={(e) => handleDecide(openApproval, e.target.value, decisionNote)}
                        aria-label="Review status"
                        className="h-8 rounded-md border border-border bg-surface-card px-2 text-xs font-medium text-foreground disabled:opacity-50"
                      >
                        {APPROVAL_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground hover:bg-surface-active"
                      onClick={() => {
                        setOpenId(null);
                        setDecisionNote("");
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default ApprovalsScreen;
