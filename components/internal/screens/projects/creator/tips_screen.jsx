"use client";

import React, { useMemo, useState } from "react";
import { HandCoins, Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader, StatsBar, SearchInput, StatusPill, EmptyState, DataTable, Toolbar,
} from "@/components/internal/shared/screen_kit";
import { TIP_STATUS_META, statusFilterOptions, formatMoney, formatDate } from "./constants";
import { FilterDropdown, ClearFiltersButton, useCreatorRows } from "./creator_kit";
import { listTips, listMembers } from "@/lib/supabase/creator";

const STATUS_FILTERS = statusFilterOptions(TIP_STATUS_META, "All statuses");
const TARGET_FILTERS = [
  { value: "all", label: "All targets" },
  { value: "profile", label: "Profile" },
  { value: "post", label: "Posts" },
  { value: "message", label: "Messages" },
  { value: "stream", label: "Streams" },
];

export function TipsScreen({ projectId }) {
  const [rows, , loading] = useCreatorRows(listTips, projectId);
  const [members] = useCreatorRows(listMembers, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) => t.note.toLowerCase().includes(q) || (memberById.get(t.memberId)?.fanName ?? "").toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((t) => t.status === statusFilter);
    if (targetFilter !== "all") r = r.filter((t) => t.targetType === targetFilter);
    return r;
  }, [rows, search, statusFilter, targetFilter, memberById]);

  const stats = useMemo(() => {
    const ok = rows.filter((t) => t.status === "succeeded");
    const revenue = ok.reduce((s, t) => s + t.amountCents, 0);
    const avg = ok.length ? Math.round(revenue / ok.length) : 0;
    return [
      { label: "Tip revenue", value: formatMoney(revenue), footer: `${ok.length} succeeded tips` },
      { label: "Avg tip", value: formatMoney(avg), footer: "per tip" },
      { label: "Pending", value: String(rows.filter((t) => t.status === "pending").length), footer: "awaiting capture" },
      { label: "Refunded", value: String(rows.filter((t) => t.status === "refunded").length), footer: "returned to fans" },
    ];
  }, [rows]);

  const topTippers = useMemo(() => {
    const byMember = new Map();
    for (const t of rows.filter((t) => t.status === "succeeded")) {
      byMember.set(t.memberId, (byMember.get(t.memberId) ?? 0) + t.amountCents);
    }
    return [...byMember.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1);
  }, [rows]);

  const columns = [
    { key: "member", header: "Tipper", render: (t) => (<div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{memberById.get(t.memberId)?.fanName || "—"}</p><p className="truncate text-[11px] text-text-tertiary">{t.note || "no note"}</p></div>) },
    { key: "target", header: "Target", className: "text-xs capitalize", render: (t) => t.targetType },
    { key: "amount", header: "Amount", align: "right", className: "tabular-nums text-xs", render: (t) => formatMoney(t.amountCents, t.currency) },
    { key: "status", header: "Status", render: (t) => <StatusPill status={t.status} map={TIP_STATUS_META} className="text-[10px]" /> },
    { key: "date", header: "Date", className: "hidden text-xs text-text-secondary lg:table-cell", headClassName: "hidden lg:table-cell", render: (t) => formatDate(t.createdAt) },
  ];

  const hasFilters = statusFilter !== "all" || targetFilter !== "all" || Boolean(search);

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader title="Tips" description="Gratitude revenue — tips on posts, messages, streams, and profiles with top-fan signals." />
      <StatsBar stats={stats} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search tips..." className="w-full sm:w-64" />
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={targetFilter} onValueChange={setTargetFilter} options={TARGET_FILTERS} placeholder="Target" />
          {hasFilters ? <ClearFiltersButton onClick={() => { setStatusFilter("all"); setTargetFilter("all"); setSearch(""); }} /> : null}
        </div>
        {topTippers.length > 0 ? <div className="text-xs text-text-tertiary">Top tipper: {memberById.get(topTippers[0][0])?.fanName || "—"} · {formatMoney(topTippers[0][1])}</div> : null}
      </Toolbar>
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <DataTable columns={columns} data={filtered} getRowKey={(t) => t.id} empty={<EmptyState icon={HandCoins} title="No tips yet" description={hasFilters ? "Try adjusting your filters." : "Tips from fans will land here with top-fan signals."} />} />
      )}
      {!loading && filtered.length > 0 ? <div className="text-xs text-text-secondary">Showing {filtered.length} of {rows.length} tips · tips are read-only (created at checkout)</div> : null}
    </MainScreenWrapper>
  );
}

export default TipsScreen;
