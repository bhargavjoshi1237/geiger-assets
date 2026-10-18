"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart3 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { DataTable, EmptyState, LoadingArea, ScreenHeader, SectionCard, StatsBar } from "@/components/internal/shared/screen_kit";
import { listAssets } from "@/lib/supabase/assets";
import { listDeliveryDaily, listDeliveryEvents } from "@/lib/supabase/delivery";
import { listGalleryEvents } from "@/lib/supabase/gallery_audience";
import { listGalleries } from "@/lib/supabase/galleries";
import { listGroups } from "@/lib/supabase/duplicates";
import { listRightsRecords } from "@/lib/supabase/rights";
import { listOrders, listOrderItems, listProducts } from "@/lib/supabase/store";
import { listLicenses, listLicenseItems } from "@/lib/supabase/licensing";
import { listSearchEvents, listReports, listReportRuns } from "@/lib/supabase/analytics";
import { ANALYTICS_SCREENS, buildAnalytics } from "./models";
import { DEFAULT_RANGE, formatDateTime } from "./constants";
import { ChartGrid, ExportButton, RangeToolbar } from "./analytics_kit";
import { AnalyticsChart, chartHasValues, chartRows } from "./analytics_chart";

const StorageTreemap = dynamic(() => import("./storage_treemap").then((module) => module.StorageTreemap), { ssr: false, loading: () => <LoadingArea panel size={40} label="Loading storage map…" /> });

const SOURCES = {
  assets: listAssets,
  daily: listDeliveryDaily,
  deliveryEvents: listDeliveryEvents,
  galleryEvents: listGalleryEvents,
  galleries: listGalleries,
  duplicates: listGroups,
  rights: listRightsRecords,
  orders: listOrders,
  orderItems: listOrderItems,
  products: listProducts,
  licenses: listLicenses,
  licenseItems: listLicenseItems,
  search: listSearchEvents,
  reports: listReports,
  reportRuns: listReportRuns,
};

function AnalyticsScreen({ title, projectId }) {
  const config = ANALYTICS_SCREENS[title];
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [state, setState] = useState({ projectId: null, data: {} });
  const chartRef = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.all(config.sources.map((source) => SOURCES[source](projectId)))
      .then((results) => {
        if (!active) return;
        setState({ projectId, data: Object.fromEntries(config.sources.map((source, index) => [source, results[index] || []])) });
      })
      .catch((error) => {
        console.error("[analytics.load]", error);
        if (active) setState({ projectId, data: {} });
      });
    return () => { active = false; };
  }, [config, projectId]);

  const loading = state.projectId !== projectId;
  const model = useMemo(() => buildAnalytics(title, loading ? {} : state.data, range), [title, state.data, range, loading]);
  const exportRows = useMemo(() => model.charts.flatMap((chart) => chartRows(chart).map((row) => ({ chart: chart.title, ...row }))), [model]);
  const exportChartIndex = model.charts.findIndex(chartHasValues);

  return (
    <MainScreenWrapper>
      <ScreenHeader title={title} description={config.description} />
      <StatsBar stats={model.stats} />
      <RangeToolbar range={range} onRange={setRange}>
        <ExportButton rows={model.hasData ? exportRows : []} filename={title.toLowerCase().replace(/[^a-z0-9]+/g, "-")} chartRef={chartRef} />
      </RangeToolbar>
      {loading ? (
        <LoadingArea panel size={56} label="Loading analytics…" />
      ) : !model.hasData ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={BarChart3} title="No analytics yet" description={config.empty} />
        </div>
      ) : (
        <div className="space-y-4">
          <ChartGrid>
            {model.charts.map((chart, index) => <AnalyticsChart key={chart.title} chart={chart} chartRef={index === exportChartIndex ? chartRef : undefined} />)}
          </ChartGrid>
          {title === "Storage & Usage" && (state.data.assets || []).some((asset) => Number(asset.sizeBytes) > 0) ? <StorageTreemap assets={state.data.assets} /> : null}
          {title === "Reports & Exports" ? (
            <SectionCard title="Saved reports" description="Source, cadence, status, and latest run for each report.">
              <DataTable
                data={state.data.reports || []}
                getRowKey={(report) => report.id}
                columns={[
                  { key: "name", header: "Report", render: (report) => <span className="font-medium text-foreground">{report.name || "Untitled report"}</span> },
                  { key: "source", header: "Source", render: (report) => <span className="capitalize">{report.source}</span> },
                  { key: "schedule", header: "Schedule", render: (report) => <span className="capitalize">{report.schedule}</span> },
                  { key: "status", header: "Status", render: (report) => <span className="capitalize">{report.status}</span> },
                  { key: "lastRunAt", header: "Last run", render: (report) => report.lastRunAt ? formatDateTime(report.lastRunAt) : "—" },
                ]}
              />
            </SectionCard>
          ) : null}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export const AssetAnalyticsScreen = (props) => <AnalyticsScreen {...props} title="Asset Analytics" />;
export const SearchAnalyticsScreen = (props) => <AnalyticsScreen {...props} title="Search Analytics" />;
export const PortalAnalyticsScreen = (props) => <AnalyticsScreen {...props} title="Portal Analytics" />;
export const LibraryHealthScreen = (props) => <AnalyticsScreen {...props} title="Library Health" />;
export const StorageUsageAnalyticsScreen = (props) => <AnalyticsScreen {...props} title="Storage & Usage" />;
export const CommerceAnalyticsScreen = (props) => <AnalyticsScreen {...props} title="Commerce Analytics" />;
export const LicenseAnalyticsScreen = (props) => <AnalyticsScreen {...props} title="License Analytics" />;
export const ReportsExportsScreen = (props) => <AnalyticsScreen {...props} title="Reports & Exports" />;
