const RESERVED_SEGMENTS = new Set([
  "login",
  "logout",
  "signin",
  "signout",
  "signup",
  "register",
  "api",
  "_next",
  "org",
  "pallet",
  "project",
  "favicon.ico",
]);

export function isReservedSegment(segment) {
  return RESERVED_SEGMENTS.has(String(segment || "").toLowerCase());
}
