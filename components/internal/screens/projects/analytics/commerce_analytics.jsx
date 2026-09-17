"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, LogoLoading } from "@geiger/ui";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import { listOrders } from "@/lib/supabase/analytics";
import {
  CHART_SERIES,
  ORDER_STATUS_FILTER_OPTIONS,
  ORDER_STATUS_MAP,
  RANGE_OPTIONS,
  bucketByDay,
  formatCount,
  formatDate,
  formatMoney,
  formatPercent,
  inRange,
  rangeDays,
} from "./constants";

// Commerce Analytics — revenue, orders, and refunds from the order ledger.
//
// Every number derives from commerce_orders rows (status, gross and refunded
// cents, product detail in metadata). Conversion here means paid orders over
// all orders — there is no storefront-traffic source behind this ledger, so a
// visit-based rate is not estimated. An empty ledger renders the empty state.

function productOf(order) {
  return String(order?.metadata?.product || order?.product || "Unpriced item").trim() || "Unpriced item";
}

export function CommerceAnalyticsScreen({ projectId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    listOrders(projectId).then((rows) => {
      if (!alive) return;
      setOrders(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const rangeOrders = useMemo(
    () => orders.filter((order) => inRange(order.createdAt, range)),
    [orders, range],
  );

  const stats = useMemo(() => {
    const paid = rangeOrders.filter((order) => order.status === "paid");
    const gross = paid.reduce((sum, order) => sum + order.amountCents, 0);
    const refunded = rangeOrders.reduce((sum, order) => sum + order.refundedCents, 0);
    const refundedOrders = rangeOrders.filter((order) => order.status === "refunded").length;
    return [
      { label: "Revenue", value: formatMoney(gross - refunded), footer: `net, last ${rangeDays(range)} days` },
      { label: "Orders", value: formatCount(paid.length), footer: "paid orders" },
      {
        label: "Avg order",
        value: paid.length ? formatMoney(Math.round(gross / paid.length)) : "—",
        footer: "gross per paid order",
      },
      {
        label: "Refunds",
        value: formatCount(refundedOrders),
        footer: `${formatMoney(refunded)} refunded`,
      },
    ];
  }, [rangeOrders, range]);

  const trend = useMemo(() => {
    const days = rangeDays(range);
    const paid = rangeOrders.filter((order) => order.status === "paid");
    const buckets = bucketByDay(paid, days, (order) => order.amountCents / 100);
    return buckets.map((bucket) => ({ date: bucket.date, revenue: Math.round(bucket.value * 100) / 100 }));
  }, [rangeOrders, range]);

  const products = useMemo(() => {
    const byProduct = new Map();
    for (const order of rangeOrders) {
      if (order.status !== "paid") continue;
      const key = productOf(order);
      const entry = byProduct.get(key) || { product: key, units: 0, revenueCents: 0 };
      entry.units += 1;
      entry.revenueCents += order.amountCents;
      byProduct.set(key, entry);
    }
    return [...byProduct.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10);
  }, [rangeOrders]);

  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rangeOrders
      .filter((order) => (statusFilter === "all" ? true : order.status === statusFilter))
      .filter((order) =>
        needle ? `${productOf(order)} ${order.currency}`.toLowerCase().includes(needle) : true,
      );
  }, [rangeOrders, statusFilter, search]);

  const refunds = useMemo(
    () => rangeOrders.filter((order) => order.status === "refunded" || order.refundedCents > 0),
    [rangeOrders],
  );

  const filtersActive = statusFilter !== "all" || search.trim() !== "";
  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
  };

  const orderColumns = [
    {
      key: "product",
      header: "Product",
      render: (order) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">{productOf(order)}</span>
          <span className="truncate text-xs text-text-secondary">{formatDate(order.createdAt)}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (order) => <StatusPill status={order.status} map={ORDER_STATUS_MAP} />,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "text-right tabular-nums text-xs",
      render: (order) => formatMoney(order.amountCents, order.currency),
    },
    {
      key: "refunded",
      header: "Refunded",
      align: "right",
      className: "hidden text-right tabular-nums text-xs md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (order) => (
        <span className={order.refundedCents > 0 ? "text-red-400" : "text-text-tertiary"}>
          {order.refundedCents > 0 ? formatMoney(order.refundedCents, order.currency) : "—"}
        </span>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Commerce Analytics"
        description="Revenue, orders, average order value, and refunds."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown value={range} onValueChange={setRange} options={RANGE_OPTIONS} height="h-9" />
          <FilterDropdown
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={ORDER_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Filter orders…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading commerce analytics" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={ShoppingBag}
            title="No orders recorded yet"
            description="Revenue, product performance, and refunds appear here once the commerce ledger holds orders."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <SectionCard
            title="Revenue over time"
            description={`Paid revenue per day for the last ${rangeDays(range)} days, in dollars.`}
          >
            <ChartContainer
              config={{ revenue: { label: "Revenue", color: CHART_SERIES[1] } }}
              className="h-[240px] w-full"
            >
              <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} className="stroke-border/50" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => formatDate(value).replace(/, \d{4}$/, "")}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(value) => `$${formatCount(value)}`}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent formatter={(value) => `$${Number(value).toFixed(2)}`} />}
                />
                <Bar dataKey="revenue" fill={CHART_SERIES[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Product performance" description="Paid revenue by product in the selected window.">
              {products.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">
                  No paid orders in this window.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {products.map((row) => (
                    <div key={row.product} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-foreground">{row.product}</span>
                      <span className="shrink-0 tabular-nums text-text-secondary">
                        {formatCount(row.units)} × {formatMoney(Math.round(row.revenueCents / Math.max(row.units, 1)))} ·{" "}
                        {formatMoney(row.revenueCents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Refunds"
              description={`${formatCount(refunds.length)} refunded in the selected window · ${formatPercent(rangeOrders.length ? refunds.length / rangeOrders.length : NaN)} of orders.`}
            >
              {refunds.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-secondary">No refunds in this window.</p>
              ) : (
                <div className="space-y-2.5">
                  {refunds.slice(0, 8).map((order) => (
                    <div key={order.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-foreground">{productOf(order)}</span>
                      <span className="shrink-0 tabular-nums text-red-400">
                        {formatMoney(order.refundedCents || order.amountCents, order.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Orders" description="Every order in the selected window.">
            <DataTable
              columns={orderColumns}
              data={filteredOrders}
              getRowKey={(order) => order.id}
              empty={
                <EmptyState
                  icon={ShoppingBag}
                  title={filtersActive ? "No orders match these filters" : "No orders in this window"}
                  description={
                    filtersActive
                      ? "Try a different status or search term."
                      : "Recorded orders fall outside the selected range."
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

export default CommerceAnalyticsScreen;
