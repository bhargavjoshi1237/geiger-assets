import { createClient } from "@/lib/supabase/client";
import { isPlaygroundActive } from "@/lib/playground/mode";

export function isSupabaseConfigured() {
  // The landing playground serves an in-memory DB, so it never needs the env.
  if (isPlaygroundActive()) return true;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function assetsClient() {
  return isSupabaseConfigured() ? createClient().schema("assets") : null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_RE.test(String(value ?? ""));
}
