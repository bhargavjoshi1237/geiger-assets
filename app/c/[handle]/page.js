import { notFound } from "next/navigation";

import { CreatorPage } from "@/components/internal/screens/projects/creator/public/creator_page";
import { currentFan } from "@/lib/creator/fan_auth";
import {
  clientViewer,
  creatorDb,
  loadBundles,
  loadCreator,
  loadFeed,
  loadViewer,
  markSeen,
  paymentProviderName,
  previewViewer,
} from "@/lib/creator/server";
import { requireProjectAccess } from "@/lib/storage/auth";

export const dynamic = "force-dynamic";

/**
 * The builder's preview (?preview=1&as=guest|follower|lapsed|tier:<id>): the
 * draft layout, even while unpublished, seen as a stand-in fan. Only for
 * signed-in members of the creator's workspace project; anyone else gets the
 * live page.
 */
async function loadPreview(db, handle, preview) {
  if (preview !== "1") return null;
  const creator = await loadCreator(db, handle, { preview: true });
  if (!creator) return null;
  const access = await requireProjectAccess({ projectId: creator.profile.projectId });
  return access.response ? null : creator;
}

/**
 * A creator's public page. Every post's access is resolved here for the
 * signed-in fan before rendering, so locked bodies and media never reach the
 * browser — only a tiny blurred placeholder does.
 */
export default async function CreatorRoute({ params, searchParams }) {
  const { handle } = await params;
  const { tab, preview, as, promo, post, messages } = await searchParams;
  const db = await creatorDb();
  const draft = await loadPreview(db, handle, preview);
  const creator = draft || (await loadCreator(db, handle));
  if (!creator) notFound();

  const viewer = draft ? previewViewer(creator, as) : await loadViewer(db, creator.profile, await currentFan(db));
  const [feed, bundles] = await Promise.all([loadFeed(db, creator, viewer), loadBundles(db, creator, viewer)]);
  // Stamped after the page read lastSeenAt, so "new since your last visit" holds for this view.
  await markSeen(db, viewer);
  return (
    <CreatorPage
      creator={creator}
      viewer={clientViewer(viewer)}
      feed={feed}
      bundles={bundles}
      provider={paymentProviderName()}
      initialTab={tab}
      initialPromo={typeof promo === "string" ? promo.slice(0, 64) : ""}
      initialPost={typeof post === "string" ? post : ""}
      initialMessages={messages === "1"}
      preview={Boolean(draft)}
    />
  );
}

export async function generateMetadata({ params, searchParams }) {
  const { handle } = await params;
  const { preview } = await searchParams;
  // Previews never describe themselves — an unpublished page stays unannounced.
  if (preview === "1") return { title: "Preview", robots: { index: false, follow: false } };
  const creator = await loadCreator(await creatorDb(), handle);
  if (!creator) return { title: "Creator not found" };
  const { profile, avatar, banner, page } = creator;
  const image = banner?.thumbnailUrl || avatar?.thumbnailUrl;
  const title = page.seo.title || `${profile.displayName} (@${profile.handle})`;
  const description = page.seo.description || profile.tagline || profile.bio.slice(0, 160) || undefined;
  return {
    title,
    description,
    openGraph: { title: page.seo.title || profile.displayName, description, images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary" },
  };
}
