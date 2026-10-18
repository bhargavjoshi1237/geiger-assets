"use client";

// The builder's live preview: the real public page in an iframe (?preview=1),
// fed every unsaved edit over postMessage so changes show as you type. A "view
// as" switch re-renders it for a visitor, a follower, a lapsed member or a
// member of any tier; the device switch narrows it to a phone.

import React, { useEffect, useRef, useState } from "react";
import { Monitor, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import { PREVIEW_MESSAGE } from "@/lib/creator/page_config";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function PreviewFrame({ handle, draft, tiers, focus, reloadKey }) {
  const frameRef = useRef(null);
  const [as, setAs] = useState("guest");
  const [device, setDevice] = useState("desktop");
  const [ready, setReady] = useState(false);
  const [bump, setBump] = useState(0);
  const latest = useRef(draft);

  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const src = `${BASE}/c/${encodeURIComponent(handle)}?preview=1&as=${encodeURIComponent(as)}`;

  // The page says it's ready once hydrated; answer with the current draft.
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== `${PREVIEW_MESSAGE}:ready`) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      setReady(true);
      event.source.postMessage({ type: PREVIEW_MESSAGE, draft: latest.current }, window.location.origin);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const id = setTimeout(() => {
      frameRef.current?.contentWindow?.postMessage({ type: PREVIEW_MESSAGE, draft }, window.location.origin);
    }, 120);
    return () => clearTimeout(id);
  }, [draft, ready]);

  useEffect(() => {
    if (!ready || !focus?.id) return;
    frameRef.current?.contentWindow?.postMessage({ type: PREVIEW_MESSAGE, scrollTo: focus.id }, window.location.origin);
  }, [focus, ready]);

  const viewOptions = [
    { value: "guest", label: "Visitor" },
    { value: "follower", label: "Follower" },
    { value: "lapsed", label: "Former member" },
    ...tiers.map((t) => ({ value: `tier:${t.id}`, label: `${t.name} member` })),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-subtle">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-card p-0.5">
          {[
            { value: "desktop", icon: Monitor, label: "Desktop" },
            { value: "mobile", icon: Smartphone, label: "Phone" },
          ].map((d) => (
            <button
              key={d.value}
              type="button"
              aria-label={d.label}
              aria-pressed={device === d.value}
              onClick={() => setDevice(d.value)}
              className={cn(
                "flex h-7 w-8 items-center justify-center rounded-md transition-colors",
                device === d.value ? "bg-surface-hover text-foreground" : "text-text-secondary hover:text-foreground",
              )}
            >
              <d.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <span className="hidden truncate font-mono text-xs text-text-tertiary sm:block">/c/{handle}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-text-secondary md:inline">View as</span>
          <Select value={as} onValueChange={setAs}>
            <SelectTrigger size="sm" className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {viewOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon-sm" aria-label="Reload preview" className="h-8 w-8 text-text-secondary hover:bg-surface-active hover:text-foreground" onClick={() => setBump((n) => n + 1)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-surface-card/60 p-0 data-[device=mobile]:p-4" data-device={device}>
        <iframe
          key={`${src}|${reloadKey}|${bump}`}
          ref={frameRef}
          src={src}
          title="Creator page preview"
          className={cn(
            "mx-auto block h-full border-0 bg-background transition-[width] duration-300",
            device === "mobile" ? "w-[390px] max-w-full rounded-[1.75rem] border border-border shadow-2xl" : "w-full",
          )}
        />
      </div>
    </div>
  );
}
