"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Link2,
  Inbox,
  SquarePen,
  Check,
  X,
  Copy,
  Mail,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  EditorLoading,
  EditorNotFound,
  EditorShell,
} from "@/components/internal/shared/editor_shell";
import { EditorSaveActions, useEditorGuard } from "@/components/internal/shared/unsaved_changes";
import {
  DataTable,
  EmptyState,
  Field,
  SectionCard,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import {
  PORTAL_STATUS_META,
  SUBMISSION_STATUS_META,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  formatDate,
} from "./constants";
import {
  getPortal,
  updatePortal,
  listSubmissions,
  updateSubmission,
} from "@/lib/supabase/external_uploads";
import { useCopied } from "@/lib/use-copied";
import { portalShareUrl } from "@/lib/share";

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "settings",
        label: "Portal settings",
        icon: SquarePen,
        desc: "Control how this portal collects files.",
      },
    ],
  },
  {
    group: "Manage",
    items: [
      {
        key: "submissions",
        label: "Submissions",
        icon: Inbox,
        desc: "Review and triage incoming uploads.",
      },
      {
        key: "share",
        label: "Share",
        icon: Link2,
        desc: "The public link contributors use to upload.",
      },
    ],
  },
];

function SubmissionsTab({ rows, onApprove, onReject }) {
  const columns = [
    {
      key: "submitter",
      header: "Submitter",
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {s.submitterName || "Anonymous"}
          </p>
          {s.submitterEmail ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-text-tertiary">
              <Mail className="h-3 w-3" />
              {s.submitterEmail}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "files",
      header: "Files",
      align: "right",
      className: "tabular-nums text-xs text-text-secondary",
      render: (s) => s.fileCount.toLocaleString(),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <StatusPill status={s.status} map={SUBMISSION_STATUS_META} className="text-[10px]" />
      ),
    },
    {
      key: "created",
      header: "Received",
      className: "text-xs text-text-secondary hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (s) => formatDate(s.createdAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Approve submission"
            disabled={s.status === "approved"}
            className="h-7 px-2 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-800 dark:hover:text-emerald-200 disabled:opacity-40"
            onClick={() => onApprove(s)}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Approve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Reject submission"
            disabled={s.status === "rejected"}
            className="h-7 px-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-40"
            onClick={() => onReject(s)}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <SectionCard
      title="Submissions"
      description="Review and triage incoming uploads."
      bodyPadding={false}
    >
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(s) => s.id}
        empty={
          <div className="rounded-xl border border-border bg-surface-subtle">
            <EmptyState
              icon={Inbox}
              title="No submissions yet"
              description="Share this portal to start receiving uploads."
              className="py-12"
            />
          </div>
        }
      />
    </SectionCard>
  );
}

