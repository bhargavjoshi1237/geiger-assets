"use client";

// Shared settings state for the eight project settings screens.
//
// Every screen starts from DEFAULT_PROJECT_SETTINGS with a loading flag,
// fetches the row on mount, and persists through lib/supabase/settings.js
// optimistically: local state updates immediately, the write follows, and a
// falsy write rolls back with a toast. Toasts are raised here and in the
// screens — never in the data layer.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  DEFAULT_PROJECT_SETTINGS,
  getProjectSettings,
  updateProjectSettings,
} from "@/lib/supabase/settings";

export function useProjectSettings(projectId) {
  const [settings, setSettings] = useState({ ...DEFAULT_PROJECT_SETTINGS });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getProjectSettings(projectId).then((row) => {
      if (!alive) return;
      if (row) setSettings((prev) => ({ ...prev, ...row }));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Optimistic patch save. Returns the saved row, or null when the write
  // failed (state is already rolled back by then).
  const save = useCallback(
    async (patch, { success, error } = {}) => {
      let previous = null;
      setSettings((current) => {
        previous = current;
        return { ...current, ...patch };
      });
      const saved = await updateProjectSettings(projectId, patch);
      if (!saved) {
        setSettings(previous);
        toast.error(error || "Couldn't save settings.");
        return null;
      }
      setSettings((current) => ({ ...current, ...saved }));
      if (success) toast.success(success);
      return saved;
    },
    [projectId],
  );

  return { settings, setSettings, loading, save };
}
