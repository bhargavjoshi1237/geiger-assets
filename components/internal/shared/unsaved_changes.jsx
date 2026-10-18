"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@geiger/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

// Discard + Save pair for an EditorShell header. `children` renders before
// them (extra actions such as Download or Share).
export function EditorSaveActions({ dirty, saving, onSave, onDiscard, children }) {
  return (
    <>
      {dirty && onDiscard ? (
        <Button
          variant="ghost"
          className="text-text-secondary hover:text-foreground"
          onClick={onDiscard}
          disabled={saving}
        >
          Discard
        </Button>
      ) : null}
      {children}
      {onSave ? (
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {dirty ? "Save Changes" : "Saved"}
        </Button>
      ) : null}
    </>
  );
}

// Editor navigation guarded by an "Unsaved changes" prompt, plus Cmd/Ctrl+S
// and a beforeunload warning while `dirty`. `save` resolves true on success.
// `resetSection` drops ?section= on back, for editors whose parent opens them
// from local state rather than the URL.
export function useEditorGuard({
  dirty = false,
  saving = false,
  save,
  discard,
  onBack,
  name,
  resetSection = true,
}) {
  const { section, setSection } = useWorkspaceUrl();
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (!save) return undefined;
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const run = useCallback(
    (nav) => {
      if (!nav) return;
      if (nav.type === "back") {
        if (resetSection) setSection(null);
        onBack?.();
      } else {
        setSection(nav.key);
      }
    },
    [onBack, resetSection, setSection],
  );

  const guard = (nav) => {
    if (dirty) setPending(nav);
    else run(nav);
  };

  const discardPending = () => {
    const nav = pending;
    setPending(null);
    discard?.();
    run(nav);
  };

  const savePending = async () => {
    const nav = pending;
    setPending(null);
    if (await save?.()) run(nav);
  };

  const dialog = (
    <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>
            You have unsaved edits to{" "}
            <span className="font-medium text-foreground">{name || "this item"}</span>. Save
            them before leaving?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-text-secondary hover:text-foreground"
            onClick={() => setPending(null)}
          >
            Keep editing
          </Button>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={discardPending}
          >
            Discard
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={savePending}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    active: section,
    back: () => guard({ type: "back" }),
    selectSection: (key) => guard({ type: "section", key }),
    dialog,
  };
}
