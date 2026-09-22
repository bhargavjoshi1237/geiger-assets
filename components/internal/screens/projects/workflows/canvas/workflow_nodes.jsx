"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Zap } from "lucide-react";

import { catalogEntry, summarizeConfig } from "../constants";

function NodeCard({ accent, kindLabel, data, selected, showTarget = true }) {
  const entry = catalogEntry(data?.type);
  const Icon = entry?.icon || Zap;
  const summary = summarizeConfig(entry, data?.config);

  const accentClass =
    {
      amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
      violet: "border-violet-500/20 bg-violet-500/10 text-violet-300",
      sky: "border-sky-500/20 bg-sky-500/10 text-sky-400",
    }[accent] || "border-border bg-surface-card text-muted-foreground";

  return (
    <div
      className={`group w-[300px] rounded-xl border bg-surface-subtle p-3 shadow-md transition-colors ${
        selected ? "border-foreground" : "border-border hover:border-border-strong"
      }`}
    >
      {showTarget ? (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2 !w-2 !border-0 !bg-text-tertiary"
        />
      ) : null}

      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${accentClass}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            {kindLabel}
          </p>
          <p className="truncate text-sm font-medium text-foreground">
            {entry?.label || data?.type || "Step"}
          </p>
          <p className="mt-0.5 line-clamp-2 min-h-8 text-xs text-text-secondary">
            {summary}
          </p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-foreground"
      />
    </div>
  );
}

export const TriggerNode = memo(function TriggerNode({ data, selected }) {
  return (
    <NodeCard
      accent="amber"
      kindLabel="When this happens"
      data={data}
      selected={selected}
      showTarget={false}
    />
  );
});

export const ConditionNode = memo(function ConditionNode({ data, selected }) {
  return (
    <NodeCard
      accent="violet"
      kindLabel="Only continue if"
      data={data}
      selected={selected}
    />
  );
});

export const ActionNode = memo(function ActionNode({ data, selected }) {
  return (
    <NodeCard
      accent="sky"
      kindLabel="Then do this"
      data={data}
      selected={selected}
    />
  );
});

export const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
};
