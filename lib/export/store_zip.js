if (typeof window !== "undefined") {
  throw new Error("lib/export/store_zip is server-only.");
}

// Minimal STORE-only (method 0) ZIP writer — zero new dependencies. Media is
// already compressed, so deflate buys nothing; files stream through untouched.
// Sizes and CRCs trail each file in a data descriptor (general-purpose flag
// bit 3), which keeps memory flat: only the small central directory is held
// back until the end. Every reader that matters (Explorer, Finder, unzip)
// accepts data descriptors.

const SIG_LFH = 0x04034b50;
const SIG_DATA_DESCRIPTOR = 0x08074b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crcUpdate(crc, bytes) {
  let c = crc >>> 0;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return c >>> 0;
}

function dosDateTime(when) {
  const d = when instanceof Date ? when : new Date(when || Date.now());
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const time =
    ((safe.getHours() & 31) << 11) | ((safe.getMinutes() & 63) << 5) | ((safe.getSeconds() >> 1) & 31);
  const date =
    (((safe.getFullYear() - 1980) & 127) << 9) | (((safe.getMonth() + 1) & 15) << 5) | (safe.getDate() & 31);
  return { time, date };
}

function u16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function u32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function localHeader(nameBytes, time, date) {
  const out = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(out.buffer);
  u32(view, 0, SIG_LFH);
  u16(view, 4, 20); // version needed
  u16(view, 6, 0x0800 | 0x0008); // UTF-8 names + trailing data descriptor
  u16(view, 8, 0); // method: STORE
  u16(view, 10, time);
  u16(view, 12, date);
  u32(view, 14, 0); // crc32 (in descriptor)
  u32(view, 18, 0); // compressed size (in descriptor)
  u32(view, 22, 0); // uncompressed size (in descriptor)
  u16(view, 26, nameBytes.length);
  u16(view, 28, 0); // extra length
  out.set(nameBytes, 30);
  return out;
}

function dataDescriptor(crc, size) {
  const out = new Uint8Array(16);
  const view = new DataView(out.buffer);
  u32(view, 0, SIG_DATA_DESCRIPTOR);
  u32(view, 4, crc);
  u32(view, 8, size);
  u32(view, 12, size);
  return out;
}

function centralHeader(entry) {
  const out = new Uint8Array(46 + entry.nameBytes.length);
  const view = new DataView(out.buffer);
  u32(view, 0, SIG_CENTRAL);
  u16(view, 4, (3 << 8) | 20); // made by Unix, v2.0
  u16(view, 6, 20);
  u16(view, 8, 0x0800 | 0x0008);
  u16(view, 10, 0);
  u16(view, 12, entry.time);
  u16(view, 14, entry.date);
  u32(view, 16, entry.crc);
  u32(view, 20, entry.size);
  u32(view, 24, entry.size);
  u16(view, 28, entry.nameBytes.length);
  u16(view, 30, 0);
  u16(view, 32, 0);
  u16(view, 34, 0);
  u16(view, 36, 0);
  u32(view, 38, (0o100644 << 16) >>> 0); // regular file, rw-r--r--
  u32(view, 42, entry.offset);
  out.set(entry.nameBytes, 46);
  return out;
}

function endRecord(count, dirSize, dirOffset) {
  const out = new Uint8Array(22);
  const view = new DataView(out.buffer);
  u32(view, 0, SIG_EOCD);
  u16(view, 4, 0);
  u16(view, 6, 0);
  u16(view, 8, count);
  u16(view, 10, count);
  u32(view, 12, dirSize);
  u32(view, 16, dirOffset);
  u16(view, 20, 0);
  return out;
}

/**
 * Yield the bytes of a complete .zip archive.
 * `files` is [{ name, mtime }]; `readFile(file)` returns an async iterable of
 * Uint8Array chunks for that file's uncompressed bytes.
 */
export async function* streamStoreZip(files, readFile) {
  const central = [];
  let offset = 0;
  for (const file of files || []) {
    const nameBytes = new TextEncoder().encode(file.name);
    const { time, date } = dosDateTime(file.mtime);
    const header = localHeader(nameBytes, time, date);
    yield header;
    let crc = 0xffffffff;
    let size = 0;
    for await (const chunk of readFile(file)) {
      const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      crc = crcUpdate(crc, bytes);
      size += bytes.length;
      yield bytes;
    }
    yield dataDescriptor((crc ^ 0xffffffff) >>> 0, size);
    central.push({ nameBytes, crc: (crc ^ 0xffffffff) >>> 0, size, time, date, offset });
    offset += header.length + size + 16;
  }
  const dirOffset = offset;
  let dirSize = 0;
  for (const entry of central) {
    const header = centralHeader(entry);
    yield header;
    dirSize += header.length;
  }
  yield endRecord(central.length, dirSize, dirOffset);
}
