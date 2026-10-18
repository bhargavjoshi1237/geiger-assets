"use client";

import { isPlaygroundActive } from "@/lib/playground/mode";

// Browser half of the Google Drive link. The server keeps the refresh token
// (lib/integrations/google_server.js); here we read the link status, mint a
// short-lived access token, open Google's Picker and download what was picked
// so it can go through the normal uploadAsset() pipeline.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
const GAPI_SRC = "https://apis.google.com/js/api.js";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";

export const DRIVE_ERROR_MESSAGES = {
  connected: "Google Drive connected.",
  denied: "Google Drive access was declined.",
  unauthorized: "You're signed out — sign in and try again.",
  not_configured: "Google Drive isn't configured on the server.",
  misconfigured: "Google rejected the app's credentials — check GOOGLE_CLIENT_SECRET.",
  not_connected: "Google Drive is disconnected — connect it again.",
  failed: "Couldn't connect Google Drive — try again.",
  unsupported_type: "That Drive item can't be imported.",
  download_failed: "Couldn't download that file from Drive.",
};

// Google-native files have no bytes of their own; export them to a portable
// format instead. Anything not listed here (folders, forms, sites…) is skipped.
const EXPORTS = {
  "application/vnd.google-apps.document": { mimeType: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.spreadsheet": { mimeType: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.presentation": { mimeType: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.drawing": { mimeType: "image/png", ext: "png" },
};

export function isDriveAvailable() {
  return Boolean(API_KEY && APP_ID) && !isPlaygroundActive();
}

export async function getDriveStatus() {
  if (!isDriveAvailable()) return { configured: false, connected: false };
  try {
    const res = await fetch(`${BASE}/api/integrations/google`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("[drive.status]", e);
    return null;
  }
}

// Full-page hop through Google's consent screen; the callback lands the user
// back on the current screen with ?drive=<outcome>.
export function connectDrive() {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(
    `${BASE}/api/integrations/google/connect?returnTo=${encodeURIComponent(returnTo)}`,
  );
}

export async function disconnectDrive() {
  try {
    const res = await fetch(`${BASE}/api/integrations/google`, { method: "DELETE" });
    return res.ok;
  } catch (e) {
    console.error("[drive.disconnect]", e);
    return false;
  }
}

// Returns { accessToken } or { error } (see DRIVE_ERROR_MESSAGES).
export async function getDriveAccessToken() {
  try {
    const res = await fetch(`${BASE}/api/integrations/google/token`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: data?.error || "failed" };
    return { accessToken: data.accessToken };
  } catch (e) {
    console.error("[drive.token]", e);
    return { error: "failed" };
  }
}

let pickerReady = null;

function loadPicker() {
  if (pickerReady) return pickerReady;
  pickerReady = new Promise((resolve, reject) => {
    const onGapi = () => window.gapi.load("picker", { callback: resolve, onerror: reject });
    if (window.gapi) return onGapi();
    const script = document.createElement("script");
    script.src = GAPI_SRC;
    script.async = true;
    script.onload = onGapi;
    script.onerror = reject;
    document.head.appendChild(script);
  }).catch((e) => {
    pickerReady = null;
    throw e;
  });
  return pickerReady;
}

// Opens Google's Picker and resolves to the picked files ([] on cancel).
// Picking is also what grants the drive.file scope access to each file.
export async function pickDriveFiles(accessToken) {
  await loadPicker();
  const { picker } = window.google;
  return new Promise((resolve) => {
    // Without a parent, a folder-including view flattens every folder in the
    // Drive into one list; rooting it at "root" browses like Drive's home.
    const myDrive = new picker.DocsView(picker.ViewId.DOCS)
      .setParent("root")
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMode(picker.DocsViewMode.LIST);
    const sharedDrives = new picker.DocsView(picker.ViewId.DOCS)
      .setEnableDrives(true)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    new picker.PickerBuilder()
      .setAppId(APP_ID)
      .setDeveloperKey(API_KEY)
      .setOAuthToken(accessToken)
      .addView(myDrive)
      .addView(sharedDrives)
      .addView(picker.ViewId.RECENTLY_PICKED)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .enableFeature(picker.Feature.SUPPORT_DRIVES)
      .setTitle("Import from Google Drive")
      .setCallback((data) => {
        const action = data[picker.Response.ACTION];
        if (action === picker.Action.CANCEL) resolve([]);
        if (action !== picker.Action.PICKED) return;
        resolve(
          (data[picker.Response.DOCUMENTS] || []).map((doc) => ({
            id: doc[picker.Document.ID],
            name: doc[picker.Document.NAME] || "Untitled",
            mimeType: doc[picker.Document.MIME_TYPE] || "",
            sizeBytes: Number(doc.sizeBytes || 0),
            url: doc[picker.Document.URL] || "",
          })),
        );
      })
      .build()
      .setVisible(true);
  });
}

export function driveFileType(mimeType) {
  const mime = String(mimeType || "");
  if (mime.startsWith("image/") || mime === "application/vnd.google-apps.drawing") return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

export function driveFilename(file) {
  const exported = EXPORTS[file.mimeType];
  if (!exported || file.name.toLowerCase().endsWith(`.${exported.ext}`)) return file.name;
  return `${file.name}.${exported.ext}`;
}

// Downloads a picked file into a File ready for uploadAsset().
// Returns { file } or { error }.
export async function downloadDriveFile(file, accessToken, { signal } = {}) {
  const isNative = file.mimeType.startsWith("application/vnd.google-apps.");
  const exported = EXPORTS[file.mimeType];
  if (isNative && !exported) return { error: "unsupported_type" };

  const id = encodeURIComponent(file.id);
  const url = exported
    ? `${DRIVE_FILES}/${id}/export?mimeType=${encodeURIComponent(exported.mimeType)}`
    : `${DRIVE_FILES}/${id}?alt=media&supportsAllDrives=true`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal });
    if (!res.ok) {
      console.error("[drive.download]", res.status);
      return { error: res.status === 401 ? "not_connected" : "download_failed" };
    }
    const blob = await res.blob();
    const type = exported?.mimeType || blob.type || file.mimeType || "application/octet-stream";
    return { file: new File([blob], driveFilename(file), { type }) };
  } catch (e) {
    if (e?.name === "AbortError") return { error: "cancelled" };
    console.error("[drive.download]", e);
    return { error: "download_failed" };
  }
}
