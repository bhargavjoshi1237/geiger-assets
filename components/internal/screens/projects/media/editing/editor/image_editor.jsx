"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FolderOpen, Image as ImageIcon, ImageOff, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@geiger/ui/button";
import { LogoLoading } from "@geiger/ui";
import { TooltipProvider } from "@geiger/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@geiger/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";

import { TOOL_BY_SHORTCUT, TOOLS, baseName, formatZoom } from "../constants";
import { decodeImage } from "./engine";
import { useImageEditor } from "./use_image_editor";
import { EditorTopBar } from "./top_bar";
import { ToolRail } from "./tool_rail";
import { OptionsBar } from "./options_bar";
import { PropertiesPanel } from "./properties_panel";
import { LayersDock } from "./layers_dock";
import { ImagePickerDialog } from "./image_picker_dialog";
import { SaveDialog } from "./save_dialog";

const TYPING_TARGET = "input, textarea, select, [contenteditable='true'], [role='dialog']";
// Keys these controls already use (Space/Enter activate, arrows move a slider).
const INTERACTIVE_TARGET =
  "button, a[href], [role='button'], [role='menuitem'], [role='tab'], [role='slider'], [role='switch'], [role='checkbox'], [role='option'], [role='combobox'], [role='menu']";
const CONTROL_KEYS = new Set([" ", "enter", "escape", "arrowleft", "arrowright", "arrowup", "arrowdown", "delete", "backspace"]);

