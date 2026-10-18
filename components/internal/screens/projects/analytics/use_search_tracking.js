"use client";

import { useEffect, useRef } from "react";
import { logSearchEvent, markSearchClick } from "@/lib/supabase/analytics";

/** Records a settled search once and attributes the first opened result. */
export function useSearchTracking({ projectId, query, resultCount, filters, loading }) {
  const latest = useRef({ key: "", eventId: null, promise: null });
  const filterKey = JSON.stringify(filters);
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  const key = `${projectId}|${normalized}|${filterKey}`;

  useEffect(() => {
    if (loading || !projectId || !normalized) return undefined;
    const timer = setTimeout(() => {
      if (latest.current.key === key) return;
      const entry = { key, eventId: null, promise: null };
      latest.current = entry;
      entry.promise = logSearchEvent({ projectId, query, resultCount, filters: JSON.parse(filterKey) });
      entry.promise.then((eventId) => {
        if (latest.current === entry) entry.eventId = eventId;
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [filterKey, key, loading, normalized, projectId, query, resultCount]);

  return (assetId) => {
    if (!normalized || !projectId) return;
    if (latest.current.key === key && latest.current.eventId) {
      void markSearchClick(latest.current.eventId, assetId);
    } else if (latest.current.key === key && latest.current.promise) {
      void latest.current.promise.then((eventId) => { if (eventId) return markSearchClick(eventId, assetId); });
    } else if (latest.current.key !== key) {
      const entry = { key, eventId: null, promise: null };
      latest.current = entry;
      entry.promise = logSearchEvent({ projectId, query, resultCount, filters: JSON.parse(filterKey), clickedAssetId: assetId });
      void entry.promise.then((eventId) => { if (latest.current === entry) entry.eventId = eventId; });
    }
  };
}
