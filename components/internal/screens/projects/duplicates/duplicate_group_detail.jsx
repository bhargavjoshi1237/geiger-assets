"use client";

import {
  Badge,
  Button,
  LogoLoading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from "@geiger/ui";
import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Save,
  CheckCircle2,
  EyeOff,
  Crown,
  Check,
  CopyCheck,
  File,
} from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import {
  SectionCard,
  StatusPill,
  Field,
  EmptyState,
} from "@/components/internal/shared/screen_kit";
import {
  TYPE_ICONS,
  FILE_TYPE_COLORS,
  formatBytes,
} from "@/components/internal/screens/projects/library/constants";
import { MATCH_META, STATUS_META, STATUS_OPTIONS, formatDate } from "./constants";
import {
  getGroup,
  listMembers,
  updateGroup,
  setKeeper,
  resolveGroup,
  ignoreGroup,
} from "@/lib/supabase/duplicates";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "members",
        label: "Members",
        icon: CopyCheck,
        desc: "Duplicate assets in this group — pick one to keep.",
      },
    ],
  },
  {
    group: "Review",
    items: [
      {
        key: "resolution",
        label: "Resolution",
        icon: CheckCircle2,
        desc: "Recommended action and status for this group.",
      },
      {
        key: "details",
        label: "Details",
        icon: File,
        desc: "Match type, similarity, and timestamps.",
      },
    ],
  },
];