function slugify(name) {
  return (
    String(name || "image")
      .normalize("NFKD")
      .replace(/[^\w\s.-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "image"
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function hasImageFile(dataTransfer) {
  return Array.from(dataTransfer?.items || []).some((i) => i.kind === "file" && i.type.startsWith("image/"));
}

// Photoshop-style editor surface: top bar, tool rail + options bar, canvas
// stage, Properties and Layers/History/Variants panels, status bar. The screen
// owns data (which image, saving to the library); this component owns editing.
export function ImageEditor({
  source,
  assets,
  assetsLoading,
  assetImageUrl,
  onOpenAsset,
  onOpenFile,
  onSaveAsset,
  onSaveVersion,
  variants,
  variantsLoading,
  onGoToLibrary,
}) {
  const { engine, state, hostRef, pointerRef } = useImageEditor();
  const [loaded, setLoaded] = useState({ key: null, error: false });
  const [preview, setPreview] = useState({ key: null, url: null, status: "loading" });
  const [picker, setPicker] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [panelsOpen, setPanelsOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [dropping, setDropping] = useState(false);

  // Latest source for the loader, so a refreshed asset row (new etag after a
  // version save) doesn't reload the canvas and wipe the working layers.
  const sourceRef = useRef(source);
  useLayoutEffect(() => {
    sourceRef.current = source;
  });

  const sourceKey = source?.key ?? null;
  useEffect(() => {
    if (!engine || !sourceKey) return undefined;
    const ctrl = new AbortController();
    (async () => {
      const s = sourceRef.current;
      let decoded = await decodeImage(s.url, { signal: ctrl.signal });
      if (!decoded && s.fallbackUrl && s.fallbackUrl !== s.url && !ctrl.signal.aborted) {
        decoded = await decodeImage(s.fallbackUrl, { signal: ctrl.signal });
      }
      if (ctrl.signal.aborted) return;
      if (!decoded) {
        setLoaded({ key: sourceKey, error: true });
        return;
      }
      await engine.load(decoded);
      setLoaded({ key: sourceKey, error: false });
    })();
    return () => ctrl.abort();
  }, [engine, sourceKey]);

  const loadingImage = Boolean(source) && loaded.key !== sourceKey;
  const loadFailed = Boolean(source) && loaded.key === sourceKey && loaded.error;
  const previewUrl = source?.fallbackUrl || source?.thumbnailUrl || source?.url;
  const previewStatus = preview.key === sourceKey && preview.url === previewUrl ? preview.status : "loading";
  const ready = Boolean(state?.ready) && !loadingImage && !loadFailed;
  const dialogsOpen = Boolean(picker) || saveOpen || Boolean(pending);

  // Guard anything that would replace the working image.
  const guarded = (action) => {
    if (state?.dirty) setPending(action);
    else action.run();
  };

  const openAsset = (asset) => {
    setPicker(null);
    if (asset.id === source?.assetId) return;
    guarded({ label: asset.name, run: () => onOpenAsset(asset) });
  };

  const openFile = (file) => {
    setPicker(null);
    guarded({ label: file.name, run: () => onOpenFile(file) });
  };

  const placeAsset = async (asset) => {
    setPicker(null);
    const ok = await engine?.placeImage(assetImageUrl(asset), baseName(asset.name));
    if (!ok) toast.error(`Couldn't place ${asset.name}.`);
  };

  const placeFile = async (file) => {
    setPicker(null);
    const ok = await engine?.placeFile(file);
    if (!ok) toast.error("That file isn't an image we can place.");
  };

  const handleSave = async (opts) => {
    if (!engine || saving) return;
    setSaving(true);
    const blob = await engine.exportBlob({ type: opts.type, quality: opts.quality, width: opts.width, height: opts.height });
    if (!blob) {
      setSaving(false);
      toast.error("Couldn't render the image — try a smaller size.");
      return;
    }
    const name = opts.target === "asset" ? opts.name : `${baseName(source?.name)} (edited)`;
    const file = new File([blob], `${slugify(name)}.${opts.ext}`, { type: opts.type });
    let ok = false;
    if (opts.target === "download") {
      downloadBlob(blob, file.name);
      toast.success(`Downloaded ${file.name}`);
      ok = true;
    } else if (opts.target === "version") {
      ok = await onSaveVersion({ file });
    } else {
      ok = await onSaveAsset({ file, name });
    }
    setSaving(false);
    if (!ok) return;
    if (opts.target !== "download") engine.markSaved();
    setSaveOpen(false);
  };

  // Keyboard shortcuts (Photoshop-flavoured). Skipped while typing or in dialogs.
  useEffect(() => {
    if (!engine) return undefined;
    const onKeyDown = (e) => {
      if (!engine.ready || dialogsOpen) return;
      if (e.target instanceof Element && e.target.closest(TYPING_TARGET)) return;
      if (engine.isEditingText()) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod) {
        const handled = {
          z: () => (e.shiftKey ? engine.redo() : engine.undo()),
          y: () => engine.redo(),
          s: () => setSaveOpen(true),
          j: () => engine.duplicate(),
          0: () => engine.fit(),
          1: () => engine.zoomTo(1),
          "=": () => engine.zoomStep(1),
          "+": () => engine.zoomStep(1),
          "-": () => engine.zoomStep(-1),
          "]": () => engine.reorder(null, "up"),
          "[": () => engine.reorder(null, "down"),
        }[key];
        if (handled) {
          e.preventDefault();
          handled();
        }
        return;
      }
      if (e.altKey) return;
      if (CONTROL_KEYS.has(key) && e.target instanceof Element && e.target.closest(INTERACTIVE_TARGET)) return;

      if (key === " ") {
        e.preventDefault();
        if (!e.repeat) engine.setSpaceHeld(true);
        return;
      }
      if (key === "\\") {
        e.preventDefault();
        engine.setComparing(true);
        return;
      }
      if (key === "delete" || key === "backspace") {
        e.preventDefault();
        engine.removeActive();
        return;
      }
      if (key === "escape") {
        if (engine.cropRect) engine.cancelCrop();
        else engine.select(null);
        return;
      }
      if (key === "enter" && engine.cropRect) {
        e.preventDefault();
        engine.applyCrop();
        return;
      }
      const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key];
      if (arrows) {
        const step = e.shiftKey ? 10 : 1;
        if (engine.nudge(arrows[0] * step, arrows[1] * step)) e.preventDefault();
        return;
      }
      if (!e.shiftKey && TOOL_BY_SHORTCUT[key]) {
        e.preventDefault();
        engine.setTool(TOOL_BY_SHORTCUT[key]);
      }
    };
    const onKeyUp = (e) => {
      if (e.key === " ") engine.setSpaceHeld(false);
      if (e.key === "\\") engine.setComparing(false);
    };
    const onBlur = () => {
      engine.setSpaceHeld(false);
      engine.setComparing(false);
    };
    const onPaste = (e) => {
      if (!engine.ready || dialogsOpen) return;
      if (e.target instanceof Element && e.target.closest(TYPING_TARGET)) return;
      const file = Array.from(e.clipboardData?.files || []).find((f) => f.type.startsWith("image/"));
      if (!file) return;
      e.preventDefault();
      engine.placeFile(file).then((ok) => ok && toast.success("Pasted as a new layer."));
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("paste", onPaste);
    };
  }, [engine, dialogsOpen]);

  // Browser-level guard while there are unsaved edits.
  useEffect(() => {
    if (!state?.dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state?.dirty]);

  const toolHint = TOOLS.find((t) => t.value === state?.tool)?.hint;
  const panels = (
    <>
      <PropertiesPanel
        state={ready ? state : null}
        engine={engine}
        sourceKey={loaded.key}
        onPlaceFromLibrary={() => setPicker("place")}
      />
      <LayersDock
        state={ready ? state : null}
        engine={engine}
        onPlace={() => setPicker("place")}
        variants={variants}
        variantsLoading={variantsLoading}
        currentId={source?.assetId}
        canHaveVariants={Boolean(source?.assetId)}
        onOpenVariant={(id) => {
          const asset = assets.find((a) => a.id === id) ?? { id, name: "variant" };
          openAsset(asset);
        }}
        className="h-[44%] min-h-[240px] shrink-0 border-t border-border"
      />
    </>
  );

  let stageMessage = null;
  if (assetsLoading || loadingImage) {
    stageMessage = <LogoLoading size={72} aria-label="Loading image" />;
  } else if (loadFailed && previewUrl && previewStatus !== "error") {
    stageMessage = (
      <div className="relative flex h-full w-full items-center justify-center p-6">
        {/* An external image can display in an img element even when the browser
            won't let the canvas read its pixels. Keep the preview visible. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${sourceKey}:${previewUrl}`}
          src={previewUrl}
          alt={source?.name || "Selected image"}
          className={cn("max-h-full max-w-full object-contain", previewStatus !== "loaded" && "opacity-0")}
          onLoad={() => setPreview({ key: sourceKey, url: previewUrl, status: "loaded" })}
          onError={() => setPreview({ key: sourceKey, url: previewUrl, status: "error" })}
        />
        {previewStatus === "loading" ? <LogoLoading size={72} aria-label="Loading preview" className="absolute" /> : null}
        {previewStatus === "loaded" ? (
          <div className="absolute bottom-4 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-surface-subtle/95 px-3 py-2 text-xs text-text-secondary shadow-lg">
            <span>Preview only — open a local copy to edit this image.</span>
            <Button variant="outline" size="sm" className="shrink-0 border-border bg-transparent" onClick={() => setPicker("open")}>Open image</Button>
          </div>
        ) : null}
      </div>
    );
  } else if (loadFailed) {
    stageMessage = (
      <EmptyState
        icon={ImageOff}
        title="Couldn't load this image"
        description="The file may be missing from storage or in a format the browser can't decode."
        action={
          <Button variant="outline" className="border-border bg-transparent" onClick={() => setPicker("open")}>
            <FolderOpen className="h-4 w-4" /> Choose another image
          </Button>
        }
      />
    );
  } else if (!source) {
    stageMessage = (
      <EmptyState
        icon={ImageIcon}
        title={assets.length ? "Open an image to start editing" : "No images yet"}
        description={
          assets.length
            ? "Pick an image from this project, or open one from your computer."
            : "Upload images in the Asset Library, or open one from your computer to edit it here."
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {assets.length ? (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setPicker("open")}>
                <FolderOpen className="h-4 w-4" /> Open image
              </Button>
            ) : (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onGoToLibrary}>
                Go to Asset Library
              </Button>
            )}
            <Button variant="outline" className="border-border bg-transparent" onClick={() => setPicker("open")}>
              <Upload className="h-4 w-4" /> From computer
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-full min-h-[560px] flex-col overflow-hidden rounded-xl border border-border bg-surface-subtle">
        <EditorTopBar
          state={ready ? state : null}
          engine={engine}
          source={source}
          saving={saving}
          onOpenPicker={() => setPicker("open")}
          onSave={() => setSaveOpen(true)}
          onDownload={() => setSaveOpen("download")}
          onOpenPanels={() => setPanelsOpen(true)}
        />
        <div className="flex min-h-0 flex-1">
          <ToolRail state={ready ? state : null} engine={engine} />
          <div className="flex min-w-0 flex-1 flex-col">
            <OptionsBar state={ready ? state : null} engine={engine} />
            <div
              className="relative min-h-0 flex-1 bg-background"
              onDragOver={(e) => {
                if (!ready || !hasImageFile(e.dataTransfer)) return;
                e.preventDefault();
                setDropping(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDropping(false);
              }}
              onDrop={(e) => {
                setDropping(false);
                const file = Array.from(e.dataTransfer?.files || []).find((f) => f.type.startsWith("image/"));
                if (!ready || !file) return;
                e.preventDefault();
                placeFile(file);
              }}
            >
              <div ref={hostRef} className={cn("absolute inset-0 overflow-hidden", !ready && "invisible")} />
              {stageMessage ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background">{stageMessage}</div>
              ) : null}
              {dropping ? (
                <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-xl border-2 border-dashed border-border-strong bg-background/70 text-sm font-medium text-foreground backdrop-blur-sm">
                  Drop to place as a new layer
                </div>
              ) : null}
            </div>
          </div>
          <aside className="hidden w-[300px] shrink-0 flex-col border-l border-border lg:flex xl:w-[320px]">{panels}</aside>
        </div>
        <div className="flex h-8 shrink-0 items-center gap-4 border-t border-border px-3 text-[11px] text-text-tertiary">
          {ready ? (
            <>
              <span className="font-mono tabular-nums">
                {state.doc.width} × {state.doc.height} px
              </span>
              <span className="font-mono tabular-nums">{formatZoom(state.zoom)}</span>
              <span ref={pointerRef} className="hidden min-w-[72px] font-mono tabular-nums sm:inline" />
              <span className="hidden min-w-0 flex-1 truncate md:inline">{toolHint}</span>
              {state.source && state.source.scale < 1 ? (
                <span className="ml-auto hidden shrink-0 lg:inline">
                  Working copy · source {state.source.width} × {state.source.height}
                </span>
              ) : null}
              <span className={cn("shrink-0", !(state.source && state.source.scale < 1) && "ml-auto")}>
                {state.dirty ? (
                  <span className="text-amber-700 dark:text-amber-400">● Unsaved</span>
                ) : state.edited ? (
                  "Saved"
                ) : (
                  "No edits"
                )}
              </span>
            </>
          ) : (
            <span>{assetsLoading ? "Loading images…" : "Ready"}</span>
          )}
        </div>
      </div>

      <Sheet open={panelsOpen} onOpenChange={setPanelsOpen}>
        <SheetContent side="right" className="flex w-[320px] flex-col gap-0 bg-surface-subtle p-0 sm:max-w-[320px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Editor panels</SheetTitle>
          </SheetHeader>
          {panels}
        </SheetContent>
      </Sheet>

      <ImagePickerDialog
        open={Boolean(picker)}
        onOpenChange={(open) => !open && setPicker(null)}
        mode={picker || "open"}
        assets={assets}
        currentId={source?.assetId}
        onPick={picker === "place" ? placeAsset : openAsset}
        onPickFile={picker === "place" ? placeFile : openFile}
      />

      <SaveDialog
        open={Boolean(saveOpen)}
        onOpenChange={(open) => setSaveOpen(open)}
        busy={saving}
        initialTarget={saveOpen === "download" ? "download" : "asset"}
        doc={state?.doc ?? { width: 1, height: 1 }}
        source={state?.source}
        sourceName={source?.name}
        canVersion={Boolean(source?.assetId)}
        onConfirm={handleSave}
      />

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard unsaved edits?</DialogTitle>
            <DialogDescription>
              Opening <span className="font-medium text-foreground">{pending?.label}</span> replaces the current canvas. Your edits to{" "}
              <span className="font-medium text-foreground">{source?.name}</span> haven&apos;t been saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="text-text-secondary hover:text-foreground" onClick={() => setPending(null)}>
              Keep editing
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                const action = pending;
                setPending(null);
                action?.run();
              }}
            >
              Discard & open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

export default ImageEditor;
