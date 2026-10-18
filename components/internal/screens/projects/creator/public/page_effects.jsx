"use client";

// Visual layers the creator page composes from its document: a background
// image with a treatment (slow zoom, parallax, duotone…), a decorative effect
// layer (grain, grid, aurora, border beam…) and a scroll-in reveal. The CSS for
// every cp-fx-* / cp-media-* / data-cp-anim hook lives in page_theme.jsx.

import React, { useEffect, useRef, useState } from "react";
import { OVERLAY_OPTIONS } from "@/lib/creator/page_config";
import { cn } from "@/lib/utils";

export function overlayPct(value) {
  return OVERLAY_OPTIONS.find((o) => o.value === value)?.pct ?? 60;
}

/** An <img> with a media treatment — fills its (relative, overflow-hidden) parent. */
export function MediaImage({ src, effect = "none", className }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden className={cn("absolute inset-0 h-full w-full object-cover", effect !== "none" && `cp-media-${effect}`, className)} />
      {effect === "duotone" ? <span aria-hidden className="cp-duotone pointer-events-none absolute inset-0" /> : null}
    </>
  );
}

/** A background image + treatment + a theme-coloured dim so text stays readable. */
export function MediaLayer({ media, effect, overlay }) {
  if (!media?.thumbnailUrl) return null;
  const pct = overlayPct(overlay);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={media.color ? { backgroundColor: media.color } : undefined}>
      <MediaImage src={media.thumbnailUrl} effect={effect} />
      <span className="absolute inset-0" style={{ background: `color-mix(in oklab, var(--background) ${pct}%, transparent)` }} />
    </div>
  );
}

/** A decorative layer — sits under the content, over the background. */
export function EffectLayer({ effect }) {
  if (!effect || effect === "none") return null;
  return <span aria-hidden className={cn("pointer-events-none absolute inset-0", `cp-fx-${effect}`)} />;
}

/**
 * Reveals its children as they scroll into view. The hidden start state only
 * applies with scripting enabled and motion allowed (see page_theme.jsx), so
 * no-JS and reduced-motion visitors always see the content. `replayKey` re-runs
 * the entrance — the builder uses it so a newly picked animation plays in the
 * preview.
 */
export function Reveal({ animation, replayKey, className, children, ...rest }) {
  const ref = useRef(null);
  // The run that has been revealed — a new animation or replayKey starts hidden again.
  const run = `${animation}|${replayKey ?? ""}`;
  const [shown, setShown] = useState(null);
  const inView = shown === run;
  const active = animation && animation !== "none";

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(run);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active, run]);

  return (
    <div ref={ref} className={className} data-cp-anim={active ? animation : undefined} data-inview={active && inView ? "" : undefined} {...rest}>
      {children}
    </div>
  );
}
