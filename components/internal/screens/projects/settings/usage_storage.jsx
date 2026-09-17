"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Database, HardDrive, Loader2, RefreshCw } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SectionCard,
  StatsBar,
} from "@/components/internal/shared/screen_kit";
import { getDailySeries, getProjectUsage, recomputeProjectUsage } from "@/lib/media/usage";
import { listStorageBackends } from "@/lib/storage/backends_client";
import { listAssets } from "@/lib/supabase/assets";
import { useProjectSettings } from "./use_project_settings";
import { formatBytes, formatCount, formatDate, quotaPercent } from "./constants";

// Usage & Storage — storage consumed, bandwidth, asset counts, quota bars, and
// a per-backend breakdown.
//
// Every number comes from lib/media/usage.js and nothing else: the rollup row
// (storedBytes, storedObjects, servedBytesTotal, servedEventsTotal) is the
// cheap dashboard read, the daily series buckets delivery_events in JS, and
// quotas persist as settings.maxStoredBytes / maxServedBytes through
// lib/supabase/settings.js. The per-backend breakdown groups live asset rows
// by their recorded backend — byte totals there cover live rows only, while
// the rollup above stays authoritative.

const GB = 1024 * 1024 * 1024;

function QuotaBar({ used, cap, format }) {
  const percent = quotaPercent(used, cap);
  const unlimited = !(Number(cap) > 0);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-text-secondary">
          {format(used)}
          {unlimited ? "" : ` of ${format(cap)}`}
        </span>
        <span className={percent >= 90 && !unlimited ? "text-red-400" : "text-text-tertiary"}>
          {unlimited ? "no quota" : `${percent}%`}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-strong">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: unlimited ? "0%" : `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function UsageStorageScreen({ projectId }) {
  const { settings, loading: settingsLoading, save } = useProjectSettings(projectId);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [series, setSeries] = useState([]);
  const [backends, setBackends] = useState([]);
  const [assets, setAssets] = useState([]);
  const [recomputing, setRecomputing] = useState(false);
  const [quotaDraft, setQuotaDraft] = useState({ storedGb: "", servedGb: "" });
  const [quotasFor, setQuotasFor] = useState(null);
  const [savingQuotas, setSavingQuotas] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getProjectUsage(projectId),
      getDailySeries(projectId, { days: 30 }),
      listStorageBackends(projectId),
      listAssets(projectId),
    ]).then(([usageRow, daily, backendRows, assetRows]) => {
      if (!alive) return;
      setUsage(usageRow);
      setSeries(daily ?? []);
      setBackends(backendRows ?? []);
      setAssets(assetRows ?? []);
      setUsageLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Seed the quota form from the fetched row once per project (render-phase
  // adjustment, not an effect — it runs only until quotasFor catches up).
  if (!settingsLoading && quotasFor !== projectId) {
    setQuotasFor(projectId);
    setQuotaDraft({
      storedGb: settings.maxStoredBytes > 0 ? String(settings.maxStoredBytes / GB) : "",
      servedGb: settings.maxServedBytes > 0 ? String(settings.maxServedBytes / GB) : "",
    });
  }
  const quotasSeeded = !settingsLoading && quotasFor === projectId;

  const stats = useMemo(
    () => [
      {
        label: "Stored",
        value: formatBytes(usage?.storedBytes ?? 0),
        footer: `${formatCount(usage?.storedObjects ?? 0)} objects`,
      },
      {
        label: "Served (lifetime)",
        value: formatBytes(usage?.servedBytesTotal ?? 0),
        footer: `${formatCount(usage?.servedEventsTotal ?? 0)} deliveries`,
      },
      {
        label: "Assets",
        value: formatCount(assets.length),
        footer: "live rows in this project",
      },
      {
        label: "Backends",
        value: String(backends.length),
        footer: backends.length ? "holding bytes" : "env default only",
      },
    ],
    [usage, assets, backends],
  );

  const windowTotals = useMemo(
    () => ({
      bytes: series.reduce((sum, d) => sum + (Number(d.bytesServed) || 0), 0),
      deliveries: series.reduce((sum, d) => sum + (Number(d.deliveries) || 0), 0),
    }),
    [series],
  );

  const maxDayBytes = useMemo(
    () => series.reduce((max, d) => Math.max(max, Number(d.bytesServed) || 0), 0),
    [series],
  );

  // Live rows grouped by their recorded backend. Null means the env-configured
  // default (every row written before pooling carries null), so it gets a row
  // of its own rather than disappearing.
  const breakdown = useMemo(() => {
    const byBackend = new Map();
    for (const asset of assets) {
      const key = asset.storageBackend ?? "env";
      const entry = byBackend.get(key) || { key, count: 0, bytes: 0 };
      entry.count += 1;
      entry.bytes += Number(asset.sizeBytes) || 0;
      byBackend.set(key, entry);
    }
    const labels = new Map(backends.map((b) => [b.id, b]));
    return [...byBackend.values()].map((entry) => {
      const backend = entry.key === "env" ? null : labels.get(entry.key);
      return {
        ...entry,
        label: backend?.label || (entry.key === "env" ? "Env default" : "Unknown backend"),
        kind: backend?.kind || "",
        missing: entry.key !== "env" && !backend,
      };
    });
  }, [assets, backends]);

  const refresh = async () => {
    setRecomputing(true);
    const recomputed = await recomputeProjectUsage(projectId);
    if (!recomputed) {
      toast.error("Couldn't recompute usage.");
    } else {
      setUsage(recomputed);
      toast.success("Usage recomputed from live rows.");
    }
    setRecomputing(false);
  };

  const saveQuotas = async () => {
    const storedGb = quotaDraft.storedGb === "" ? 0 : Number(quotaDraft.storedGb);
    const servedGb = quotaDraft.servedGb === "" ? 0 : Number(quotaDraft.servedGb);
    if (
      (quotaDraft.storedGb !== "" && (!Number.isFinite(storedGb) || storedGb < 0)) ||
      (quotaDraft.servedGb !== "" && (!Number.isFinite(servedGb) || servedGb < 0))
    ) {
      toast.error("Quotas must be a positive number of GB, or blank for unlimited.");
      return;
    }
    setSavingQuotas(true);
    const saved = await save(
      {
        maxStoredBytes: Math.round(storedGb * GB),
        maxServedBytes: Math.round(servedGb * GB),
      },
      { success: "Quotas saved.", error: "Couldn't save quotas." },
    );
    setSavingQuotas(false);
    if (saved) {
      setQuotaDraft({
        storedGb: saved.maxStoredBytes > 0 ? String(saved.maxStoredBytes / GB) : "",
        servedGb: saved.maxServedBytes > 0 ? String(saved.maxServedBytes / GB) : "",
      });
    }
  };

  const quotasDirty =
    quotasSeeded &&
    (quotaDraft.storedGb !== (settings.maxStoredBytes > 0 ? String(settings.maxStoredBytes / GB) : "") ||
      quotaDraft.servedGb !== (settings.maxServedBytes > 0 ? String(settings.maxServedBytes / GB) : ""));

  const loading = usageLoading || settingsLoading || !quotasSeeded;

  const columns = [
    {
      key: "label",
      header: "Backend",
      render: (row) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{row.label}</span>
            {row.key === "env" ? <Badge variant="info">Suite default</Badge> : null}
            {row.missing ? <Badge variant="warning">Unresolved</Badge> : null}
          </span>
          {row.kind ? (
            <span className="text-xs text-text-secondary">{row.kind}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "count",
      header: "Assets",
      align: "right",
      className: "text-right tabular-nums",
      render: (row) => formatCount(row.count),
    },
    {
      key: "bytes",
      header: "Bytes",
      align: "right",
      className: "text-right tabular-nums",
      render: (row) => formatBytes(row.bytes),
    },
  ];

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Usage & Storage"
        description={
          usage?.lastRecomputedAt
            ? `Storage rollup recomputed ${formatDate(usage.lastRecomputedAt)}. Served totals are lifetime.`
            : "Storage rollup and lifetime bandwidth for this project."
        }
        actions={
          <Button
            variant="outline"
            className="border-border bg-surface-card text-foreground hover:bg-surface-active"
            onClick={refresh}
            disabled={recomputing || loading}
          >
            {recomputing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Recompute
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading usage and storage" />
        </div>
      ) : (
        <>
          <StatsBar stats={stats} />

          <SectionCard
            title="Quotas"
            description="Blank means unlimited. Bars compare the live rollup against these caps."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={saveQuotas}
                disabled={savingQuotas || !quotasDirty}
              >
                {savingQuotas ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save quotas"
                )}
              </Button>
            }
          >
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Max stored (GB)" htmlFor="usage-quota-stored" hint="Live stored bytes against this cap.">
                  <Input
                    id="usage-quota-stored"
                    className="bg-surface-card"
                    inputMode="decimal"
                    value={quotaDraft.storedGb}
                    onChange={(e) =>
                      setQuotaDraft((d) => ({ ...d, storedGb: e.target.value.replace(/[^\d.]/g, "") }))
                    }
                    placeholder="Unlimited"
                  />
                </Field>
                <Field label="Max served, lifetime (GB)" htmlFor="usage-quota-served" hint="Lifetime served bytes against this cap.">
                  <Input
                    id="usage-quota-served"
                    className="bg-surface-card"
                    inputMode="decimal"
                    value={quotaDraft.servedGb}
                    onChange={(e) =>
                      setQuotaDraft((d) => ({ ...d, servedGb: e.target.value.replace(/[^\d.]/g, "") }))
                    }
                    placeholder="Unlimited"
                  />
                </Field>
              </div>
              <QuotaBar
                used={usage?.storedBytes ?? 0}
                cap={settings.maxStoredBytes}
                format={formatBytes}
              />
              <QuotaBar
                used={usage?.servedBytesTotal ?? 0}
                cap={settings.maxServedBytes}
                format={formatBytes}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Last 30 days"
            description={`${formatBytes(windowTotals.bytes)} served · ${formatCount(windowTotals.deliveries)} deliveries in window.`}
          >
            {series.length === 0 ? (
              <EmptyState
                icon={Database}
                title="No deliveries recorded"
                description="Per-day bandwidth appears here once assets start serving."
              />
            ) : (
              <div
                className="flex h-28 items-end gap-1"
                role="img"
                aria-label={`Bandwidth per day for the last 30 days, ${formatBytes(windowTotals.bytes)} total`}
              >
                {series.map((day) => {
                  const height = maxDayBytes > 0 ? Math.max(3, Math.round(((Number(day.bytesServed) || 0) / maxDayBytes) * 100)) : 3;
                  return (
                    <div
                      key={day.date}
                      title={`${day.date}: ${formatBytes(day.bytesServed)} · ${formatCount(day.deliveries)} deliveries`}
                      className="min-w-0 flex-1 rounded-sm bg-primary/70 hover:bg-primary"
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Per-backend breakdown"
            description="Live asset rows grouped by their recorded backend."
          >
            <DataTable
              columns={columns}
              data={breakdown}
              getRowKey={(row) => row.key}
              empty={
                <div className="rounded-xl border border-border bg-surface-subtle">
                  <EmptyState
                    icon={HardDrive}
                    title="No assets stored yet"
                    description="Upload an asset and its bytes show up here under a backend."
                  />
                </div>
              }
            />
          </SectionCard>
        </>
      )}
    </SecondaryScreenWrapper>
  );
}

export default UsageStorageScreen;
