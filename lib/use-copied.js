"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useCopied(duration = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = useCallback(() => {
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), duration);
  }, [duration]);

  return [copied, flash];
}