function MemberCard({ member, onMakeKeeper }) {
  const asset = member.asset;
  const Icon = TYPE_ICONS[asset?.type] || File;
  const color = asset?.color || "#737373";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 transition-colors",
        member.isKeeper
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border bg-surface-card/40",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
          style={{ background: `${color}15`, borderColor: `${color}25` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {asset?.name || "Unknown asset"}
          </p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
            {asset?.format || asset?.type || "—"}
            {asset ? ` · ${formatBytes(asset.sizeBytes)}` : ""}
          </p>
        </div>
        {member.isKeeper ? (
          <Badge className="shrink-0 border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-300">
            <Crown className="h-2.5 w-2.5" />
            Keeper
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        {asset ? (
          <Badge className={cn("border px-1.5 py-0 text-[10px]", FILE_TYPE_COLORS[asset.type])}>
            {asset.status}
          </Badge>
        ) : (
          <span />
        )}
        {member.isKeeper ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300">
            <Check className="h-3 w-3" />
            Kept
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onMakeKeeper(member.id)}
          >
            <Crown className="mr-1 h-3.5 w-3.5" />
            Mark as keeper
          </Button>
        )}
      </div>
    </div>
  );
}

export function MembersSection({ members, onMakeKeeper }) {
  return (
    <SectionCard
      title="Duplicate assets"
      description="Pick one asset to keep — the rest can be removed once resolved."
    >
      {members.length === 0 ? (
        <EmptyState
          icon={CopyCheck}
          title="No members"
          description="This group has no linked assets."
          className="py-10"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onMakeKeeper={onMakeKeeper}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export function ResolutionSection({
  action,
  onActionChange,
  status,
  onStatusChange,
  dirty,
  saving,
  busy,
  groupStatus,
  onSave,
  onResolve,
  onIgnore,
}) {
  return (
    <SectionCard title="Resolution">
      <div className="grid gap-4">
        <Field label="Recommended action" hint="What should happen to this group.">
          <Textarea
            value={action}
            onChange={(e) => onActionChange(e.target.value)}
            placeholder="e.g. Keep the highest-resolution copy and delete the rest…"
            className="min-h-24 border-border bg-surface-card text-foreground"
          />
        </Field>
        <Field label="Status" className="sm:max-w-xs">
          <Select value={status} onValueChange={onStatusChange}>
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
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
            onClick={onSave}
            disabled={!dirty || saving}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {dirty ? "Save changes" : "Saved"}
          </Button>
          <Button
            variant="outline"
            className="h-9 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={onResolve}
            disabled={busy || groupStatus === "resolved"}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Resolve
          </Button>
          <Button
            variant="outline"
            className="h-9 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={onIgnore}
            disabled={busy || groupStatus === "ignored"}
          >
            <EyeOff className="mr-1.5 h-4 w-4" />
            Ignore
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

export function GroupDetailsSection({ group, members, matchMeta }) {
  if (!group) return null;
  return (
    <SectionCard title="Details">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            Match type
          </dt>
          <dd className="mt-1">
            <Badge className={cn("border px-1.5 py-0 text-[10px]", matchMeta.className)}>
              {matchMeta.label}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            Similarity
          </dt>
          <dd className="mt-1 text-sm tabular-nums text-foreground">{group.similarity}%</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            Members
          </dt>
          <dd className="mt-1 text-sm tabular-nums text-foreground">{members.length}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            Status
          </dt>
          <dd className="mt-1">
            <StatusPill status={group.status} map={STATUS_META} className="text-[10px]" />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            Detected
          </dt>
          <dd className="mt-1 text-sm text-foreground">{formatDate(group.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            Last updated
          </dt>
          <dd className="mt-1 text-sm text-foreground">{formatDate(group.updatedAt)}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}

export const SECTIONS = {
  members: MembersSection,
  resolution: ResolutionSection,
  details: GroupDetailsSection,
};

export function DuplicateGroupDetailScreen({ id, onBack, onChange }) {
  const { section: active, setSection: setActive } = useWorkspaceUrl();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("open");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getGroup(id), listMembers(id)]).then(([g, mems]) => {
      if (!alive) return;
      setGroup(g);
      if (g) {
        setAction(g.recommendedAction);
        setStatus(g.status);
      }
      setMembers(mems ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const dirty = useMemo(() => {
    if (!group) return false;
    return group.recommendedAction !== action || group.status !== status;
  }, [group, action, status]);

  const applyUpdate = (updated) => {
    setGroup(updated);
    setAction(updated.recommendedAction);
    setStatus(updated.status);
    onChange?.(updated);
  };

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    const updated = await updateGroup(id, { recommendedAction: action, status });
    setSaving(false);
    if (updated) {
      applyUpdate(updated);
    } else {
      setAction(group.recommendedAction);
      setStatus(group.status);
    }
  };

  const handleResolve = async () => {
    if (!group) return;
    const prev = group;
    setBusy(true);
    setGroup((g) => ({ ...g, status: "resolved" }));
    setStatus("resolved");
    const updated = await resolveGroup(id);
    setBusy(false);
    if (updated) applyUpdate(updated);
    else {
      setGroup(prev);
      setStatus(prev.status);
    }
  };

  const handleIgnore = async () => {
    if (!group) return;
    const prev = group;
    setBusy(true);
    setGroup((g) => ({ ...g, status: "ignored" }));
    setStatus("ignored");
    const updated = await ignoreGroup(id);
    setBusy(false);
    if (updated) applyUpdate(updated);
    else {
      setGroup(prev);
      setStatus(prev.status);
    }
  };

  const handleMakeKeeper = async (memberId) => {
    const prev = members;
    setMembers((rows) => rows.map((m) => ({ ...m, isKeeper: m.id === memberId })));
    const ok = await setKeeper(id, memberId);
    if (!ok) setMembers(prev);
  };

  if (loading) {
    return (
      <EditorShell
        back={{ label: "Duplicate Review", onClick: onBack }}
        title="Loading duplicate group…"
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

  if (!group) {
    return (
      <EditorShell
        back={{ label: "Duplicate Review", onClick: onBack }}
        title="Duplicate group not found"
        nav={NAV_GROUPS}
        subject={null}
        active={active}
        onActiveChange={setActive}
      >
        <EmptyState
          icon={CopyCheck}
          title="Duplicate group not found"
          description="This group may have been resolved or isn't available."
          action={
            <Button
              variant="outline"
              className="border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active"
              onClick={onBack}
            >
              Back to Duplicate Review
            </Button>
          }
        />
      </EditorShell>
    );
  }

  const matchMeta = MATCH_META[group.matchType] || MATCH_META.exact;

  return (
    <EditorShell
      searchable
      back={{ label: "Duplicate Review", onClick: onBack }}
      title="Duplicate group"
      status={group.status}
      statusMap={STATUS_META}
      badges={
        <Badge className={cn("border px-1.5 py-0 text-[10px]", matchMeta.className)}>
          {matchMeta.label}
        </Badge>
      }
      meta={`${members.length} member${members.length === 1 ? "" : "s"} · ${group.similarity}% match`}
      actions={
        <>
          <Button
            variant="outline"
            className="h-9 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={handleIgnore}
            disabled={busy || group.status === "ignored"}
          >
            <EyeOff className="mr-1.5 h-4 w-4" />
            Ignore
          </Button>
          <Button
            variant="outline"
            className="h-9 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={handleResolve}
            disabled={busy || group.status === "resolved"}
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
            )}
            Resolve
          </Button>
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
        </>
      }
      nav={NAV_GROUPS}
      subject={group}
      active={active}
      onActiveChange={setActive}
    >
      {({ active: key }) => {
        const ActiveSection = SECTIONS[key] || SECTIONS.members;
        return (
          <ActiveSection
            group={group}
            members={members}
            matchMeta={matchMeta}
            action={action}
            status={status}
            dirty={dirty}
            saving={saving}
            busy={busy}
            groupStatus={group.status}
            onActionChange={setAction}
            onStatusChange={setStatus}
            onSave={handleSave}
            onResolve={handleResolve}
            onIgnore={handleIgnore}
            onMakeKeeper={handleMakeKeeper}
            headerItem={NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === key)}
          />
        );
      }}
    </EditorShell>
  );
}

export default DuplicateGroupDetailScreen;
