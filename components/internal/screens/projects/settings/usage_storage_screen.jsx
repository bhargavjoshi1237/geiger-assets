"use client";

// Usage & Storage — resource consumption, limits and retention. Charts derive
// client-side from listAssets + listDeliveryDaily + listDeliveryEvents (there
// is no analytics rollup table); limits are promoted project_settings columns
// (via patchColumns) and allowed file types is the metadata.usage bag (via
// patchSection). Charts are read-only decoration; everything else persists.

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { HardDrive } from "lucide-react";

import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SectionCard,
  StatsBar,
} from "@/components/internal/shared/screen_kit";
import {
  areaOption,
  donutOption,
  horizontalBarOption,
  useChartTheme,
} from "@/components/internal/shared/chart_kit";
import {
  useModuleRows,
} from "@/components/internal/shared/module_kit";
import { cn } from "@/lib/utils";
import { listAssets } from "@/lib/supabase/assets";
import { listDeliveryDaily, listDeliveryEvents } from "@/lib/supabase/delivery";
import { formatBytes, FILE_TYPE_OPTIONS } from "./constants";
import {
  NumberSettingRow,
  useProjectSettings,
} from "./settings_kit";

const ChartCard = dynamic(
  () =>
    import("@/components/internal/shared/chart_kit").then((m) => m.ChartCard),
  { ssr: false, loading: () => <LoadingArea size={40} /> },
);

const EChart = dynamic(
  () =>
    import("@/components/internal/shared/chart_kit").then((m) => m.EChart),
  { ssr: false, loading: () => <LoadingArea size={40} /> },
);

const GB = 1024 ** 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(value) {
  return String(value || "").slice(0, 10);
}

function lastDays(n) {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    out.push({ key: dayKey(d.toISOString()), label, time: d.getTime() });
  }
  return out;
}

