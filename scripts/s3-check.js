require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { HeadBucketCommand } = require("@aws-sdk/client-s3");

async function main() {
  const s3 = await import("../lib/s3/index.js");
  const probeKey = `p/_health/tmp/s3-check-${Date.now()}.txt`;
  const body = `geiger-assets s3:check ${new Date().toISOString()}`;
  let failures = 0;
  let warnings = 0;
  const step = (ok, label, detail = "") => {
    console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures += 1;
  };
  const warn = (label, detail = "") => {
    console.log(`warn  ${label}${detail ? ` — ${detail}` : ""}`);
    warnings += 1;
  };

  step(s3.isS3Configured(), "env configured (S3_ENDPOINT/REGION/BUCKET/KEYS)");
  if (!s3.isS3Configured()) {
    console.error("\nMissing S3 env. Copy .env.example to .env.local and fill in the values.");
    process.exit(1);
  }
  const cfg = s3.s3Config();
  console.log(`      endpoint=${cfg.endpoint} bucket=${cfg.bucket} region=${cfg.region} pathStyle=${cfg.forcePathStyle}`);
  console.log(`      presignedUploads=${cfg.presignedUploads} presignedReads=${cfg.presignedReads}`);

  const client = s3.s3Client();
  step(Boolean(client), "s3 client created");
  if (!client) process.exit(1);

  // Bucket reachability: HEAD first, LIST as the fallback for gateways
  // without HeadBucket (Appwrite).
  let bucketOk = false;
  try {
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    step(true, "bucket exists (HeadBucket)");
    bucketOk = true;
  } catch (err) {
    const listed = await s3.listObjects("", { limit: 1 });
    if (listed) {
      warn("bucket reachable (HeadBucket unsupported, LIST works)");
      bucketOk = true;
    } else {
      const n = s3.normalizeS3Error(err);
      step(false, "bucket reachable", `${n.code}: ${n.message}`);
    }
  }
  if (!bucketOk) {
    console.error("\nBucket unreachable — create it first: aws s3 mb s3://BUCKET --endpoint-url $S3_ENDPOINT");
    process.exit(1);
  }

  const put = await s3.putObject({ key: probeKey, body, contentType: "text/plain" });
  step(Boolean(put), "put object", probeKey);

  const head = await s3.headObject(probeKey);
  step(Boolean(head && head.size === Buffer.byteLength(body)), "stat object", head ? `size=${head.size} etag=${head.etag}` : "null");

  const got = await s3.getObjectStream(probeKey);
  let bytesOk = false;
  if (got?.body) {
    const chunks = [];
    for await (const c of got.body) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    bytesOk = Buffer.concat(chunks).toString() === body;
  }
  step(bytesOk, "get object bytes round-trip");

  // Presigned URLs are the spec design but Appwrite answers them with 501.
  // They are advisory here: proxy mode covers uploads and reads without them.
  const getUrl = await s3.signGetUrl(probeKey);
  if (getUrl) {
    try {
      const res = await fetch(getUrl);
      if (res.ok) step(true, "presigned GET round-trip", `status=${res.status}`);
      else {
        try {
          res.body?.cancel?.();
        } catch {
          /* ignore */
        }
        warn("presigned GET unsupported", `status=${res.status} — reads use the proxy (S3_PRESIGNED_READS=false)`);
      }
    } catch (err) {
      warn("presigned GET unsupported", `${err.message} — reads use the proxy (S3_PRESIGNED_READS=false)`);
    }
  } else {
    warn("presigned GET unsupported", "could not sign — reads use the proxy (S3_PRESIGNED_READS=false)");
  }

  const putBody = "presigned-put-probe";
  const putUrl = await s3.signPutUrl(`p/_health/tmp/s3-check-put-${Date.now()}.txt`, {
    contentType: "text/plain",
    maxBytes: Buffer.byteLength(putBody),
  });
  if (putUrl) {
    try {
      const putRes = await fetch(putUrl, {
        method: "PUT",
        headers: { "Content-Type": "text/plain", "Content-Length": String(Buffer.byteLength(putBody)) },
        body: putBody,
      });
      if (putRes.ok) step(true, "presigned PUT round-trip", `status=${putRes.status}`);
      else {
        try {
          putRes.body?.cancel?.();
        } catch {
          /* ignore */
        }
        warn("presigned PUT unsupported", `status=${putRes.status} — uploads use the proxy (S3_PRESIGNED_UPLOADS=false)`);
      }
    } catch (err) {
      warn("presigned PUT unsupported", `${err.message} — uploads use the proxy (S3_PRESIGNED_UPLOADS=false)`);
    }
    await s3.deleteObject(`p/_health/tmp/s3-check-put-${Date.now()}.txt`).catch(() => false);
  } else {
    warn("presigned PUT unsupported", "could not sign — uploads use the proxy (S3_PRESIGNED_UPLOADS=false)");
  }

  const listed = await s3.listObjects("p/_health/tmp/", { limit: 10 });
  step(Boolean(listed && listed.objects.some((o) => o.key === probeKey)), "list objects (prefix)");

  const copyKey = `${probeKey}.copy`;
  const copied = await s3.copyObject(probeKey, copyKey);
  step(copied, "copy object", copied ? copyKey : "gateway may not support CopyObject");
  if (copied) await s3.deleteObject(copyKey);

  step(await s3.deleteObject(probeKey), "delete probe object");
  // Reads can lag deletes on some gateways — allow a few seconds to settle.
  let gone = await s3.headObject(probeKey);
  for (let i = 0; gone !== null && i < 3; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    gone = await s3.headObject(probeKey);
  }
  step(gone === null, "probe gone after delete");

  if (failures === 0 && warnings === 0) console.log("\nAll checks passed (full presign mode).");
  else if (failures === 0) console.log(`\nProxy path works; ${warnings} presign warning(s) — proxy mode covers uploads and reads.`);
  else console.log(`\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
