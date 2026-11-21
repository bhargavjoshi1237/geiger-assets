if (typeof window !== "undefined") {
  throw new Error("lib/storage/ssrf is server-only.");
}

// Guards for any URL this server fetches on a user's behalf — remote imports
// and webhook deliveries. A hostname is checked twice: by name here, and by
// every address it resolves to, so a public name pointing at a private range
// or the cloud metadata address is still refused.

import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data",
]);

function isPrivateIpv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  // IETF protocol assignments (192.0.0/24) and benchmarking (198.18/15).
  if (a === 192 && b === 0 && nums[2] === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  // Multicast (224/4) and reserved (240/4, which includes broadcast).
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(host) {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80")) return true;
  if (/^f[cd]/.test(h)) return true;

  const mapped = h.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
}

export function isBlockedHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }

  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) return true;
  if (host.includes(":") || host.startsWith("[")) return isPrivateIpv6(host);
  if (net.isIP(host) === 4) return isPrivateIpv4(host);
  return false;
}

function isPrivateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

export async function resolvesToPublicHost(hostname) {
  const host = String(hostname || "").replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (net.isIP(host)) return !isPrivateAddress(host);
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (!records.length) return false;
    return records.every((r) => !isPrivateAddress(r.address));
  } catch {
    return false;
  }
}
