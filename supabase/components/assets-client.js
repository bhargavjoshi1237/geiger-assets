// Shared Supabase helpers for Geiger Assets.
//
// Build the client once, import it everywhere. Every data file in
// lib/supabase/* uses these instead of constructing a client ad hoc, so the
// schema scoping and the "is the DB configured?" guard live in one place.

import { createClient } from "@/lib/supabase/client";

// True only when both Supabase env vars are present. Guard every DB call with it
// so a missing env returns null/[]/false (the screen shows an empty state) rather
// than crashing — there is no static sample-data fallback.
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// Pre-guarded browser client pinned to this product's `assets` schema (null when
// unconfigured), so callers don't repeat the guard + createClient().schema()
// dance. Read the shared public tables (projects) through a plain createClient().
export function assetsClient() {
  return isSupabaseConfigured() ? createClient().schema("assets") : null;
}
