"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { GripVertical, Zap } from "lucide-react";

import { nodeTypes } from "./workflow_nodes";
import { ZoomControls } from "./zoom_controls";
import { stepsToGraph, graphToSteps } from "@/lib/workflows/graph";
import {
  CANVAS_FIT_VIEW,
  SNAP_SIZES,
  CONDITION_CATALOG,
  ACTION_CATALOG,
  catalogEntry,
  defaultConfig,
  groupByGroup,
} from "../constants";

const DND_MIME = "application/geiger-workflow";

const LIVE_EDGE_STYLE = { strokeDasharray: "2 3", strokeLinecap: "round", strokeWidth: 1.5 };

const newNodeId = () =>
  `step_${
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`;

function Palette() {
  const onDragStart = (kind, type) => (event) => {
    event.dataTransfer.setData(DND_MIME, JSON.stringify({ kind, type }));
    event.dataTransfer.effectAllowed = "move";
  };

  const groups = [
    { group: "Conditions", items: CONDITION_CATALOG, kind: "condition" },
    ...groupByGroup(ACTION_CATALOG).map((g) => ({ ...g, kind: "action" })),
  ];

  return (
    <Panel position="top-right">
      <div className="w-52 rounded-xl border border-border bg-surface-card/90 p-2 shadow-xl backdrop-blur-md">
        <div className="max-h-[52vh] space-y-2 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.group}>
              <p className="px-1 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {group.group}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon || Zap;
                return (
                  <div
                    key={item.key}
                    draggable
                    onDragStart={onDragStart(group.kind, item.key)}
                    className="group flex cursor-grab items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-text-tertiary transition-colors group-hover:text-text-secondary" />
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function CanvasInner({ steps, graph, active, onChange }) {
  const { resolvedTheme } = useTheme();
  const { screenToFlowPosition } = useReactFlow();

  const [snap, setSnap] = useState(false);
  const [snapSize, setSnapSize] = useState(SNAP_SIZES[1]);
  const [locked, setLocked] = useState(false);

  const [seeded] = useState(() => stepsToGraph(steps, graph));
  const [nodes, setNodes, onNodesChange] = useNodesState(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seeded.edges);

  const firstRun = useRef(true);
  const stepsRef = useRef(steps);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const nextGraph = { nodes, edges, viewport: graph?.viewport };
    const nextSteps = graphToSteps(nextGraph, stepsRef.current);
    stepsRef.current = nextSteps;
    onChange({ steps: nextSteps, graph: nextGraph });
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderedEdges = useMemo(
    () => (active ? edges.map((e) => ({ ...e, animated: true, style: LIVE_EDGE_STYLE })) : edges),
    [edges, active],
  );

  const onConnect = useCallback(
    (connection) =>
      setEdges((eds) => addEdge({ ...connection, type: "smoothstep" }, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData(DND_MIME);
      if (!raw) return;
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const entry = catalogEntry(payload.type);
      const node = {
        id: newNodeId(),
        type: payload.kind,
        position,
        data: { type: payload.type, config: defaultConfig(entry), kind: payload.kind },
        width: 300,
      };
      setNodes((nds) => nds.concat(node));
    },
    [screenToFlowPosition, setNodes],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={renderedEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDrop={onDrop}
      onDragOver={onDragOver}
      nodeTypes={nodeTypes}
      colorMode={resolvedTheme === "light" ? "light" : "dark"}
      defaultViewport={seeded.viewport}
      proOptions={{ hideAttribution: true }}
      snapToGrid={snap}
      snapGrid={[snapSize, snapSize]}
      nodesDraggable={!locked}
      nodesConnectable={!locked}
      elementsSelectable={!locked}
      minZoom={0.2}
      maxZoom={2}
      fitView
      fitViewOptions={CANVAS_FIT_VIEW}
      deleteKeyCode={["Backspace", "Delete"]}
      className="bg-background"
    >
      <Background
        color="var(--canvas-dots)"
        gap={snap ? snapSize : 12}
        size={1}
        variant="dots"
      />
      <ZoomControls
        snap={snap}
        onSnapChange={setSnap}
        snapSize={snapSize}
        onSnapSizeChange={setSnapSize}
        locked={locked}
        onLockedChange={setLocked}
      />
      <Palette />
    </ReactFlow>
  );
}

export function WorkflowCanvas({ steps, graph, active, onChange }) {
  return (
    <div className="h-[70vh] w-full overflow-hidden rounded-xl border border-border bg-background">
      <ReactFlowProvider>
        <CanvasInner steps={steps} graph={graph} active={active} onChange={onChange} />
      </ReactFlowProvider>
    </div>
  );
}

export default WorkflowCanvas;
