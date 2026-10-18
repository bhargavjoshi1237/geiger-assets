"use client";

// Shared pieces for the store settings screens (Storefront, Cart & Checkout):
// the settings hook with optimistic, per-group saves, and inputs that commit on
// blur the way the project settings screens do.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { cn } from "@/lib/utils";
import { getStoreSettings, saveStoreSettings } from "@/lib/supabase/store";
import { normalizeStoreSettings } from "@/lib/commerce/shape";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * The project's store settings. `patch(group, fields)` merges into one group,
 * updates the screen immediately and rolls back if the save fails.
 */
export function useStoreSettings(projectId) {
  const [settings, setSettings] = useState(() => normalizeStoreSettings(null));
  const [loading, setLoading] = useState(true);
  // The latest settings, so back-to-back saves merge onto each other.
  const current = useRef(settings);

  useEffect(() => {
    let alive = true;
    getStoreSettings(projectId).then((row) => {
      if (!alive) return;
      if (row) {
        current.current = row;
        setSettings(row);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const patch = useCallback(
    async (group, fields) => {
      const previous = current.current;
      const next = { ...previous, [group]: { ...previous[group], ...fields } };
      current.current = next;
      setSettings(next);
      const saved = await saveStoreSettings(projectId, { [group]: next[group] });
      if (!saved) {
        current.current = previous;
        setSettings(previous);
        toast.error("Couldn't save that setting");
        return false;
      }
      return true;
    },
    [projectId],
  );

  return { settings, loading, patch };
}

/** Server-side facts the browser can't see: is Stripe configured, and how. */
export function useStoreStatus(projectId) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`${BASE}/api/store/status?projectId=${encodeURIComponent(projectId || "")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => alive && setStatus(body))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [projectId]);
  return status;
}

/** Text input that saves when it loses focus (or on Enter). */
export function BlurInput({ value, onCommit, className, ...props }) {
  const [text, setText] = useState(value ?? "");
  const [seen, setSeen] = useState(value ?? "");
  if ((value ?? "") !== seen) {
    setSeen(value ?? "");
    setText(value ?? "");
  }
  return (
    <Input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== (value ?? "") && onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={cn("border-border bg-surface-card text-foreground", className)}
      {...props}
    />
  );
}

export function BlurTextarea({ value, onCommit, className, rows = 4, ...props }) {
  const [text, setText] = useState(value ?? "");
  const [seen, setSeen] = useState(value ?? "");
  if ((value ?? "") !== seen) {
    setSeen(value ?? "");
    setText(value ?? "");
  }
  return (
    <Textarea
      value={text}
      rows={rows}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== (value ?? "") && onCommit(text)}
      className={cn("resize-y border-border bg-surface-card text-foreground", className)}
      {...props}
    />
  );
}
