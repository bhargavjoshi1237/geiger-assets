"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

const ProjectContext = createContext();

import { createClient } from "@/lib/supabase/client";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeProjectId(rawId) {
  if (typeof rawId !== "string") {
    return "";
  }

  let value = rawId.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the original value if it is not URI-encoded.
  }

  return value.replace(/^['"]+|['"]+$/g, "").trim();
}

export function ProjectProvider({ children }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProjectInfo = useCallback(async (id) => {
    const normalizedId = normalizeProjectId(id);
    console.log(
      "[project-context] fetchProjectInfo triggered for:",
      id,
      "normalized:",
      normalizedId
    );
    setLoading(true);
    try {
      if (!normalizedId) {
        console.warn("[project-context] missing project id, skipping fetch");
        setProject(null);
        return;
      }

      if (!UUID_REGEX.test(normalizedId)) {
        console.warn("[project-context] invalid UUID format, skipping fetch:", normalizedId);
        setProject({
          id: normalizedId,
          name: normalizedId.charAt(0).toUpperCase() + normalizedId.slice(1).replace(/-/g, " "),
          status: "UNKNOWN",
        });
        return;
      }

      const supabase = createClient();
      const { data: foundProject, error } = await supabase
        .from("flow_projects")
        .select("*")
        .eq("id", normalizedId)
        .maybeSingle();

      if (error) {
        console.error("[project-context] fetch error:", error.message || error, error.code);
      }

      if (foundProject) {
        console.log("[project-context] project found:", foundProject.name);
        setProject(foundProject);
      } else {
        console.log("[project-context] project not found, using fallback for:", normalizedId);
        setProject({
          id: normalizedId,
          name: normalizedId.charAt(0).toUpperCase() + normalizedId.slice(1).replace(/-/g, " "),
          status: "UNKNOWN",
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <ProjectContext.Provider value={{ project, setProject, fetchProjectInfo, loading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
