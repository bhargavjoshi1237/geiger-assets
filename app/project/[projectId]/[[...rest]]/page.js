"use client";

import React, { useEffect } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { LoadingArea } from "@geiger/ui";

import { WorkspaceScreen } from "@/components/internal/workspace/workspace_screen";
import { useProject, pickDefaultProjectId } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { goToSuiteLogin } from "@/lib/workspace/suite_session";
import { isReservedSegment } from "@/lib/workspace/reserved";

function ScreenArea() {
  const router = useRouter();
  const { tab, setTab } = useWorkspaceUrl();
  const { project, projects, loading, urlProjectId } = useProject();

  useEffect(() => {
    if (loading) return;
    if (projects.length === 0) {
      goToSuiteLogin();
      return;
    }
    if (!project) {
      const fallback = pickDefaultProjectId(projects);
      if (fallback) router.replace(`/project/${fallback}`);
      return;
    }
    if (project.id !== urlProjectId) router.replace(`/project/${project.id}`);
  }, [loading, project, projects, urlProjectId, router]);

  if (loading || !project) return <LoadingArea size={72} label="Loading workspace" />;

  return (
    <div key={project.id} className="h-full">
      <WorkspaceScreen tab={tab} projectId={project.id} onNavigate={setTab} />
    </div>
  );
}

export default function AssetsProjectWorkspacePage() {
  const params = useParams();
  const projectId = params?.projectId;

  if (isReservedSegment(projectId)) notFound();

  return <ScreenArea />;
}
