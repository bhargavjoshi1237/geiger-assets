"use client";

import { toast } from "sonner";

import { deliveryUrl } from "@/lib/delivery/url";

// The one copy-link action for every asset surface — library rows, the folder
// explorer's file menu, the image detail header. Each of those used to build
// `window.location + ?asset=<id>` itself, which is the auth-gated workspace
// deep link: it reopens the library UI and serves nothing, so it 404s in an
// <img src> and bounces to /login in a private window.
//
// Delivery is opt-in per asset and /d/ 404s without delivery_enabled, so an
// asset that has not been switched on has no shareable link yet. Flipping the
// flag here would publish it as a side effect of "Copy link", so it doesn't.
export async function copyAssetLink(asset) {
  if (!asset?.deliveryEnabled) {
    toast.error("Turn on Delivery for this asset to get a shareable link.");
    return false;
  }

  const url = deliveryUrl(asset);
  if (!url) {
    toast.error("Couldn't build a link for this asset.");
    return false;
  }

  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied.");
    return true;
  } catch {
    toast.error("Couldn't copy to the clipboard.");
    return false;
  }
}
