"use client";

import React from "react";
import {
  ChevronDown,
  Download,
  Image as ImageIcon,
  Keyboard,
  Loader2,
  PanelRight,
  Redo2,
  RotateCcw,
  Save,
  SplitSquareHorizontal,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Kbd } from "@geiger/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@geiger/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { SHORTCUT_GROUPS, formatZoom } from "../constants";
import { BarDivider, Hint, HintIconButton } from "./editor_controls";

function ShortcutsPopover() {
  return (
    <Popover>
      <Hint label="Keyboard shortcuts">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Keyboard shortcuts"
            className="hidden h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground md:inline-flex"
          >
            <Keyboard className="h-4 w-4" />
          </button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent align="end" className="w-[420px] border-border bg-surface-subtle p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">Keyboard shortcuts</p>
          <p className="text-xs text-text-tertiary">Use ⌘ in place of Ctrl on macOS.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-4">
          {SHORTCUT_GROUPS.map((g) => (
            <div key={g.group} className={cn("grid gap-1.5", g.group === "View" && "col-span-2 grid-cols-2 gap-x-6")}>
              <p className={cn("text-[11px] font-medium uppercase tracking-wider text-text-tertiary", g.group === "View" && "col-span-2")}>
                {g.group}
              </p>
              {g.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-xs text-text-secondary">
                  <span className="truncate">{item.label}</span>
                  <span className="flex shrink-0 gap-1">
                    {item.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EditorTopBar({ state, engine, source, saving, onOpenPicker, onSave, onDownload, onOpenPanels }) {
  const ready = Boolean(state?.ready);
  const holdCompare = (on) => () => engine?.setComparing(on);

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2">
      <button
        type="button"
        onClick={onOpenPicker}
        className="group flex h-9 min-w-0 max-w-[280px] items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-card">
          {source?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5 text-text-secondary" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{source?.name || "Open an image"}</span>
          {state?.dirty ? <span className="block text-[10px] leading-none text-amber-700 dark:text-amber-400">Unsaved changes</span> : null}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-tertiary transition-colors group-hover:text-foreground" />
      </button>

      <BarDivider className="hidden sm:block" />

      <div className="flex items-center gap-0.5">
        <HintIconButton icon={Undo2} label="Undo" shortcut="Ctrl Z" disabled={!state?.canUndo} onClick={() => engine?.undo()} />
        <HintIconButton icon={Redo2} label="Redo" shortcut="Ctrl ⇧ Z" disabled={!state?.canRedo} onClick={() => engine?.redo()} />
      </div>

      <BarDivider className="hidden md:block" />

      <div className="hidden items-center gap-0.5 md:flex">
        <HintIconButton icon={ZoomOut} label="Zoom out" shortcut="Ctrl −" disabled={!ready} onClick={() => engine?.zoomStep(-1)} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={!ready}
              className="inline-flex h-8 min-w-[58px] items-center justify-center rounded-md px-2 font-mono text-xs tabular-nums text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
            >
              {formatZoom(state?.zoom)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48 border-border bg-surface-subtle">
            <DropdownMenuItem onSelect={() => engine?.fit()}>
              Fit to screen <DropdownMenuShortcut>Ctrl 0</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => engine?.zoomTo(1)}>
              Actual pixels <DropdownMenuShortcut>Ctrl 1</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {[0.25, 0.5, 2, 4].map((z) => (
              <DropdownMenuItem key={z} onSelect={() => engine?.zoomTo(z)}>
                {formatZoom(z)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <HintIconButton icon={ZoomIn} label="Zoom in" shortcut="Ctrl +" disabled={!ready} onClick={() => engine?.zoomStep(1)} />
      </div>

      <BarDivider className="hidden md:block" />

      <Hint label="Hold to compare with the original" shortcut="\">
        <button
          type="button"
          disabled={!state?.edited}
          aria-label="Hold to compare with the original"
          onPointerDown={holdCompare(true)}
          onPointerUp={holdCompare(false)}
          onPointerLeave={holdCompare(false)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
            state?.comparing ? "bg-surface-active text-foreground" : "text-text-secondary hover:bg-surface-hover hover:text-foreground",
          )}
        >
          <SplitSquareHorizontal className="h-4 w-4" />
          <span className="hidden xl:inline">Compare</span>
        </button>
      </Hint>

      <div className="ml-auto flex items-center gap-1">
        <HintIconButton icon={RotateCcw} label="Reset all edits" disabled={!state?.edited} onClick={() => engine?.resetAll()} />
        <ShortcutsPopover />
        <HintIconButton icon={PanelRight} label="Panels" className="lg:hidden" onClick={onOpenPanels} />
        <BarDivider />
        <Button
          variant="outline"
          size="sm"
          className="hidden border-border bg-transparent text-text-secondary hover:bg-surface-hover hover:text-foreground sm:inline-flex"
          disabled={!ready || saving}
          onClick={onDownload}
        >
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!ready || saving}
          onClick={onSave}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>
    </div>
  );
}
