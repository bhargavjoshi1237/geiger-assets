import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { GalleryView } from "@/components/internal/screens/projects/galleries/public/gallery_view";
import { GalleryPasswordForm } from "@/components/internal/screens/projects/galleries/public/gallery_password_form";
import {
  accessProblem,
  loadGalleryAssets,
  loadGalleryBySlug,
  unlockCookieName,
} from "@/lib/supabase/gallery_server";

/**
 * Public page for a published gallery.
 *
 * Access is resolved here, on the server, before any content is rendered: a
 * private, unpublished or expired gallery 404s, and a password-protected one
 * renders only the gate until the unlock route has set its cookie. The password
 * itself is never sent to the browser.
 */
export default async function GalleryPage({ params }) {
  const { slug } = await params;
  const resolved = await loadGalleryBySlug(slug);
  const gallery = resolved?.gallery;
  if (!gallery) notFound();

  const jar = await cookies();
  const unlocked = jar.get(unlockCookieName(gallery.id))?.value === "1";
  const problem = accessProblem(gallery, { unlocked });

  if (problem === "password") {
    return <GalleryPasswordForm slug={slug} name={gallery.name} />;
  }
  // Private, unpublished and expired galleries are indistinguishable from a
  // missing one, so a guessed slug reveals nothing about what exists.
  if (problem) notFound();

  const items = await loadGalleryAssets(gallery);
  return <GalleryView gallery={gallery} items={items} />;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const resolved = await loadGalleryBySlug(slug);
  const gallery = resolved?.gallery;
  if (!gallery) return { title: "Gallery not found" };

  const indexable = gallery.visibility === "public" && gallery.status === "published";
  return {
    title: gallery.seo?.title || gallery.name || "Gallery",
    description: gallery.seo?.description || gallery.headline || undefined,
    // Unlisted and private galleries stay out of search results regardless of
    // what the SEO tab says.
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: {
      title: gallery.seo?.title || gallery.name,
      description: gallery.seo?.description || gallery.headline || undefined,
      images: gallery.seo?.ogImage ? [gallery.seo.ogImage] : undefined,
    },
  };
}
