// Playground mode: while the landing-page playground is mounted, the data layer
// is served by an in-memory, seeded copy of this app's schema instead of the
// real database, storage and API routes.
//
// It is a module-level switch rather than React context because the data layer
// (lib/supabase/*) is plain functions, not hooks. Keep this file tiny and
// framework-free: lib/supabase/client.js imports it, so it ships in the real
// workspace bundle, while the seed and the fake client are registered by the
// playground itself and never do. See ./use_playground_mode.js.

// The one project the playground workspace opens. Every seeded row belongs to
// it, and ProjectProvider's preview mode opens it without a fetch.
export const PLAYGROUND_PROJECT = {
  id: "a55e7000-0000-4000-8000-000000000001",
  name: "Halcyon Brand Library",
  slug: "halcyon-brand-library",
  description: "Halcyon Studio's brand library — client campaigns, product and press.",
  organization_id: null,
  dam_project_id: null,
};

let activeCount = 0;
let handlers = null;

export function isPlaygroundActive() {
  return activeCount > 0 && handlers !== null;
}

/**
 * The playground's stand-in for a data-layer primitive (`createClient`,
 * `uploadFile`, …), or null outside the playground so the caller falls through
 * to its real implementation.
 */
export function playgroundHandler(name) {
  return isPlaygroundActive() ? handlers[name] ?? null : null;
}

/** Turn playground mode on; returns the matching "off" for cleanup. */
export function enterPlayground(nextHandlers) {
  handlers = nextHandlers;
  activeCount += 1;
  return () => {
    activeCount = Math.max(0, activeCount - 1);
    if (activeCount === 0) handlers = null;
  };
}
