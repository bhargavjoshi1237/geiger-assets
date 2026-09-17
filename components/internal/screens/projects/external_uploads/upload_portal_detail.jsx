"use client";

import {
  Button,
  Input,
  LogoLoading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Save,
  Link2,
  Settings,
  Inbox,
  Check,
  X,
  Copy,
  Mail,
} from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import {
  SectionCard,
  StatusPill,
  Field,
  EmptyState,
  DataTable,
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
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

const PORTAL_BASE_URL = "https://assets.geiger.studio/u";

// ---------------------------------------------------------------------------
// Submissions tab
// ---------------------------------------------------------------------------

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
            className="h-7 px-2 text-xs text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 disabled:opacity-40"
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
            className="h-7 px-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
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
          <EmptyState
            icon={Inbox}
            title="No submissions yet"
            description="Share this portal to start receiving uploads."
            className="py-12"
          />
        }
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Editor sections
// ---------------------------------------------------------------------------

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "settings",
        label: "Settings",
        icon: Settings,
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
        desc: "Send this link to collect files.",
      },
    ],
  },
];

function SettingsSection({ draft, set }) {
  return (
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
  );
}

function SubmissionsSection({ rows, onApprove, onReject }) {
  return <SubmissionsTab rows={rows} onApprove={onApprove} onReject={onReject} />;
}

function ShareSection({ draft, shareUrl, copied, onCopy }) {
  return (
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
              className="h-9 shrink-0 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={onCopy}
            >
              {copied ? (
                <Check className="mr-1.5 h-4 w-4 text-emerald-300" />
              ) : (
                <Copy className="mr-1.5 h-4 w-4" />
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
  );
}

const SECTIONS = {
  settings: SettingsSection,
  submissions: SubmissionsSection,
  share: ShareSection,
};

// ---------------------------------------------------------------------------
// Detail screen
// ---------------------------------------------------------------------------

export function UploadPortalDetailScreen({ id, onBack, onChange }) {
  const { section: active, setSection: setActive } = useWorkspaceUrl();
  const [loading, setLoading] = useState(true);
  const [portal, setPortal] = useState(null);
  const [draft, setDraft] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    const patch = {
      name: draft.name,
      type: draft.type,
      destinationFolder: draft.destinationFolder,
      requireMetadata: draft.requireMetadata,
      status: draft.status,
      expiresAt: draft.expiresAt,
    };
    const updated = await updatePortal(id, patch);
    setSaving(false);
    if (updated) {
      setPortal(updated);
      setDraft(updated);
      onChange?.(updated);
    } else {
      setDraft(portal);
    }
  };

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

  const shareUrl = draft ? `${PORTAL_BASE_URL}/${draft.slug}` : "";

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <EditorShell
        back={{ label: "External Uploads", onClick: onBack }}
        title="Loading portal…"
        nav={NAV_GROUPS}
        subject={null}
        active={active}
        onActiveChange={setActive}
      >
        <div className="flex h-64 items-center justify-center text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      </EditorShell>
    );
  }

  if (!portal || !draft) {
    return (
      <EditorShell
        back={{ label: "External Uploads", onClick: onBack }}
        title="Portal not found"
        nav={NAV_GROUPS}
        subject={null}
        active={active}
        onActiveChange={setActive}
      >
        <EmptyState
          icon={Inbox}
          title="Portal not found"
          description="This portal may have been deleted or isn't available."
          action={
            <Button
              variant="outline"
              className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
              onClick={onBack}
            >
              Back to External Uploads
            </Button>
          }
        />
      </EditorShell>
    );
  }

  return (
    <EditorShell
      searchable
      back={{ label: "External Uploads", onClick: onBack }}
      title={draft.name || "Untitled portal"}
      status={draft.status}
      statusMap={PORTAL_STATUS_META}
      meta={`/u/${draft.slug}`}
      actions={
        <Button
          className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          {dirty ? "Save changes" : "Saved"}
        </Button>
      }
      nav={NAV_GROUPS}
      subject={draft}
      active={active}
      onActiveChange={setActive}
    >
      {({ active: key }) => {
        const ActiveSection = SECTIONS[key] || SECTIONS.settings;
        return (
          <ActiveSection
            draft={draft}
            set={set}
            rows={submissions}
            onApprove={handleApprove}
            onReject={handleReject}
            shareUrl={shareUrl}
            copied={copied}
            onCopy={handleCopy}
            headerItem={NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === key)}
          />
        );
      }}
    </EditorShell>
  );
}

export default UploadPortalDetailScreen;
