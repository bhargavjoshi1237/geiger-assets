"use client";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

// NEXT_PUBLIC_APP_URL already carries the basePath; the window fallback does
// not, so it has to be appended there or prod links lose the /assets prefix.
export function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return `${window.location.origin}${BASE}`;
  return "";
}

export function portalShareUrl(slug) {
  return slug ? `${appOrigin()}/u/${slug}` : "";
}

export function collectionShareUrl(id) {
  return id ? `${appOrigin()}/c/${id}` : "";
}
