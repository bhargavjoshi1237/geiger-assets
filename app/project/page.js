"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@geiger/ui";

import {
  ProjectProvider,
  useProject,
  pickDefaultProjectId,
} from "@/context/project-context";
import { goToSuiteLogin } from "@/lib/workspace/suite_session";

function ProjectResolver() {
  const router = useRouter();
  const { projects, loading } = useProject();

  useEffect(() => {
    if (loading) return;
    if (projects.length === 0) {
      goToSuiteLogin();
      return;
    }
    const id = pickDefaultProjectId(projects);
    if (id) router.replace(`/project/${id}`);
  }, [loading, projects, router]);

  return <LoadingScreen size={80} />;
}

export default function ProjectIndexPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center bg-background" />
      }
    >
      <ProjectProvider>
        <div className="h-[100dvh] w-full bg-background text-foreground">
          <ProjectResolver />
        </div>
      </ProjectProvider>
    </Suspense>
  );
}
