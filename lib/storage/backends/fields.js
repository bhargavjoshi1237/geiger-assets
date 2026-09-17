// Field descriptors for the storage settings UI.
//
// Kept in its own module — with no node: imports and no server-only guard — so
// the settings screen can render the create/edit form straight from the catalog
// in the browser. lib/storage/backends/registry.js re-exports it for the server
// side, which is where drivers are actually built.
//
// A descriptor is `{ name, label, required?, placeholder?, type?, options?,
// default?, secret?, hint? }`. `type` is "boolean" (a switch) or "select" (with
// `options`); anything else is a text input. `secret` fields are write-only:
// a read answers with a `<name>Set` boolean instead of the value (see
// lib/storage/backends/secrets.js), and sending an empty value on an update
// means "leave the stored credential alone".

export const BACKEND_FIELDS = Object.freeze({
  s3: Object.freeze([
    { name: "endpoint", label: "Endpoint", required: true, placeholder: "https://s3.example.com" },
    { name: "region", label: "Region", required: false, placeholder: "auto" },
    { name: "bucket", label: "Bucket", required: true },
    { name: "accessKeyId", label: "Access key ID", required: true, secret: true },
    { name: "secretAccessKey", label: "Secret access key", required: true, secret: true },
    { name: "forcePathStyle", label: "Force path-style URLs", type: "boolean", default: true },
    { name: "presignedReads", label: "Supports presigned reads", type: "boolean", default: true },
    { name: "presignedUploads", label: "Supports presigned uploads", type: "boolean", default: true },
    {
      name: "cdnBaseUrl",
      label: "CDN origin (optional)",
      placeholder: "https://cdn.example.com",
      hint: "Derivatives redirect here instead of streaming through the app. CDN-served objects are not re-checked against project permissions, and their bytes are not metered.",
    },
  ]),
  rest: Object.freeze([
    { name: "baseUrl", label: "Base URL", required: true, placeholder: "https://files.internal/api" },
    { name: "authType", label: "Auth", type: "select", options: ["none", "bearer", "header", "basic"], default: "none" },
    { name: "token", label: "Bearer token", secret: true },
    { name: "headerName", label: "Header name", placeholder: "X-Api-Key" },
    { name: "authValue", label: "Header value", secret: true },
    { name: "username", label: "Username" },
    { name: "password", label: "Password", secret: true },
    { name: "uploadMethod", label: "Upload method", type: "select", options: ["PUT", "POST"], default: "PUT" },
    { name: "publicBaseUrl", label: "Public read URL", placeholder: "https://cdn.example.com" },
    {
      name: "cdnBaseUrl",
      label: "CDN origin (optional)",
      placeholder: "https://cdn.example.com",
      hint: "Defaults to the public read URL above. CDN-served objects are not re-checked against project permissions, and their bytes are not metered.",
    },
  ]),
});

// The kinds the catalog covers, in the order the UI should offer them.
export const BACKEND_FIELD_KINDS = Object.freeze(Object.keys(BACKEND_FIELDS));

// Which fields of a kind hold credentials. The screen uses it to decide what to
// render as "configured / replace" rather than as a plain input.
export function secretFieldNames(kind) {
  return (BACKEND_FIELDS[kind] || []).filter((f) => f.secret).map((f) => f.name);
}
