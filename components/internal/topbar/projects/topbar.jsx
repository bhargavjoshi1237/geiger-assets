"use client";

import React from "react";
import { Search, Bell, HelpCircle, ChevronsUpDown, Plug } from "lucide-react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useProject } from "@/context/project-context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationsDropdown } from "../dialogue/notifications_dropdown";

export function ProjectTopbar() {
  const { project } = useProject();
  return (
    <header className="h-14 px-4 flex items-center justify-between border-b border-[#2a2a2a] bg-[#161616] text-white z-20 w-full shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden -ml-2 text-white" />
          <div className="w-8 h-8 rounded flex items-center justify-center shrink-0 md:-ml-1.5">
            <img
              src="/logo1.svg"
              alt=""
              className="w-7 h-7 -mr-0.5 hover:bg-[#282828] rounded-md p-1"
              onClick={() => {
                window.location.href = "/";
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement.innerHTML =
                  '<div class="w-2 h-2 bg-white rounded-full"></div>';
              }}
            />
          </div>
          <div className="flex items-center gap-1 cursor-pointer group group-data-[collapsible=icon]:hidden md:border-l md:border-[#333333] pl-2 hidden sm:flex">
            <span className="text-white font-semibold text-sm ml-1 truncate max-w-[150px] md:max-w-xs">
              {project?.name || "Project"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-4 md:gap-8 sm:mr-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <button className="relative flex items-center bg-[#242424] border border-[#2a2a2a] hover:border-[#474747] transition-colors rounded-md h-8 px-2 sm:px-2.5 w-8 sm:w-[240px] justify-center sm:justify-start text-sm text-[#a3a3a3] shadow-sm group">
            <Search className="w-4 h-4 sm:mr-2 text-[#a3a3a3] group-hover:text-white transition-colors" />
            <span className="hidden sm:inline-block text-[#a3a3a3] group-hover:text-white transition-colors">
              Search project...
            </span>
            <div className="absolute right-1.5 top-1.5 hidden sm:flex items-center gap-1">
              <KbdGroup>
                <Kbd className="bg-[#1a1a1a] border-[#333333] text-[#a3a3a3] group-hover:bg-[#2a2a2a] group-hover:text-white transition-colors">
                  ⌘
                </Kbd>
                <Kbd className="bg-[#1a1a1a] border-[#333333] text-[#a3a3a3] group-hover:bg-[#2a2a2a] group-hover:text-white transition-colors">
                  K
                </Kbd>
              </KbdGroup>
            </div>
          </button>

          <div className="flex items-center gap-0 sm:gap-1 ml-0 sm:ml-1">
            <button className="w-8 h-8 rounded-full border border-transparent hover:bg-[#2a2a2a] hidden sm:flex items-center justify-center transition-colors text-[#a3a3a3] hover:text-white">
              <HelpCircle className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
            <NotificationsDropdown>
              <button className="w-8 h-8 rounded-full border border-transparent hover:bg-[#2a2a2a] flex items-center justify-center transition-colors text-[#a3a3a3] hover:text-white relative">
                <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
                <div className="absolute top-[6px] right-[7px] w-2 h-2 rounded-full bg-[#3b82f6] border border-[#161616]"></div>
              </button>
            </NotificationsDropdown>
            <button className="w-8 h-8 rounded-full border border-[#333333] hover:border-[#474747] overflow-hidden ml-1 transition-colors">
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"></div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
