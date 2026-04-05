import React, { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Download, FileText, Image as ImageIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function NotificationsDropdown({ children }) {
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState([]);

  const filteredNotifications = notifications.filter((n) => {
    return activeTab === "all" ? true : activeTab === "unread" ? !n.read : true;
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children || (
          <button className="w-8 h-8 rounded-full border border-transparent hover:bg-[#2a2a2a] flex items-center justify-center transition-colors text-[#a3a3a3] hover:text-white relative">
            <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
            {notifications.some((n) => !n.read) && (
              <div className="absolute top-[6px] right-[7px] w-2 h-2 rounded-full bg-[#3b82f6] border border-[#161616]"></div>
            )}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="mt-1 w-[380px] p-0 bg-[#141414] border border-[#1f1f1f] rounded-2xl overflow-hidden  scrollbar-hide"
      >
        <div className="px-5 pt-5 pb-4 flex flex-col gap-4 border-b border-[#1f1f1f]">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-white">
              Notifications
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-[#1a1a1a] w-full justify-center rounded-lg p-1 border border-[#2a2a2a]">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-1.5 text-sm w-full font-medium rounded-md transition-all ${
                  activeTab === "all"
                    ? "bg-[#2a2a2a] text-[#e7e7e7] shadow-sm"
                    : "text-[#737373] hover:text-[#e7e7e7] hover:bg-[#202020]"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab("unread")}
                className={`px-4 py-1.5 text-sm w-full font-medium rounded-md transition-all flex items-center gap-2 ${
                  activeTab === "unread"
                    ? "bg-[#2a2a2a] text-[#e7e7e7] shadow-sm"
                    : "text-[#737373] hover:text-[#e7e7e7] hover:bg-[#202020]"
                }`}
              >
                Unread
                {notifications.some((n) => !n.read) && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activeTab === "unread" ? "bg-blue-500" : "bg-blue-500/60"
                    }`}
                  ></span>
                )}
              </button>
              {["General", "Mentions"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab.toLowerCase())}
                  className={`px-4 py-1.5 text-sm w-full font-medium rounded-md transition-all ${
                    activeTab === tab.toLowerCase()
                      ? "bg-[#2a2a2a] text-[#e7e7e7] shadow-sm"
                      : "text-[#737373] hover:text-[#e7e7e7] hover:bg-[#202020]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto pb-2 custom-scrollbar">
          {filteredNotifications.length === 0 ? (
            <div className="px-4 py-12 text-center text-[13px] text-[#666666]">
              No notifications found.
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const IconComponent = LucideIcons[notification.icon] || Bell;
              let formattedTime = notification.time;
              try {
                const date = new Date(notification.time);
                if (!isNaN(date.getTime())) {
                  formattedTime = formatDistanceToNow(date, {
                    addSuffix: true,
                  });
                }
              } catch (e) {}

              let extraContent = null;
              try {
                if (typeof notification.extra === "string") {
                  extraContent = JSON.parse(notification.extra);
                } else if (
                  typeof notification.extra === "object" &&
                  notification.extra !== null
                ) {
                  extraContent = notification.extra;
                }
              } catch (e) {}

              const isUnread = !notification.read;
              const bgColor = notification.bg_color || notification.bgColor || "bg-[#1f1f1f]";
              const iconColor = notification.icon_color || notification.iconColor || "text-[#666666]";

              return (
                <div
                  key={notification.id}
                  className={`px-4 py-3.5 transition-colors relative group cursor-pointer border-b border-[#1a1a1a] last:border-b-0 ${
                    isUnread
                      ? "bg-[#1a1a1a]/50 hover:bg-[#1f1f1f]"
                      : "hover:bg-[#181818]"
                  }`}
                >
                  {isUnread && (
                    <div className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  )}

                  <div className="pl-3 flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${bgColor} border border-white/[0.06]`}
                    >
                      <IconComponent
                        className={`w-4 h-4 ${iconColor}`}
                        strokeWidth={1.8}
                      />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <h3
                          className={`text-[13px] font-medium truncate ${
                            isUnread ? "text-white" : "text-[#c0c0c0]"
                          }`}
                        >
                          {notification.title}
                        </h3>
                        <span className="text-[11px] text-[#555555] whitespace-nowrap shrink-0">
                          {formattedTime}
                        </span>
                      </div>
                      <p
                        className={`text-[12px] leading-relaxed ${
                          isUnread ? "text-[#a0a0a0]" : "text-[#707070]"
                        } line-clamp-2`}
                      >
                        {notification.description}
                      </p>

                      {extraContent && (
                        <div className="mt-3">
                          {extraContent.type === "comment" && (
                            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-[12px] text-[#909090] leading-relaxed">
                              {extraContent.text}
                            </div>
                          )}

                          {extraContent.type === "file" &&
                            extraContent.files?.map((f, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between p-2.5 border border-[#2a2a2a] rounded-lg bg-[#1a1a1a] mt-2"
                              >
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  <div className="w-7 h-7 rounded flex items-center justify-center bg-[#222222] text-[#808080] text-[10px] font-medium">
                                    {f.name.split('.').pop().toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[12px] text-[#c0c0c0] truncate">
                                      {f.name}
                                    </div>
                                    <div className="text-[10px] text-[#666666]">
                                      {f.size}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-8 h-8 rounded flex items-center justify-center text-[#666666] hover:text-white hover:bg-[#2a2a2a] transition-colors shrink-0"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            ))}

                          {extraContent.type === "actions" && (
                            <div className="flex items-center gap-2 mt-2.5">
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-1.5 rounded-lg border border-[#333333] text-[11px] font-medium text-[#909090] hover:bg-[#252525] hover:text-white transition-colors"
                              >
                                {extraContent.options?.[0] || "Decline"}
                              </button>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-1.5 rounded-lg bg-white text-[11px] font-medium text-black hover:bg-gray-200 transition-colors"
                              >
                                {extraContent.options?.[1] || "Accept"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-3">
                        <span className="text-[9px] uppercase font-semibold tracking-wider text-[#666666] bg-[#1f1f1f] px-2 py-1 rounded-md border border-[#2a2a2a]">
                          {notification.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
