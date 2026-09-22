"use client";

export function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function portalShareUrl(slug) {
  return slug ? `${appOrigin()}/u/${slug}` : "";
}

export function collectionShareUrl(id) {
  return id ? `${appOrigin()}/c/${id}` : "";
}
