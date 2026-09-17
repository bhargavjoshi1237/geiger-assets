"use client";

import React, { useEffect, useMemo, useState } from "react";
import { KeyRound } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, LogoLoading } from "@geiger/ui";

import { Cell, Pie, PieChart } from "recharts";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import { listAssets } from "@/lib/supabase/assets";
import { listLicenses } from "@/lib/supabase/analytics";
import {
  CHART_SERIES,
  LICENSE_STATUS_FILTER_OPTIONS,
  LICENSE_STATUS_MAP,
  RANGE_OPTIONS,
  formatCount,
  formatDate,
  formatMoney,
  formatPercent,
  inRange,
  nowMs,
  rangeDays,
} from "./constants";

// License Analytics — rights granted to licensees and the revenue behind them.
//
// Every number derives from asset_licenses rows (status, term, territory,
// amount, renewal lineage). Renewal rate means renewed licenses over expired
// ones — both recorded rows, never a modeled estimate. An empty ledger renders
// the empty state.

const EXPIRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function LicenseAnalyticsScreen({ projectId }) {
  const [licenses, setLicenses] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([listLicenses(projectId), listAssets(projectId)]).then(([licenseRows, assetRows]) => {
      if (!alive) return;
      setLicenses(licenseRows ?? []);
      setAssets(assetRows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const assetById = useMemo(() => {
    const map = new Map();
    for (const asset of assets) map.set(asset.id, asset);
    return map;
  }, [assets]);

  const rangeLicenses = useMemo(
    () => licenses.filter((license) => inRange(license.createdAt, range)),
    [licenses, range],
  );

  const upcoming = useMemo(() => {
    const now = nowMs();
    return licenses
      .filter((license) => license.status === "active" && license.expiresAt)
      .map((license) => ({ license, inMs: new Date(license.expiresAt).getTime() - now }))
      .filter((entry) => Number.isFinite(entry.inMs) && entry.inMs >= 0 && entry.inMs <= EXPIRY_WINDOW_MS)
      .sort((a, b) => a.inMs - b.inMs)
      .map((entry) => entry.license);
  }, [licenses]);

  const stats = useMemo(() => {
    const active = licenses.filter((license) => license.status === "active");
    const revenue = active.reduce((sum, license) => sum + license.amountCents, 0);
    const expired = licenses.filter((license) => license.status === "expired").length;
    const renewed = licenses.filter((license) => license.renewedFrom).length;
    return [
      { label: "License revenue", value: formatMoney(revenue), footer: "active licenses" },
      { label: "Active licenses", value: formatCount(active.length), footer: `of ${formatCount(licenses.length)} total` },
      { label: "Expiring ≤ 30d", value: formatCount(upcoming.length), footer: "needs renewal attention" },
      {
        label: "Renewal rate",
        value: formatPercent(expired + renewed ? renewed / (expired + renewed) : NaN),
        footer: `${formatCount(renewed)} renewed`,
      },
    ];
  }, [licenses, upcoming]);

  const territories = useMemo(() => {
    const byTerritory = new Map();
    for (const license of licenses) {
      if (license.status !== "active") continue;
      const key = license.territory.trim() || "Unspecified";
      const entry = byTerritory.get(key) || { name: key, value: 0, revenueCents: 0 };
      entry.value += 1;
      entry.revenueCents += license.amountCents;
      byTerritory.set(key, entry);
    }
    return [...byTerritory.values()].sort((a, b) => b.value - a.value).slice(0, 6);
  }, [licenses]);

  const assetIncome = useMemo(() => {
    const byAsset = new Map();
    for (const license of rangeLicenses) {
      if (!license.assetId || license.status === "revoked") continue;
      const entry = byAsset.get(license.assetId) || {
        assetId: license.assetId,
        licenses: 0,
        revenueCents: 0,
      };
      entry.licenses += 1;
      entry.revenueCents += license.amountCents;
      byAsset.set(license.assetId, entry);
    }
    return [...byAsset.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10);
  }, [rangeLicenses]);

  const filteredLicenses = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rangeLicenses
      .filter((license) => (statusFilter === "all" ? true : license.status === statusFilter))
      .filter((license) => {
        if (!needle) return true;
        const asset = license.assetId ? assetById.get(license.assetId) : null;
        return `${license.licensee} ${license.territory} ${license.kind} ${asset?.name || ""}`
          .toLowerCase()
          .includes(needle);
      });
  }, [rangeLicenses, statusFilter, search, assetById]);

  const filtersActive = statusFilter !== "all" || search.trim() !== "";
  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  const licenseColumns = [
    {
      key: "licensee",
      header: "Licensee",
      render: (license) => {
        const asset = license.assetId ? assetById.get(license.assetId) : null;
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="max-w-[240px] truncate font-medium text-foreground">
              {license.licensee || "Unnamed licensee"}
            </span>
            <span className="truncate text-xs text-text-secondary">
              {asset?.name || "Deleted asset"} · {license.kind}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (license) => <StatusPill status={license.status} map={LICENSE_STATUS_MAP} />,
    },
    {
      key: "expires",
      header: "Expires",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (license) => formatDate(license.expiresAt),
    },
    {
      key: "amount",
      header: "Value",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (license) => formatMoney(license.amountCents, license.currency),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="License Analytics"
        description="License revenue, expirations, renewal rate, and territory mix."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={range} onValueChange={setRange} options={RANGE_OPTIONS} height="h-9" />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={LICENSE_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Filter licenses…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading license analytics" />
        </div>
      ) : licenses.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={KeyRound}
            title="No licenses recorded yet"
            description="Revenue, expirations, renewal rate, and territory mix appear here once the license ledger holds grants."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Upcoming expirations"
              description="Active licenses expiring within 30 days."
            >
              {upcoming.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  Nothing expiring in the next 30 days.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {upcoming.slice(0, 8).map((license) => {
                    const asset = license.assetId ? assetById.get(license.assetId) : null;
                    return (
                      <div key={license.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {license.licensee || "Unnamed licensee"}
                          <span className="font-normal text-text-secondary">
                            {" "}· {asset?.name || "Deleted asset"}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-amber-400">
                          {formatDate(license.expiresAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Territory mix" description="Active licenses by recorded territory.">
              {territories.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  No active licenses to break down by territory.
                </p>
              ) : (
                <ChartContainer
                  config={Object.fromEntries(
                    territories.map((entry, i) => [
                      entry.name,
                      { label: entry.name, color: CHART_SERIES[i % CHART_SERIES.length] },
                    ]),
                  )}
                  className="mx-auto h-[220px] w-full"
                >
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="name" />} />
                    <Pie data={territories} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88}>
                      {territories.map((entry, i) => (
                        <Cell key={entry.name} fill={CHART_SERIES[i % CHART_SERIES.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Asset licensing income"
            description={`Revenue by asset for licenses created in the last ${rangeDays(range)} days.`}
          >
            {assetIncome.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-secondary">
                No licensed assets in the selected window.
              </p>
            ) : (
              <div className="space-y-2.5">
                {assetIncome.map((row) => {
                  const asset = assetById.get(row.assetId);
                  return (
                    <div key={row.assetId} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {asset?.name || `Asset ${String(row.assetId).slice(0, 8)}`}
                      </span>
                      <span className="shrink-0 tabular-nums text-text-secondary">
                        {formatCount(row.licenses)} licenses · {formatMoney(row.revenueCents)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Licenses" description="Grants created in the selected window.">
            <DataTable
              columns={licenseColumns}
              data={filteredLicenses}
              getRowKey={(license) => license.id}
              empty={
                <EmptyState
                  icon={KeyRound}
                  title={filtersActive ? "No licenses match these filters" : "No licenses in this window"}
                  description={
                    filtersActive
                      ? "Try a different status or search term."
                      : "Recorded grants fall outside the selected range."
                  }
                  action={
                    filtersActive ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-xs font-medium text-foreground underline underline-offset-4"
                      >
                        Clear filters
                      </button>
                    ) : null
                  }
                />
              }
            />
          </SectionCard>
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default LicenseAnalyticsScreen;
