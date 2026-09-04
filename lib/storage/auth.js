if (typeof window !== "undefined") {
  throw new Error("lib/storage/auth is server-only.");
}

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/supabase/components/assets-client";

export async function storageAuth() {
  if (!isSupabaseConfigured()) {
    const supabase = await createServerSupabase().catch(() => null);
    return { supabase, userId: "dev", dev: true };
  }
  let supabase;
  try {
    supabase = await createServerSupabase();
  } catch (e) {
    console.error("[storage.auth]", e);
    return { response: NextResponse.json({ error: "auth_failed" }, { status: 500 }) };
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
    return { supabase, userId: user.id };
  } catch (e) {
    console.error("[storage.auth]", e);
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
}

export function forbidden(message = "forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}
