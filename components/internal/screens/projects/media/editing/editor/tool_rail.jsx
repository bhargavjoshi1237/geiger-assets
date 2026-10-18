"use client";

import React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@geiger/ui/tooltip";
import { Kbd } from "@geiger/ui/kbd";
import { cn } from "@/lib/utils";

import { TOOLS } from "../constants";
import { IconButton } from "./editor_controls";

export function ToolRail({ state, engine }) {
  const ready = Boolean(state?.ready);
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-2">
      {TOOLS.map((t) => (
        <Tooltip key={t.value}>
          <TooltipTrigger asChild>
            <IconButton
              icon={t.icon}
              label={t.label}
              active={state?.tool === t.value}
              disabled={!ready}
              onClick={() => engine?.setTool(t.value)}
            />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-56">
            <span className="flex items-center gap-2 font-medium">
              {t.label} <Kbd>{t.shortcut}</Kbd>
            </span>
            <span className="mt-0.5 block opacity-70">{t.hint}</span>
          </TooltipContent>
        </Tooltip>
      ))}

      <div className="mt-auto pb-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <label
              className={cn(
                "relative block h-8 w-8 cursor-pointer overflow-hidden rounded-md border border-border-strong shadow-sm",
                !ready && "pointer-events-none opacity-40",
              )}
            >
              <span aria-hidden className="absolute inset-0" style={{ backgroundColor: state?.color }} />
              <input
                type="color"
                aria-label="Foreground color"
                value={state?.color || "#ffffff"}
                onChange={(e) => engine?.setColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </TooltipTrigger>
          <TooltipContent side="right">Foreground color — used by text, shapes and brush</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
