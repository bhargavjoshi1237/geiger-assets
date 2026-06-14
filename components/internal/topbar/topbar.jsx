"use client";

import React from "react";
import { Bell, HelpCircle, Search } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationsDropdown } from "./dialogue/notifications_dropdown";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function Topbar() {
  return (
    <header className="relative z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-topbar-border bg-topbar-bg px-4 text-foreground backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        <SidebarTrigger className="-ml-2 text-foreground md:hidden" />
        <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded md:-ml-1.5 md:flex">
          <Image
            src={`${basePath}/logo1.svg`}
            alt=""
            width={20}
            height={20}
            className="geiger-logo -mr-0.5 h-5 w-5"
            onError={(event) => {
              event.currentTarget.style.display = "none";
              event.currentTarget.parentElement.innerHTML =
                '<div class="h-2 w-2 rounded-full bg-foreground"></div>';
            }}
          />
        </div>
        <div className="hidden cursor-pointer items-center gap-1 border-border pl-2 sm:flex md:border-l">
          <span className="ml-1 text-sm font-semibold text-foreground">Assets</span>
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 md:hidden">
        <Image
          src={`${basePath}/logo1.svg`}
          alt=""
          width={20}
          height={20}
          className="geiger-logo h-5 w-5"
        />
        <span className="text-sm font-semibold text-foreground">Assets</span>
      </div>

      <div className="flex justify-between gap-4 sm:mr-2 md:gap-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            className="group relative hidden h-8 w-[240px] items-center justify-start rounded-md border border-border bg-surface-active px-2.5 text-sm text-muted-foreground shadow-sm transition-colors hover:border-border-strong sm:flex"
          >
            <Search className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground sm:mr-2" />
            <span className="hidden text-muted-foreground transition-colors group-hover:text-foreground sm:inline-block">
              Search...
            </span>
            <div className="absolute right-1.5 top-1.5 hidden items-center gap-1 sm:flex">
              <KbdGroup>
                <Kbd className="border-border bg-surface-subtle text-muted-foreground transition-colors group-hover:bg-surface-hover group-hover:text-foreground">
                  Ctrl
                </Kbd>
                <Kbd className="border-border bg-surface-subtle text-muted-foreground transition-colors group-hover:bg-surface-hover group-hover:text-foreground">
                  K
                </Kbd>
              </KbdGroup>
            </div>
          </Button>

          <div className="ml-0 flex items-center gap-0 sm:ml-1 sm:gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Help"
              className="hidden h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground sm:flex"
            >
              <HelpCircle className="h-[18px] w-[18px]" strokeWidth={2} />
            </Button>
            <NotificationsDropdown>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Notifications"
                className="relative hidden h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground sm:flex"
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
              </Button>
            </NotificationsDropdown>
            <Button
              variant="ghost"
              aria-label="Profile"
              className="ml-1 h-8 w-8 overflow-hidden rounded-full border border-border p-0 transition-colors hover:border-border-strong"
            >
              <span className="h-full w-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
