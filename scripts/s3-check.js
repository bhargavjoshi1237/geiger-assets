require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { HeadBucketCommand } = require("@aws-sdk/client-s3");

async function main() {
  const s3 = await import("../lib/s3/index.js");
  const probeKey = `p/_health/tmp/s3-check-${Date.now()}.txt`;
  const body = `geiger-assets s3:check ${new Date().toISOString()}`;
  let failures = 0;
  const step = (ok, label, detail = "") => {
    console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures += 1;
  };

  step(s3.isS3Configured(), "env configured (S3_ENDPOINT/REGION/BUCKET/KEYS)");
  if (!s3.isS3Configured()) {
    console.error("\nMissing S3 env. Copy .env.example to .env.local and fill in the values.");
    process.exit(1);
  }
  const cfg = s3.s3Config();
  console.log(`      endpoint=${cfg.endpoint} bucket=${cfg.bucket} region=${cfg.region} pathStyle=${cfg.forcePathStyle}`);

  const client = s3.s3Client();
  step(Boolean(client), "s3 client created");
  if (!client) process.exit(1);

  try {
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    step(true, "bucket exists (HeadBucket)");
  } catch (err) {
    const n = s3.normalizeS3Error(err);
    step(false, "bucket exists (HeadBucket)", `${n.code}: ${n.message}`);
  }

  const put = await s3.putObject({ key: probeKey, body, contentType: "text/plain" });
  step(Boolean(put), "put object", probeKey);

  const head = await s3.headObject(probeKey);
  step(Boolean(head && head.size === Buffer.byteLength(body)), "head object", head ? `size=${head.size} etag=${head.etag}` : "null");

  const url = await s3.signGetUrl(probeKey);
  step(Boolean(url), "presign GET", url ? "signed" : "null");

  if (url) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      step(res.ok && text === body, "GET round-trip", `status=${res.status}`);
    } catch (err) {
      step(false, "GET round-trip", err.message);
    }
  }

  const listed = await s3.listObjects("p/_health/tmp/", { limit: 10 });
  step(Boolean(listed && listed.objects.some((o) => o.key === probeKey)), "list objects (prefix)");

  const copyKey = `${probeKey}.copy`;
  const copied = await s3.copyObject(probeKey, copyKey);
  step(copied, "copy object", copied ? copyKey : "gateway may not support CopyObject — version promotion will download-and-re-put");
  if (copied) await s3.deleteObject(copyKey);

  step(await s3.deleteObject(probeKey), "delete probe object");
  const gone = await s3.headObject(probeKey);
  step(gone === null, "probe gone after delete");

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
