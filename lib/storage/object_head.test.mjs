import assert from "node:assert/strict";
import { test } from "node:test";
import { Readable } from "node:stream";
import { readObjectHead } from "./object_head.js";

const BYTES = Buffer.from(Array.from({ length: 300 }, (_, i) => i % 256));

function webStream(buf, chunk = 64) {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= buf.length) return controller.close();
      controller.enqueue(new Uint8Array(buf.subarray(offset, offset + chunk)));
      offset += chunk;
    },
  });
}

test("asks the backend for a byte range and returns that window", async () => {
  let asked = null;
  const backend = {
    async getStream(ref, { range }) {
      asked = range;
      return { stream: webStream(BYTES.subarray(0, 100)) };
    },
  };
  const head = await readObjectHead(backend, { key: "k" }, 100);
  assert.equal(asked, "bytes=0-99");
  assert.deepEqual(head, BYTES.subarray(0, 100));
});

test("stops at the window when the backend ignores Range and sends everything", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(BYTES.subarray(0, 150)));
      controller.enqueue(new Uint8Array(BYTES.subarray(150)));
    },
    cancel() {
      cancelled = true;
    },
  });
  const head = await readObjectHead({ getStream: async () => ({ stream }) }, { key: "k" }, 120);
  assert.equal(head.length, 120);
  assert.deepEqual(head, BYTES.subarray(0, 120));
  assert.equal(cancelled, true);
});

test("accepts a Node stream, as the S3 SDK returns", async () => {
  const backend = { getStream: async () => ({ stream: Readable.from([BYTES.subarray(0, 50)]) }) };
  assert.deepEqual(await readObjectHead(backend, { key: "k" }, 64), BYTES.subarray(0, 50));
});

test("returns null instead of throwing when nothing can be read", async () => {
  assert.equal(await readObjectHead({ getStream: async () => null }, { key: "k" }, 64), null);
  assert.equal(await readObjectHead({ getStream: async () => ({ stream: webStream(Buffer.alloc(0)) }) }, { key: "k" }, 64), null);
  const throwing = { getStream: async () => { throw new Error("boom"); } };
  assert.equal(await readObjectHead(throwing, { key: "k" }, 64), null);
});
