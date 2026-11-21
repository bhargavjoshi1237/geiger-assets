import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { probeFile, typeMismatch } from "./probe.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
// A minimal PE image: "MZ", e_lfanew at 0x3c pointing to "PE\0\0" at 0x40.
const EXE_HEAD = Buffer.alloc(0x80);
EXE_HEAD.write("MZ", 0, "latin1");
EXE_HEAD.writeUInt32LE(0x40, 0x3c);
EXE_HEAD.write("PE\0\0", 0x40, "latin1");
// A BMP file header followed by a 40-byte BITMAPINFOHEADER size.
const BMP_HEAD = Buffer.alloc(54);
BMP_HEAD.write("BM", 0, "latin1");
BMP_HEAD.writeUInt32LE(54, 10);
BMP_HEAD.writeUInt32LE(40, 14);
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

test("does not mistake text that starts with a magic-looking word for a binary", async () => {
  for (const [text, filename, contentType] of [
    ["BMI,weight,height\n22.1,70,178\n", "health.csv", "text/csv"],
    ["MZone release notes\n", "notes.txt", "text/plain"],
    ["ID3 tags to fix: artist, album\n", "todo.md", "text/markdown"],
  ]) {
    const probe = await probeFile(Buffer.from(text));
    assert.equal(typeMismatch(probe, { contentType, filename }), null, filename);
  }
});

test("still recognises real BMP and ID3 headers", async () => {
  assert.equal((await probeFile(BMP_HEAD)).detectedMime, "image/bmp");
  const id3 = Buffer.concat([Buffer.from("ID3"), Buffer.from([0x04, 0x00, 0x00]), Buffer.alloc(20)]);
  assert.equal((await probeFile(id3)).detectedMime, "audio/mpeg");
});

test("a mislabel inside one family is accepted", async () => {
  const webp = await probeFile(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(16)]));
  assert.equal(typeMismatch(webp, { contentType: "image/jpeg", filename: "download.jpg" }), null);
  const png = await probeFile(PNG);
  assert.equal(typeMismatch(png, { contentType: "image/jpeg", filename: "photo.jpg" }), null);
  // A NEF whose maker tag sits past the probe window reads as plain TIFF.
  const tiff = await probeFile(Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0]), Buffer.alloc(32)]));
  assert.equal(typeMismatch(tiff, { contentType: "image/x-nikon-nef", filename: "DSC_0001.NEF" }), null);
  // MP4 audio often carries a video brand.
  const mp4 = await probeFile(Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(20)]));
  assert.equal(typeMismatch(mp4, { contentType: "audio/mp4", filename: "voice.m4a" }), null);
});

test("formats that wrap another format are accepted", async () => {
  const zip = await probeFile(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(40)]));
  assert.equal(typeMismatch(zip, { contentType: "", filename: "screens.sketch" }), null);
  assert.equal(typeMismatch(zip, { contentType: "model/vnd.usdz+zip", filename: "chair.usdz" }), null);
  // A docx whose [Content_Types].xml lies past the window probes as a plain zip.
  assert.equal(
    typeMismatch(zip, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      filename: "contract.docx",
    }),
    null,
  );
  const pdf = await probeFile(PDF_HEAD);
  assert.equal(typeMismatch(pdf, { contentType: "", filename: "logo.ai" }), null);
});

test("a disguise across families is refused", async () => {
  const zip = await probeFile(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(40)]));
  assert.ok(typeMismatch(zip, { contentType: "image/png", filename: "cat.png" }));
  assert.ok(typeMismatch(zip, { contentType: "application/zip", filename: "cat.png" }), "the extension is still a claim");
  const svg = await probeFile(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
  assert.ok(typeMismatch(svg, { contentType: "image/png", filename: "avatar.png" }), "markup posing as pixels");
  const pdf = await probeFile(PDF_HEAD);
  assert.ok(typeMismatch(pdf, { contentType: "", filename: "logo.png" }));
  const exe = await probeFile(EXE_HEAD);
  assert.ok(typeMismatch(exe, { contentType: "application/octet-stream", filename: "photos.zip" }));
});
