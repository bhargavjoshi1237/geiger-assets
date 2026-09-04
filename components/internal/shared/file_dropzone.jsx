"use client";

import { useCallback, useId, useRef, useState } from "react";
import { cn, uniqueId } from "@/lib/utils";

export { uniqueId };

export function FileDropzone({
  onFiles,
  accept,
  multiple = true,
  disabled = false,
  className,
  children,
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const depthRef = useRef(0);

  const emit = useCallback(
    (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length && typeof onFiles === "function") onFiles(files);
    },
    [onFiles],
  );

  const resetDrag = useCallback(() => {
    depthRef.current = 0;
    setDragging(false);
  }, []);

  const handleDragEnter = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    depthRef.current += 1;
    setDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setDragging(false);
  }, [disabled]);

  const handleDragOver = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = "copy";
    } catch {
      /* non-file drags may not expose dataTransfer */
    }
  }, [disabled]);

  const handleDrop = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    resetDrag();
    emit(e.dataTransfer ? e.dataTransfer.files : null);
  }, [disabled, emit, resetDrag]);

  const handleInputChange = useCallback((e) => {
    emit(e.target.files);
    e.target.value = "";
  }, [emit]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-dragging={dragging}
      className={cn(className)}
    >
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={handleInputChange}
      />
      {typeof children === "function"
        ? children({ browseId: inputId, dragging })
        : children}
    </div>
  );
}
