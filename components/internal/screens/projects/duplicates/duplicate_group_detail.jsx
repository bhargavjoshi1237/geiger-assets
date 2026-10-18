"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  EyeOff,
  Crown,
  Check,
  CopyCheck,
  Gavel,
  Info,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Textarea } from "@geiger/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import {
  EditorLoading,
  EditorNotFound,
  EditorShell,
} from "@/components/internal/shared/editor_shell";
import { EditorSaveActions, useEditorGuard } from "@/components/internal/shared/unsaved_changes";
import {
  EmptyState,
  Field,
  SectionCard,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import { STATUS_META as ASSET_STATUS_META } from "@/components/internal/screens/projects/library/constants";
import { formatBytes } from "@/lib/format";
import { MATCH_META, STATUS_META, STATUS_OPTIONS, formatDate } from "./constants";
import {
  getGroup,
  listMembers,
  updateGroup,
  setKeeper,
  resolveGroup,
  ignoreGroup,
} from "@/lib/supabase/duplicates";

const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "members",
        label: "Members",
        icon: CopyCheck,
        desc: "Pick one asset to keep — the rest can be removed once resolved.",
      },
    ],
  },
  {
    group: "Manage",
    items: [
      {
        key: "resolution",
        label: "Resolution",
        icon: Gavel,
        desc: "The recommended action and review status for this group.",
      },
      {
        key: "details",
        label: "Details",
        icon: Info,
        desc: "Match type, similarity, and detection dates.",
      },
    ],
  },
];

function MemberCard({ member, onMakeKeeper }) {
  const asset = member.asset;
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
        <AssetThumbnail asset={asset} large className="h-10 w-10" iconClassName="h-5 w-5" />
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
          <Badge className="shrink-0 border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0 text-[10px] text-emerald-700 dark:text-emerald-300">
            <Crown className="h-2.5 w-2.5" />
            Keeper
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        {asset ? (
          <StatusPill status={asset.status} map={ASSET_STATUS_META} className="text-[10px]" />
        ) : (
          <span />
        )}
        {member.isKeeper ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
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

export function DuplicateGroupDetailScreen({ id, onBack, onChange }) {
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

  const applyUpdate = useCallback(
    (updated) => {
      setGroup(updated);
      setAction(updated.recommendedAction);
      setStatus(updated.status);
      onChange?.(updated);
    },
    [onChange],
  );

  const discard = useCallback(() => {
    setAction(group?.recommendedAction ?? "");
    setStatus(group?.status ?? "open");
  }, [group]);

  const save = useCallback(async () => {
    if (!dirty || saving) return false;
    setSaving(true);
    const updated = await updateGroup(id, { recommendedAction: action, status });
    setSaving(false);
    if (updated) {
      applyUpdate(updated);
      toast.success("Changes saved.");
      return true;
    }
    toast.error("Couldn't save your changes to the server.");
    return false;
  }, [action, applyUpdate, dirty, id, saving, status]);

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

  const guard = useEditorGuard({
    dirty,
    saving,
    save,
    discard,
    onBack,
    name: "this duplicate group",
  });
  const back = { label: "Duplicate Review", onClick: guard.back };

  if (loading) {
    return <EditorLoading back={back} title="Loading duplicate group…" nav={NAV_GROUPS} />;
  }

  if (!group) {
    return (
      <EditorNotFound
        back={back}
        nav={NAV_GROUPS}
        icon={CopyCheck}
        title="Duplicate group not found"
        description="This group may have been resolved or isn't available."
      />
    );
  }

  const matchMeta = MATCH_META[group.matchType] || MATCH_META.exact;

  return (
    <>
      <EditorShell
        back={back}
        title="Duplicate group"
        status={group.status}
        statusMap={STATUS_META}
        badges={
          <Badge className={cn("border px-1.5 py-0 text-[10px]", matchMeta.className)}>
            {matchMeta.label}
          </Badge>
        }
        meta={`${group.similarity}% match · ${members.length} asset${members.length === 1 ? "" : "s"}`}
        actions={
          <EditorSaveActions dirty={dirty} saving={saving} onSave={save} onDiscard={discard}>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={handleIgnore}
              disabled={busy || group.status === "ignored"}
            >
              <EyeOff className="h-4 w-4" />
              Ignore
            </Button>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={handleResolve}
              disabled={busy || group.status === "resolved"}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Resolve
            </Button>
          </EditorSaveActions>
        }
        nav={NAV_GROUPS}
        subject={group}
        active={guard.active}
        onActiveChange={guard.selectSection}
      >
        {({ active }) => (
          <>
            {active === "members" ? (
              <>
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
                          onMakeKeeper={handleMakeKeeper}
                        />
                      ))}
                    </div>
                  )}
                </SectionCard>
              </>
            ) : null}

            {active === "resolution" ? (
              <>
                <SectionCard title="Resolution">
                  <div className="grid gap-4">
                    <Field label="Recommended action" hint="What should happen to this group.">
                      <Textarea
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        placeholder="e.g. Keep the highest-resolution copy and delete the rest…"
                        className="min-h-24 border-border bg-surface-card text-foreground"
                      />
                    </Field>
                    <Field label="Status" className="sm:max-w-xs">
                      <Select value={status} onValueChange={setStatus}>
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
                </SectionCard>
              </>
            ) : null}

            {active === "details" ? (
              <>
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
              </>
            ) : null}
          </>
        )}
      </EditorShell>

      {guard.dialog}
    </>
  );
}

export default DuplicateGroupDetailScreen;
