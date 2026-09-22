const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const dashOrigin = (process.env.NEXT_PUBLIC_DASH_ORIGIN || "").replace(/\/$/, "");

const PRODUCT_ROUTE = (basePath || "/assets").replace(/^\//, "");

export function suiteLoginHref() {
  return `${dashOrigin}/login?next=${encodeURIComponent(PRODUCT_ROUTE)}`;
}

export function goToSuiteLogin() {
  window.location.replace(suiteLoginHref());
}

export function suiteHref(path) {
  const suffix = String(path || "").startsWith("/") ? path : `/${path || ""}`;
  return `${dashOrigin}${suffix}`;
}
