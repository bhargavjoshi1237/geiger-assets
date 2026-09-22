"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/supabase/components/assets-client";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

const ProjectContext = createContext(undefined);

const LAST_PROJECT_KEY = "geiger-assets:last-project";

const PROJECT_COLUMNS =
  "id, name, slug, description, organization_id, created_by, dam_project_id";

export function resolveWorkspaceProject(projects, segment) {
  if (!segment || !projects?.length) return null;
  return (
    projects.find((p) => p.id === segment) ||
    projects.find((p) => p.dam_project_id === segment) ||
    null
  );
}

export function pickDefaultProjectId(projects) {
  if (!projects || projects.length === 0) return null;
  try {
    const remembered = window.localStorage.getItem(LAST_PROJECT_KEY);
    if (remembered && projects.some((p) => p.id === remembered)) {
      return remembered;
    }
  } catch {
  }
  return projects[0].id;
}

export const PREVIEW_PROJECT = { id: "assets-preview", name: "Brand Assets" };

export function ProjectProvider({ children, preview = false }) {
  const { projectId, setProject } = useWorkspaceUrl();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(!preview);

  const fetchProjects = useCallback(async () => {
    if (preview || !isSupabaseConfigured()) return [];
    try {
      const sb = createClient();
      const { data, error } = await sb
        .from("projects")
        .select(PROJECT_COLUMNS)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[project-context] load", error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error("[project-context] load", e);
      return [];
    }
  }, [preview]);

  const refresh = useCallback(async () => {
    const rows = await fetchProjects();
    setProjects(rows);
    setLoading(false);
    return rows;
  }, [fetchProjects]);

  useEffect(() => {
    let alive = true;
    fetchProjects().then((rows) => {
      if (!alive) return;
      setProjects(rows);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [fetchProjects]);

  useEffect(() => {
    if (loading || !projectId) return;
    const open = resolveWorkspaceProject(projects, projectId);
    if (!open) return;
    try {
      window.localStorage.setItem(LAST_PROJECT_KEY, open.id);
    } catch {
    }
  }, [loading, projects, projectId]);

  const project = useMemo(
    () =>
      preview ? PREVIEW_PROJECT : resolveWorkspaceProject(projects, projectId),
    [preview, projects, projectId],
  );

  const value = useMemo(
    () => ({
      project,

      projectId: project?.id || null,

      urlProjectId: projectId || null,
      projects,
      loading,
      setActiveProject: setProject,
      refresh,
    }),
    [project, projectId, projects, loading, setProject, refresh],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (ctx === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return ctx;
}

export function useOptionalProject() {
  return useContext(ProjectContext) ?? null;
}
