// Server-side Supabase client bound to the request's auth cookies.
//
// The browser client (./client.js) covers every client component, but route
// handlers and server actions need a cookie-aware client so reads run under the
// caller's session (and therefore their RLS). Use this only on the server.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Route handlers can refresh the session; ignore when called from a
          // context where cookies are read-only.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* read-only context — safe to ignore */
          }
        },
      },
    }
  );
}