export function UploadPortalDetailScreen({ id, onBack, onChange }) {
  const [loading, setLoading] = useState(true);
  const [portal, setPortal] = useState(null);
  const [draft, setDraft] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [copied, flashCopied] = useCopied();

  useEffect(() => {
    let alive = true;
    Promise.all([getPortal(id), listSubmissions(id)]).then(([p, subs]) => {
      if (!alive) return;
      setPortal(p);
      setDraft(p);
      setSubmissions(subs ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const dirty = useMemo(() => {
    if (!portal || !draft) return false;
    return (
      portal.name !== draft.name ||
      portal.type !== draft.type ||
      portal.destinationFolder !== draft.destinationFolder ||
      portal.requireMetadata !== draft.requireMetadata ||
      portal.status !== draft.status ||
      portal.expiresAt !== draft.expiresAt
    );
  }, [portal, draft]);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const save = useCallback(async () => {
    if (!dirty || saving || !draft) return false;
    if (!draft.name?.trim()) {
      toast.error("Give the portal a name before saving.");
      return false;
    }
    setSaving(true);
    const updated = await updatePortal(id, {
      name: draft.name,
      type: draft.type,
      destinationFolder: draft.destinationFolder,
      requireMetadata: draft.requireMetadata,
      status: draft.status,
      expiresAt: draft.expiresAt,
    });
    setSaving(false);
    if (updated) {
      setPortal(updated);
      setDraft(updated);
      onChange?.(updated);
      toast.success("Changes saved.");
      return true;
    }
    toast.error("Couldn't save your changes to the server.");
    return false;
  }, [dirty, draft, id, onChange, saving]);

  const handleApprove = async (sub) => {
    const prev = submissions;
    setSubmissions((rows) =>
      rows.map((s) => (s.id === sub.id ? { ...s, status: "approved" } : s)),
    );
    const updated = await updateSubmission(sub.id, { status: "approved" });
    if (!updated) setSubmissions(prev);
  };

  const handleReject = async (sub) => {
    const prev = submissions;
    setSubmissions((rows) =>
      rows.map((s) => (s.id === sub.id ? { ...s, status: "rejected" } : s)),
    );
    const updated = await updateSubmission(sub.id, { status: "rejected" });
    if (!updated) setSubmissions(prev);
  };

  const shareUrl = draft ? portalShareUrl(draft.slug) : "";

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
    flashCopied();
  };

  const guard = useEditorGuard({
    dirty,
    saving,
    save,
    discard: () => setDraft(portal),
    onBack,
    name: draft?.name || "this portal",
  });
  const back = { label: "External Uploads", onClick: guard.back };

  if (loading) {
    return <EditorLoading back={back} title="Loading portal…" nav={NAV_GROUPS} />;
  }

  if (!portal || !draft) {
    return (
      <EditorNotFound
        back={back}
        nav={NAV_GROUPS}
        icon={Inbox}
        title="Portal not found"
        description="This portal may have been deleted or isn't available."
      />
    );
  }

  return (
    <>
      <EditorShell
        back={back}
        title={draft.name || "Untitled portal"}
        status={draft.status}
        statusMap={PORTAL_STATUS_META}
        meta={`/u/${draft.slug} · ${submissions.length} submission${submissions.length === 1 ? "" : "s"}`}
        actions={
          <EditorSaveActions
            dirty={dirty}
            saving={saving}
            onSave={save}
            onDiscard={() => setDraft(portal)}
          />
        }
        nav={NAV_GROUPS}
        subject={draft}
        active={guard.active}
        onActiveChange={guard.selectSection}
      >
        {({ active }) => (
          <>
            {active === "settings" ? (
              <>
                <SectionCard title="Portal Settings" description="Control how this portal collects files.">
                  <div className="grid gap-4">
                    <Field label="Name" htmlFor="portal-name">
                      <Input
                        id="portal-name"
                        value={draft.name}
                        onChange={(e) => set("name")(e.target.value)}
                        className="border-border bg-surface-card text-foreground"
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Type">
                        <Select value={draft.type} onValueChange={set("type")}>
                          <SelectTrigger className="border-border bg-surface-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-surface-subtle text-foreground">
                            {TYPE_OPTIONS.map((o) => (
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
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Destination folder" htmlFor="portal-folder">
                        <Input
                          id="portal-folder"
                          value={draft.destinationFolder}
                          onChange={(e) => set("destinationFolder")(e.target.value)}
                          className="border-border bg-surface-card text-foreground"
                        />
                      </Field>
                      <Field label="Expires" htmlFor="portal-expires" hint="Leave blank for no expiry.">
                        <Input
                          id="portal-expires"
                          type="date"
                          value={draft.expiresAt ? draft.expiresAt.slice(0, 10) : ""}
                          onChange={(e) => set("expiresAt")(e.target.value)}
                          className="border-border bg-surface-card text-foreground"
                        />
                      </Field>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Require metadata</p>
                        <p className="text-xs text-text-secondary">
                          Ask submitters for context before they upload.
                        </p>
                      </div>
                      <Switch
                        checked={draft.requireMetadata}
                        onCheckedChange={set("requireMetadata")}
                      />
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : null}

            {active === "submissions" ? (
              <>
                <SubmissionsTab rows={submissions} onApprove={handleApprove} onReject={handleReject} />
              </>
            ) : null}

            {active === "share" ? (
              <>
                <SectionCard title="Share" description="Send this link to collect files.">
                  <div className="grid gap-4">
                    <Field label="Public upload link">
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={shareUrl}
                          className="border-border bg-surface-card font-mono text-xs text-foreground"
                        />
                        <Button
                          variant="outline"
                          className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                          onClick={handleCopy}
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </Field>
                    <p className="text-xs text-text-secondary">
                      {draft.requireMetadata
                        ? "Submitters must provide metadata before their files are accepted."
                        : "Submitters can upload files without providing additional metadata."}
                    </p>
                  </div>
                </SectionCard>
              </>
            ) : null}
          </>
        )}
      </EditorShell>

      {guard.dialog}
    </>
  );
}

export default UploadPortalDetailScreen;
