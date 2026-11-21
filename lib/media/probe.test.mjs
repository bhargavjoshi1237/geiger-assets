import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { probeFile, typeMismatch } from "./probe.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const EXE_HEAD = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(62)]);
const PDF_HEAD = Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "latin1");
const DOCX_HEAD = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.alloc(26),
  Buffer.from("[Content_Types].xml word/document.xml"),
]);

test("detects formats from their bytes, not the caller's claim", async () => {
  assert.equal((await probeFile(PNG, { contentType: "video/mp4", filename: "x.mp4" })).detectedMime, "image/png");
  assert.equal((await probeFile(JPEG_HEAD)).detectedMime, "image/jpeg");
  assert.equal((await probeFile(PDF_HEAD)).detectedMime, "application/pdf");
  assert.equal((await probeFile(EXE_HEAD)).detectedMime, "application/x-msdownload");
  assert.equal(
    (await probeFile(DOCX_HEAD)).detectedMime,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.equal((await probeFile(Buffer.from('<?xml version="1.0"?>\n<svg xmlns="x"/>'))).detectedMime, "image/svg+xml");
});

test("reads raster dimensions through sharp", async () => {
  const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#000" } }).png().toBuffer();
  const probe = await probeFile(png);
  assert.equal(probe.width, 40);
  assert.equal(probe.height, 30);
});

test("never throws on junk and returns null for unknown bytes", async () => {
  assert.equal(await probeFile(Buffer.from("just some plain text")), null);
  assert.equal(await probeFile(Buffer.alloc(0)), null);
  assert.equal(await probeFile("not a buffer"), null);
  assert.equal(await probeFile(null), null);
});

test("flags a renamed executable declared as an image", async () => {
  const probe = await probeFile(EXE_HEAD);
  assert.match(typeMismatch(probe, { contentType: "image/png", filename: "cat.png" }), /bytes are application\/x-msdownload/);
  // Even with a generic declared type, the filename is still a claim.
  assert.match(typeMismatch(probe, { contentType: "application/octet-stream", filename: "cat.png" }), /suggests/);
});

test("flags a PDF dressed up as a JPEG", async () => {
  const probe = await probeFile(PDF_HEAD);
  assert.ok(typeMismatch(probe, { contentType: "image/jpeg", filename: "scan.jpg" }));
});

test("accepts honest uploads and harmless variations", async () => {
  const png = await probeFile(PNG);
  assert.equal(typeMismatch(png, { contentType: "image/png", filename: "a.png" }), null);
  // Browsers that can't sniff send an empty or generic type — not a claim.
  assert.equal(typeMismatch(png, { contentType: "", filename: "a.png" }), null);
  assert.equal(typeMismatch(png, { contentType: "application/octet-stream", filename: "a.png" }), null);
  // Same kind under the wrong extension is a mislabel, not a spoof.
  assert.equal(typeMismatch(png, { contentType: "", filename: "a.jpg" }), null);
  // Alias spellings are equivalent.
  const jpeg = await probeFile(JPEG_HEAD);
  assert.equal(typeMismatch(jpeg, { contentType: "image/jpg", filename: "a.jpeg" }), null);
  // A docx is a zip, so naming it .zip is fine.
  const docx = await probeFile(DOCX_HEAD);
  assert.equal(typeMismatch(docx, { contentType: "", filename: "report.zip" }), null);
});

test("unknown bytes are never treated as a mismatch", () => {
  assert.equal(typeMismatch(null, { contentType: "image/png", filename: "a.png" }), null);
  assert.equal(typeMismatch({}, { contentType: "image/png", filename: "a.png" }), null);
});
