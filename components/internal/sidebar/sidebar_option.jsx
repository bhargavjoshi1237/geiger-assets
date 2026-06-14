"use client";

import React from "react";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarOption({
  title,
  icon: Icon,
  isActive,
  onClick,
  badge,
  className,
  subItems,
  isExpanded,
  onToggle,
  activeSubTab,
}) {
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        onClick={subItems ? onToggle : () => onClick?.()}
        isActive={isActive}
        tooltip={title}
        aria-expanded={subItems ? Boolean(isExpanded) : undefined}
        className={cn(
          "h-9 text-sm transition-all group-data-[collapsible=icon]:justify-center",
          isExpanded || (isActive && !subItems)
            ? "bg-sidebar-accent text-foreground"
            : "text-sidebar-foreground",
          className,
        )}
      >
        {Icon && (
          <Icon
            className={cn(
              "w-4 h-4 shrink-0 transition-colors",
              isExpanded || isActive
                ? "text-foreground"
                : "text-sidebar-foreground/70",
            )}
          />
        )}
        {!isCollapsed && <span>{title}</span>}
        {subItems && !isCollapsed && (
          <span className="ml-auto flex items-center gap-1.5">
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
          </span>
        )}
        {badge && !subItems && !isCollapsed && (
          <SidebarMenuBadge className="mr-2 text-muted-foreground text-[10px] px-1.5 py-0.5 rounded border border-border ml-auto">
            {badge}
          </SidebarMenuBadge>
        )}
      </SidebarMenuButton>

      {subItems && isExpanded && !isCollapsed && (
        <ul className="ml-2 mt-1 flex flex-col gap-0.5">
          {subItems.map((sub) => (
            <li key={sub.title}>
              <Button
                type="button"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  onClick(sub.title);
                }}
                className={cn(
                  "relative flex h-8 w-full items-center justify-start gap-2 rounded-md px-2 text-left text-sm leading-none transition-colors",
                  activeSubTab === sub.title
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "bg-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {sub.icon && (
                  <sub.icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      activeSubTab === sub.title
                        ? "text-foreground"
                        : "text-sidebar-foreground/70",
                    )}
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-left">
                  {sub.title}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {subItems && isExpanded && isCollapsed && (
        <ul className="ml-0.5 flex w-[calc(100%_-_0.125rem)] flex-col gap-0.5 pt-1.5">
          {subItems.map((sub) => (
            <li key={sub.title}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={sub.title}
                    onClick={(e) => {
                      e.preventDefault();
                      onClick(sub.title);
                    }}
                    className={cn(
                      "relative h-8 w-full rounded-md p-0 transition-colors",
                      activeSubTab === sub.title
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {sub.icon && (
                      <sub.icon
                        className={cn(
                          "w-4 h-4 shrink-0 transition-colors",
                          activeSubTab === sub.title
                            ? "text-foreground"
                            : "text-sidebar-foreground/70",
                        )}
                      />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  {sub.title}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </SidebarMenuItem>
  );
}