export function UsageStorageScreen({ projectId }) {
  const { settings, loading: settingsLoading, patchColumns, patchSection } =
    useProjectSettings(projectId);
  const [assets, , assetsLoading] = useModuleRows(listAssets, projectId);
  const [daily, , dailyLoading] = useModuleRows(listDeliveryDaily, projectId);
  const [events, , eventsLoading] = useModuleRows(
    listDeliveryEvents,
    projectId,
  );
  const theme = useChartTheme();
  // Frozen at mount so derived windows don't shift mid-render.
  const [now] = useState(() => Date.now());

  const loading =
    settingsLoading || assetsLoading || dailyLoading || eventsLoading;

  const usage = useMemo(() => {
    const rows = assets ?? [];
    const storageBytes = rows.reduce(
      (sum, a) => sum + (Number(a.sizeBytes) || 0),
      0,
    );
    const cutoff = now - 30 * DAY_MS;
    const added30d = rows
      .filter((a) => new Date(a.createdAt).getTime() >= cutoff)
      .reduce((sum, a) => sum + (Number(a.sizeBytes) || 0), 0);

    const byTypeMap = new Map();
    for (const a of rows) {
      const type = a.type || "other";
      const entry = byTypeMap.get(type) || { bytes: 0, count: 0 };
      entry.bytes += Number(a.sizeBytes) || 0;
      entry.count += 1;
      byTypeMap.set(type, entry);
    }
    const byType = [...byTypeMap.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.bytes - a.bytes);

    const folderMap = new Map();
    for (const a of rows) {
      const folder = a.folder || "root";
      const entry = folderMap.get(folder) || { bytes: 0, count: 0 };
      entry.bytes += Number(a.sizeBytes) || 0;
      entry.count += 1;
      folderMap.set(folder, entry);
    }
    const folders = [...folderMap.entries()]
      .map(([folder, v]) => ({ folder, ...v }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);

    const days = lastDays(30);
    const growth = days.map(({ key, label, time }) => {
      const bytes = rows
        .filter((a) => new Date(a.createdAt).getTime() < time + DAY_MS)
        .reduce((sum, a) => sum + (Number(a.sizeBytes) || 0), 0);
      return {
        day: label,
        key,
        gb: Math.round((bytes / GB) * 100) / 100,
      };
    });

    const rollup = (daily ?? []).filter((d) => !d.assetId);
    const source = rollup.length ? rollup : (daily ?? []);
    const bandwidth30d = source
      .filter((d) => new Date(d.day).getTime() >= cutoff)
      .reduce((sum, d) => sum + (Number(d.bytes) || 0), 0);

    const transforms = (events ?? []).filter(
      (e) => e.transform && Object.keys(e.transform).length > 0,
    ).length;

    return {
      storageBytes,
      added30d,
      byType,
      folders,
      growth,
      bandwidth30d,
      transforms,
    };
  }, [assets, daily, events, now]);

  const quotaBytes = Number(settings.storageQuotaGb || 0) * GB;
  const quotaPct =
    quotaBytes > 0 ? (usage.storageBytes / quotaBytes) * 100 : 0;
  const quotaTone =
    quotaPct >= 100
      ? "bg-red-400"
      : quotaPct >= Number(settings.quotaAlertPercent || 80)
        ? "bg-amber-400"
        : "bg-primary";

  const stats = [
    {
      label: "Storage used",
      value: formatBytes(usage.storageBytes),
      delta:
        usage.added30d > 0 ? `+${formatBytes(usage.added30d)} 30d` : undefined,
      trend: usage.added30d > 0 ? "up" : undefined,
      footer: `of ${Number(settings.storageQuotaGb || 0)} GB quota`,
    },
    {
      label: "Assets",
      value: String((assets ?? []).length),
      footer: `${usage.folders.length} folders tracked`,
    },
    {
      label: "Bandwidth",
      value: formatBytes(usage.bandwidth30d),
      footer: "Last 30 days",
    },
    {
      label: "Transforms",
      value: String(usage.transforms),
      footer: "Across recent serves",
    },
  ];

  const growthOption = useMemo(
    () =>
      areaOption(theme, {
        name: "Stored GB",
        categories: usage.growth.map((g) => g.day),
        data: usage.growth.map((g) => g.gb),
      }),
    [theme, usage.growth],
  );

  const typeSlices = useMemo(() => {
    const top = usage.byType.slice(0, 5);
    const rest = usage.byType.slice(5);
    const slices = top.map((t) => ({ name: t.type, value: t.bytes }));
    if (rest.length) {
      slices.push({
        name: "Other",
        value: rest.reduce((sum, t) => sum + t.bytes, 0),
      });
    }
    return slices;
  }, [usage.byType]);

  const typeOption = useMemo(
    () => donutOption(theme, { data: typeSlices }),
    [theme, typeSlices],
  );

  const folderOption = useMemo(
    () =>
      horizontalBarOption(theme, {
        name: "Bytes",
        categories: usage.folders.map((f) => f.folder),
        data: usage.folders.map((f) => f.bytes),
      }),
    [theme, usage.folders],
  );

  const toggleFileType = (type) => {
    const current = settings.usage?.allowedFileTypes ?? [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    patchSection("usage", { allowedFileTypes: next });
  };

  if (loading) {
    return (
      <SecondaryScreenWrapper>
        <ScreenHeader
          title="Usage & Storage"
          description="Resource consumption, limits, and retention for this project."
        />
        <LoadingArea size={56} label="Loading usage" />
      </SecondaryScreenWrapper>
    );
  }

  const hasContent =
    (assets ?? []).length > 0 || (daily ?? []).length > 0;

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Usage & Storage"
        description="Resource consumption, limits, and retention for this project."
      />

      <StatsBar stats={stats} />

      {hasContent ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Storage growth"
            description="Cumulative stored GB · last 30 days"
            table={{
              columns: [
                { key: "day", header: "Day" },
                { key: "gb", header: "Stored GB", align: "right" },
              ],
              rows: usage.growth,
              getRowKey: (g) => g.key,
            }}
          >
            <EChart option={growthOption} height={260} />
          </ChartCard>
          <ChartCard
            title="By file type"
            description="Stored bytes by asset type"
            table={{
              columns: [
                { key: "type", header: "Type" },
                { key: "count", header: "Assets", align: "right" },
                {
                  key: "bytes",
                  header: "Bytes",
                  align: "right",
                  render: (t) => formatBytes(t.bytes),
                },
              ],
              rows: usage.byType,
              getRowKey: (t) => t.type,
            }}
          >
            <EChart option={typeOption} height={260} />
          </ChartCard>
        </div>
      ) : null}

      {hasContent ? (
        <ChartCard
          title="Largest folders"
          description="Top folders by stored bytes"
          table={{
            columns: [
              { key: "folder", header: "Folder" },
              { key: "count", header: "Assets", align: "right" },
              {
                key: "bytes",
                header: "Bytes",
                align: "right",
                render: (f) => formatBytes(f.bytes),
              },
            ],
            rows: usage.folders,
            getRowKey: (f) => f.folder,
          }}
        >
          <EChart option={folderOption} height={260} />
        </ChartCard>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={HardDrive}
            title="No usage yet"
            description="Uploads and delivery serves will chart here."
          />
        </div>
      )}

      <SectionCard title="Quota" description="Storage against the project quota.">
        <div className="flex items-center gap-3">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-active">
            <div
              className={cn("h-full rounded-full", quotaTone)}
              style={{ width: `${Math.min(100, Math.max(0, quotaPct))}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">
            {formatBytes(usage.storageBytes)} /{" "}
            {Number(settings.storageQuotaGb || 0)} GB
          </span>
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          {quotaPct >= 100
            ? "Over quota — uploads may be blocked."
            : `Alerts at ${Number(settings.quotaAlertPercent || 80)}% of quota.`}
        </p>
      </SectionCard>

      <SectionCard
        title="Limits & retention"
        description="Quotas and lifecycle for this project."
      >
        <div className="divide-y divide-border">
          <NumberSettingRow
            title="Storage quota"
            description="Total storage for this project."
            value={settings.storageQuotaGb}
            suffix="GB"
            min={1}
            onSave={(next) => patchColumns({ storageQuotaGb: next })}
          />
          <NumberSettingRow
            title="Max upload size"
            description="Largest single file members can upload."
            value={settings.maxUploadMb}
            suffix="MB"
            min={1}
            onSave={(next) => patchColumns({ maxUploadMb: next })}
          />
          <NumberSettingRow
            title="Auto-archive after"
            description="0 keeps archiving off."
            value={settings.autoArchiveDays}
            suffix="days"
            min={0}
            onSave={(next) => patchColumns({ autoArchiveDays: next })}
          />
          <NumberSettingRow
            title="Trash retention"
            description="Days before trashed assets are permanently deleted."
            value={settings.trashRetentionDays}
            suffix="days"
            min={1}
            onSave={(next) => patchColumns({ trashRetentionDays: next })}
          />
          <NumberSettingRow
            title="Quota alert threshold"
            description="Warn when usage passes this share of quota."
            value={settings.quotaAlertPercent}
            suffix="%"
            min={1}
            max={100}
            onSave={(next) => patchColumns({ quotaAlertPercent: next })}
          />
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-foreground">
            Allowed file types
          </p>
          <p className="text-xs text-text-secondary">
            Uploads outside this list are rejected.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              settings.usage?.allowedFileTypes ?? []
            ).length === 0 ? (
              <span className="text-xs text-text-tertiary">
                All types blocked — enable at least one.
              </span>
            ) : null}
            {(() => {
              const enabled = new Set(settings.usage?.allowedFileTypes ?? []);
              return FILE_TYPE_OPTIONS.map((o) => {
                const on = enabled.has(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleFileType(o.value)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors",
                      on
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border bg-surface-card text-text-secondary hover:bg-surface-hover",
                    )}
                  >
                    {o.value}
                  </button>
                );
              });
            })()}
          </div>
        </div>
      </SectionCard>
    </SecondaryScreenWrapper>
  );
}

export default UsageStorageScreen;
