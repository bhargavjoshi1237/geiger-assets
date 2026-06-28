import { redirect } from "next/navigation";

import ClientAssetsPlayground from "@/components/ClientAssetsPlayground";
import { createServerSupabase } from "@/lib/supabase/server";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const dashOrigin = (process.env.NEXT_PUBLIC_DASH_ORIGIN || "").replace(/\/$/, "");

// Only enforce the auth guard when the suite is actually wired up — a configured
// parent login (DASH_ORIGIN) and Supabase env. Standalone/local dev (no suite)
// renders normally instead of redirect-looping to a login that isn't there.
const guardEnabled = Boolean(
  dashOrigin &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default async function AssetsProjectPage({ params }) {
  const { projectId } = await params;

  if (guardEnabled) {
    // Read the running session from the shared parent cookie. getUser() validates
    // the JWT against the auth server, so it's a trustworthy gate (unlike getSession).
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const nextPath = `${basePath}/${projectId}`;
      redirect(`${dashOrigin}/login?next=${encodeURIComponent(nextPath)}`);
    }
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background">
      <ClientAssetsPlayground projectId={projectId} />
    </div>
  );
}
