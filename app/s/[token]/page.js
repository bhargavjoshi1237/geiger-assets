import { SharedLinkView } from "@/components/internal/screens/projects/collaboration/shared_link_view";

export const metadata = {
  title: "Shared with you - Geiger Assets",
  description: "View assets shared from a Geiger Assets workspace.",
};

/**
 * Public recipient page for a shared link.
 *
 * Read-only stub: it resolves the token, bumps the view counter, and lists what
 * the link points at. Password gating, download controls, and email capture are
 * NOT enforced here yet — the link's settings are displayed but not applied.
 * Wire a server-side password check before treating this page as protection.
 */
export default async function SharedLinkPage({ params }) {
  const { token } = await params;
  return <SharedLinkView token={token} />;
}
