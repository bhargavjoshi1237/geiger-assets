"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import { EditorEngine } from "./engine";

const noopSubscribe = () => () => {};
const nullSnapshot = () => null;

// Owns one EditorEngine per mounted stage. `hostRef` goes on an empty element
// the engine renders into; `pointerRef` on a span that shows cursor
// coordinates (written directly, so pointer moves never re-render React).
export function useImageEditor() {
  const [engine, setEngine] = useState(null);
  const pointerRef = useRef(null);

  const hostRef = useCallback((host) => {
    if (!host) return undefined;
    const next = new EditorEngine({
      host,
      onPointer: (x, y) => {
        const el = pointerRef.current;
        if (el) el.textContent = x == null ? "" : `${Math.round(x)}, ${Math.round(y)}`;
      },
    });
    setEngine(next);
    return () => {
      next.dispose();
      setEngine(null);
    };
  }, []);

  const state = useSyncExternalStore(
    engine ? engine.subscribe : noopSubscribe,
    engine ? engine.getSnapshot : nullSnapshot,
    nullSnapshot,
  );

  return { engine, state, hostRef, pointerRef };
}
