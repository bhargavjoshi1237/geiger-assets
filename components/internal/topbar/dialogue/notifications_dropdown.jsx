"use client";

import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import { Bell, Download } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SegmentedTabs } from "@geiger/ui/segmented-tabs";
import { Button } from "@geiger/ui/button";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";

const NOTIFICATION_TABS = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "General", value: "general" },
  { label: "Mentions", value: "mentions" },
];

function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value ?? "";
  return formatDistanceToNow(date, { addSuffix: true });
}

function parseExtra(extra) {
  if (extra && typeof extra === "object") return extra;
  if (typeof extra !== "string") return null;
  try {
    return JSON.parse(extra);
  } catch {
    return null;
  }
}

function NotificationRow({ notification }) {
  const Icon = LucideIcons[notification.icon] || Bell;
  const extra = parseExtra(notification.extra);
  const isUnread = !notification.read;
  const bgColor = notification.bg_color || notification.bgColor || "bg-surface-card";
  const iconColor =
    notification.icon_color || notification.iconColor || "text-text-secondary";

  return (
    <div
      className={cn(
        "group relative cursor-pointer border-b border-border px-4 py-3.5 transition-colors last:border-b-0",
        isUnread ? "bg-surface-subtle/50 hover:bg-surface-card" : "hover:bg-surface-card",
      )}
    >
      {isUnread ? (
        <div className="absolute left-1.5 top-5 h-1.5 w-1.5 rounded-full bg-primary" />
      ) : null}

      <div className="flex items-start gap-3 pl-3">
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border",
            bgColor,
          )}
        >
          <Icon className={cn("h-4 w-4", iconColor)} strokeWidth={1.8} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3
              className={cn(
                "truncate text-[13px] font-medium",
                isUnread ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {notification.title}
            </h3>
            <span className="shrink-0 whitespace-nowrap text-[11px] text-text-tertiary">
              {relativeTime(notification.time)}
            </span>
          </div>
          <p
            className={cn(
              "line-clamp-2 text-[12px] leading-relaxed",
              isUnread ? "text-muted-foreground" : "text-text-secondary",
            )}
          >
            {notification.description}
          </p>

          {extra ? (
            <div className="mt-3">
              {extra.type === "comment" ? (
                <div className="rounded-lg border border-border bg-surface-subtle p-3 text-[12px] leading-relaxed text-muted-foreground">
                  {extra.text}
                </div>
              ) : null}

              {extra.type === "file"
                ? (extra.files || []).map((file) => (
                    <div
                      key={file.name}
                      className="mt-2 flex items-center justify-between rounded-lg border border-border bg-surface-subtle p-2.5"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="flex h-7 w-7 items-center justify-center rounded bg-surface-card text-[10px] font-medium text-text-secondary">
                          {String(file.name).split(".").pop().toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[12px] text-muted-foreground">
                            {file.name}
                          </div>
                          <div className="text-[10px] text-text-secondary">{file.size}</div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Download ${file.name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                : null}

              {extra.type === "actions" ? (
                <div className="mt-2.5 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border-strong bg-transparent text-[11px] text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {extra.options?.[0] || "Decline"}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-[11px] text-primary-foreground hover:bg-primary/90"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {extra.options?.[1] || "Accept"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3">
            <span className="rounded-md border border-border bg-surface-card px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-text-secondary">
              {notification.type}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationsDropdown({ children }) {
  const [activeTab, setActiveTab] = useState("all");
  const [notifications] = useState([]);

  const hasUnread = notifications.some((n) => !n.read);
  const filtered =
    activeTab === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children || (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative h-8 w-8 rounded-full text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
            {hasUnread ? (
              <span className="absolute right-[7px] top-[6px] h-2 w-2 rounded-full border border-background bg-primary" />
            ) : null}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="mt-1 w-[380px] overflow-hidden rounded-2xl border border-border bg-surface-subtle p-0"
      >
        <div className="flex flex-col gap-4 border-b border-border px-5 pb-4 pt-5">
          <h2 className="text-[15px] font-semibold text-foreground">Notifications</h2>
          <SegmentedTabs
            tabs={NOTIFICATION_TABS}
            value={activeTab}
            onChange={setActiveTab}
            fullWidth
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto pb-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="You're all caught up."
            />
          ) : (
            filtered.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NotificationsDropdown;
