"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import * as echarts from "echarts/core";
import { TreemapChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

import { ChartCard } from "@/components/internal/shared/chart_card";
import { formatBytes } from "./constants";

echarts.use([TreemapChart, TooltipComponent, CanvasRenderer]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

// Tokens may be oklch (light theme); paint one pixel to get a hex ECharts can parse and blend.
function toHex(value, fallback) {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!context || !value) return fallback;
  context.fillStyle = fallback;
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function blendHex(front, back, weight) {
  const parse = (value) => {
    const match = /^#([\da-f]{6})$/i.exec(value);
    return match ? [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16)) : null;
  };
  const a = parse(front);
  const b = parse(back);
  if (!a || !b) return front;
  return `#${a.map((channel, index) => Math.round(channel * weight + b[index] * (1 - weight)).toString(16).padStart(2, "0")).join("")}`;
}

export function StorageTreemap({ assets }) {
  const hostRef = useRef(null);
  const [view, setView] = useState("chart");
  const { resolvedTheme } = useTheme();
  const rows = useMemo(() => (assets || [])
    .filter((asset) => Number(asset.sizeBytes) > 0)
    .map((asset) => ({ id: asset.id, folder: asset.folder || "root", name: asset.name || "Untitled asset", bytes: Number(asset.sizeBytes) }))
    .sort((a, b) => b.bytes - a.bytes), [assets]);

  const folders = useMemo(() => {
    const groups = new Map();
    for (const asset of rows) {
      if (!groups.has(asset.folder)) groups.set(asset.folder, []);
      groups.get(asset.folder).push(asset);
    }
    return [...groups.entries()].map(([name, children]) => ({
      name,
      value: children.reduce((total, asset) => total + asset.bytes, 0),
      children: children.map((asset) => ({ name: asset.name, value: asset.bytes })),
    })).sort((a, b) => b.value - a.value);
  }, [rows]);

  useEffect(() => {
    if (view !== "chart" || !hostRef.current || folders.length === 0) return undefined;
    const styles = getComputedStyle(document.documentElement);
    const token = (name, fallback) => toHex(styles.getPropertyValue(name).trim(), fallback);
    const ink = token("--foreground", "#e7e7e7");
    const surface = token("--surface-card", "#202020");
    const border = token("--border", "#333333");
    const palette = [0.98, 0.91, 0.85, 0.79, 0.73, 0.68].map((weight) => blendHex(ink, surface, weight));
    const chart = echarts.init(hostRef.current, null, { renderer: "canvas" });
    chart.setOption({
      animationDurationUpdate: 450,
      tooltip: {
        backgroundColor: surface,
        borderColor: border,
        textStyle: { color: ink, fontSize: 12 },
        formatter: ({ name, value }) => `${escapeHtml(name)}<br/><strong>${formatBytes(value)}</strong>`,
      },
      series: [{
        type: "treemap",
        name: "All folders",
        data: folders,
        color: palette,
        colorMappingBy: "index",
        top: 4,
        left: 0,
        right: 0,
        bottom: 32,
        roam: false,
        leafDepth: 1,
        nodeClick: "zoomToNode",
        breadcrumb: { show: true, height: 22, bottom: 0, itemStyle: { color: surface, borderColor: border }, textStyle: { color: ink, fontSize: 11 } },
        label: { show: true, color: surface, fontSize: 12, fontWeight: 600, overflow: "truncate" },
        upperLabel: { show: true, height: 28, color: surface, fontSize: 12, fontWeight: 600, overflow: "truncate" },
        itemStyle: { borderColor: surface, borderWidth: 2, gapWidth: 2 },
        levels: [
          { itemStyle: { borderColor: surface, borderWidth: 0, gapWidth: 3 } },
          { color: palette, colorMappingBy: "index", upperLabel: { show: true }, itemStyle: { borderColor: surface, borderWidth: 3, gapWidth: 2 } },
          { label: { show: true }, itemStyle: { borderColor: surface, borderWidth: 1, gapWidth: 1 } },
        ],
      }],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(hostRef.current);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [folders, resolvedTheme, view]);

  return (
    <ChartCard
      title="Storage map"
      description="Area shows bytes used. Click a folder to inspect its assets; use the breadcrumb to go back."
      onViewChange={setView}
      table={{
        columns: [
          { key: "folder", header: "Folder" },
          { key: "name", header: "Asset" },
          { key: "bytes", header: "Size", align: "right", render: (row) => formatBytes(row.bytes) },
        ],
        rows,
        getRowKey: (row) => row.id,
      }}
    >
      <div ref={hostRef} className="h-[360px] w-full" role="img" aria-label="Interactive storage map of folders and assets by size" />
    </ChartCard>
  );
}
