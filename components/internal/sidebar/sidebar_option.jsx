"use client";

import React, { useState } from "react";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  useSidebar,
} from "@geiger/ui/sidebar";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@geiger/ui/tooltip";

// True when `title` is this item or any of its nested sub-items.
export function navContains(item, title) {
  return (
    item.title === title ||
    (item.subItems || []).some((sub) => navContains(sub, title))
  );
}

// The leaf destinations under a list of items (nested groups flattened).
function navLeaves(items) {
  return items.flatMap((item) => (item.subItems ? navLeaves(item.subItems) : [item]));
}

function SubItemButton({ item, isActive, onClick, trailing, ariaExpanded }) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-expanded={ariaExpanded}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "relative flex h-8 w-full items-center justify-start gap-2 rounded-md px-2 text-left text-sm leading-none transition-colors",
        isActive
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "bg-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      {item.icon && (
        <item.icon
          className={cn(
            "w-4 h-4 shrink-0 transition-colors",
            isActive ? "text-foreground" : "text-sidebar-foreground/70",
          )}
        />
      )}
      <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
      {trailing}
    </Button>
  );
}

// A sub-item that owns its own sub-items (e.g. Platform → API → Keys…):
// toggles open in place and starts open when it holds the active tab.
function SubItemGroup({ item, activeSubTab, onClick }) {
  const [open, setOpen] = useState(null);
  const containsActive = navContains(item, activeSubTab);
  const isOpen = open ?? containsActive;

  return (
    <>
      <SubItemButton
        item={item}
        isActive={!isOpen && containsActive}
        ariaExpanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        trailing={
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        }
      />
      {isOpen && (
        <ul className="ml-3.5 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-1.5">
          {item.subItems.map((sub) => (
            <li key={sub.title}>
              <SubItemButton
                item={sub}
                isActive={activeSubTab === sub.title}
                onClick={() => onClick(sub.title)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

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
              {sub.subItems ? (
                <SubItemGroup item={sub} activeSubTab={activeSubTab} onClick={onClick} />
              ) : (
                <SubItemButton
                  item={sub}
                  isActive={activeSubTab === sub.title}
                  onClick={() => onClick(sub.title)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {subItems && isExpanded && isCollapsed && (
        <ul className="ml-0.5 flex w-[calc(100%_-_0.125rem)] flex-col gap-0.5 pt-1.5">
          {navLeaves(subItems).map((sub) => (
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
