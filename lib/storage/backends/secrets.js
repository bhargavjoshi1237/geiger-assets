if (typeof window !== "undefined") {
  throw new Error("lib/storage/backends is server-only.");
}

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

// Envelope encryption for backend credentials.
//
// Backend configs live in Postgres so an operator can add a provider without a
// deploy, which means long-lived S3 secret keys and REST bearer tokens would
// otherwise sit in plaintext in a table that several suite products can reach.
// Secret-valued fields are encrypted with AES-256-GCM before they are written
// and only decrypted when a driver is actually being constructed.
//
// The key comes from STORAGE_SECRET_KEY. Without it the store refuses to
// persist secrets at all rather than silently falling back to plaintext -- a
// quiet downgrade is exactly the failure an operator would never notice.

const SECRET_FIELDS = Object.freeze([
  "secretAccessKey",
  "accessKeyId",
  "token",
  "password",
  "authValue",
  "signingSecret",
]);

const PREFIX = "enc.v1.";

export function isSecretField(name) {
  return SECRET_FIELDS.includes(name);
}

export function hasSecretKey() {
  return Boolean(process.env.STORAGE_SECRET_KEY);
}

function key() {
  const raw = process.env.STORAGE_SECRET_KEY || "";
  if (!raw) return null;
  // Hashing accepts a passphrase of any length while still producing the exact
  // 32 bytes AES-256 requires; a raw env value would otherwise have to be
  // exactly 32 bytes to work at all.
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plain) {
  if (plain == null || plain === "") return "";
  const k = key();
  if (!k) {
    console.error("[storage.secrets] STORAGE_SECRET_KEY is not set; refusing to store a credential");
    return null;
  }
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", k, iv);
    const body = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, body]).toString("base64");
  } catch (e) {
    console.error("[storage.secrets.encrypt]", e?.message || e);
    return null;
  }
}

export function decryptSecret(stored) {
  if (typeof stored !== "string" || stored === "") return "";
  // Values written before a key was configured, or seeded by hand, are left
  // as-is so an operator can migrate incrementally instead of losing access.
  if (!stored.startsWith(PREFIX)) return stored;
  const k = key();
  if (!k) {
    console.error("[storage.secrets] STORAGE_SECRET_KEY is not set; cannot read a stored credential");
    return null;
  }
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const body = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch (e) {
    // A GCM tag mismatch means the key rotated or the row was tampered with.
    console.error("[storage.secrets.decrypt]", e?.message || e);
    return null;
  }
}

// Encrypts every secret-valued key in a config bag. Returns null if any field
// could not be encrypted, so a caller never persists a half-protected config.
export function encryptConfig(config) {
  const out = {};
  for (const [name, value] of Object.entries(config || {})) {
    if (!isSecretField(name) || value == null || value === "") {
      out[name] = value;
      continue;
    }
    const enc = encryptSecret(value);
    if (enc === null) return null;
    out[name] = enc;
  }
  return out;
}

export function decryptConfig(config) {
  const out = {};
  for (const [name, value] of Object.entries(config || {})) {
    out[name] = isSecretField(name) ? decryptSecret(value) : value;
  }
  return out;
}

// What the API is allowed to hand back. Secrets become a presence flag so the
// UI can render "configured" without the value ever leaving the server.
export function redactConfig(config) {
  const out = {};
  for (const [name, value] of Object.entries(config || {})) {
    if (isSecretField(name)) {
      if (value != null && value !== "") out[`${name}Set`] = true;
      continue;
    }
    out[name] = value;
  }
  return out;
}
