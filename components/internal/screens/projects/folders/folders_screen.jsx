"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { FolderPlus } from "lucide-react";
import { Button } from "@geiger/ui/button";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ScreenHeader, StatsBar } from "@/components/internal/shared/screen_kit";
import { FolderExplorer } from "@/components/internal/shared/folder_explorer";
import { formatBytes } from "./constants";
import { FolderDetailScreen } from "./folder_detail";

export function FoldersScreen({ projectId }) {
  const [folders, setFolders] = useState([]);
  const [openFolderId, setOpenFolderId] = useState(null);
  const explorerRef = useRef(null);

  const handleFoldersChange = useCallback((rows) => setFolders(rows), []);

  const handleFolderSaved = useCallback(
    (updated) =>
      setFolders((rows) => rows.map((f) => (f.id === updated.id ? { ...f, ...updated } : f))),
    [],
  );

  const stats = useMemo(() => {
    const totalBytes = folders.reduce((sum, f) => sum + (f.sizeBytes || 0), 0);
    const hot = folders.filter((f) => f.storageLocation === "hot").length;
    const cloud = folders.filter((f) => f.storageLocation?.startsWith("cloud")).length;
    return [
      { label: "Total Folders", value: String(folders.length), footer: "in this project" },
      { label: "Storage Used", value: formatBytes(totalBytes), footer: "across all folders" },
      { label: "Hot", value: String(hot), footer: "fast-access tier" },
      { label: "Cloud", value: String(cloud), footer: "object storage" },
    ];
  }, [folders]);

  if (openFolderId) {
    return (
      <FolderDetailScreen
        key={openFolderId}
        id={openFolderId}
        onBack={() => setOpenFolderId(null)}
        onChange={handleFolderSaved}
        projectId={projectId}
      />
    );
  }

  return (
    <MainScreenWrapper className="flex min-h-full flex-col space-y-6">
      <ScreenHeader
        className="shrink-0"
        title="Folders & Storage"
        description="Browse the whole tree, reorganize by drag, and control where source files live."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => explorerRef.current?.startCreate()}
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </Button>
        }
      />

      <StatsBar stats={stats} className="shrink-0" />

      <FolderExplorer
        ref={explorerRef}
        projectId={projectId}
        onFoldersChange={handleFoldersChange}
        onOpenDetails={(folder) => setOpenFolderId(folder.id)}
        className="min-h-[24rem] flex-1 rounded-xl border border-border bg-surface-subtle p-3"
      />
    </MainScreenWrapper>
  );
}

export default FoldersScreen;
