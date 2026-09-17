"use client";

import { Button, LogoLoading } from "@geiger/ui";
import React, { useMemo, useState } from "react";
import { ArrowUpDown, HandCoins, SlidersHorizontal } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ListPagination,
  usePagination,
} from "@/components/internal/shared/pagination";
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

const SORT_OPTIONS = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "amount-desc", label: "Largest tip" },
  { value: "amount-asc", label: "Smallest tip" },
];

export function TipsScreen({ projectId }) {
  const [rows, , loading] = useCreatorRows(listTips, projectId);
  const [members] = useCreatorRows(listMembers, projectId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [sortValue, setSortValue] = useState("date-desc");

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((t) => t.note.toLowerCase().includes(q) || (memberById.get(t.memberId)?.fanName ?? "").toLowerCase().includes(q));
    }
    if (statusFilter !== "all") r = r.filter((t) => t.status === statusFilter);
    if (targetFilter !== "all") r = r.filter((t) => t.targetType === targetFilter);
    const [field, direction] = sortValue.split("-");
    r.sort((a, b) => {
      let cmp = 0;
      if (field === "date") cmp = new Date(a.createdAt) - new Date(b.createdAt);
      else if (field === "amount") cmp = a.amountCents - b.amountCents;
      return direction === "desc" ? -cmp : cmp;
    });
    return r;
  }, [rows, search, statusFilter, targetFilter, sortValue, memberById]);

  const pager = usePagination(filtered, {
    resetKey: `${search}|${statusFilter}|${targetFilter}|${sortValue}`,
  });

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
        <div className="flex items-center gap-2">
          <FilterDropdown value={statusFilter} onValueChange={setStatusFilter} options={STATUS_FILTERS} placeholder="Status" icon={SlidersHorizontal} />
          <FilterDropdown value={targetFilter} onValueChange={setTargetFilter} options={TARGET_FILTERS} placeholder="Target" />
          <FilterDropdown value={sortValue} onValueChange={setSortValue} options={SORT_OPTIONS} placeholder="Sort" icon={ArrowUpDown} />
          {hasFilters ? <ClearFiltersButton onClick={() => { setStatusFilter("all"); setTargetFilter("all"); setSearch(""); }} /> : null}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tips..." />
      </Toolbar>
      {topTippers.length > 0 ? <div className="flex justify-end text-xs text-text-tertiary">Top tipper: {memberById.get(topTippers[0][0])?.fanName || "—"} · {formatMoney(topTippers[0][1])}</div> : null}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-subtle text-text-tertiary">
          <LogoLoading size={40} />
        </div>
      ) : (
        <div className="space-y-5">
          <DataTable columns={columns} data={pager.pageItems} getRowKey={(t) => t.id} empty={<div className="rounded-xl border border-border bg-surface-subtle">{rows.length === 0 ? (<EmptyState icon={HandCoins} title="No tips yet" description="Tips from fans will land here with top-fan signals." />) : (<EmptyState icon={HandCoins} title="No matching tips" description="No tips matches the current search and filter." action={<Button variant="ghost" onClick={() => { setStatusFilter("all"); setTargetFilter("all"); setSearch(""); }}>Clear filters</Button>} />)}</div>} />
          <ListPagination {...pager} itemLabel="tips" />
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default TipsScreen;
