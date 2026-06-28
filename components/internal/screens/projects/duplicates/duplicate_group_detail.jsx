"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Save,
  CheckCircle2,
  EyeOff,
  Crown,
  Check,
  CopyCheck,
  File,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
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
      <MainScreenWrapper className="dark">
        <div className="flex h-64 items-center justify-center text-text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </MainScreenWrapper>
    );
  }

  if (!group) {
    return (
      <MainScreenWrapper className="dark">
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
      </MainScreenWrapper>
    );
  }

  const matchMeta = MATCH_META[group.matchType] || MATCH_META.exact;

  return (
    <MainScreenWrapper className="dark">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to duplicate review"
            className="h-8 w-8 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
              matchMeta.className,
            )}
          >
            <CopyCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              Duplicate group
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge className={cn("border px-1.5 py-0 text-[10px]", matchMeta.className)}>
                {matchMeta.label}
              </Badge>
              <StatusPill status={group.status} map={STATUS_META} className="text-[10px]" />
              <span className="text-xs text-text-secondary">{group.similarity}% match</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
            className="h-9 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
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
        </div>
      </div>

      <Tabs defaultValue="members" className="gap-4">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="resolution">Resolution</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Members */}
        <TabsContent value="members">
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
        </TabsContent>

        {/* Resolution */}
        <TabsContent value="resolution">
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
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
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
                <Button
                  variant="outline"
                  className="h-9 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={handleResolve}
                  disabled={busy || group.status === "resolved"}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Resolve
                </Button>
                <Button
                  variant="outline"
                  className="h-9 border-border bg-transparent text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={handleIgnore}
                  disabled={busy || group.status === "ignored"}
                >
                  <EyeOff className="mr-1.5 h-4 w-4" />
                  Ignore
                </Button>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* Details */}
        <TabsContent value="details">
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
        </TabsContent>
      </Tabs>
    </MainScreenWrapper>
  );
}

export default DuplicateGroupDetailScreen;
