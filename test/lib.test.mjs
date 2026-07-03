// Unit tests for the security-critical pure functions (npm test).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientIpFrom, makeRateLimiter, sanitizeEvidence, MAX_IMAGES,
  signEntitlement, verifyEntitlement, resolvePublicPath,
} from "../server-lib.mjs";

// ---- clientIpFrom: the rate-limit key must not be client-spoofable ----------

test("clientIpFrom takes the LAST x-forwarded-for hop (proxy-written), not the first (client-written)", () => {
  assert.equal(clientIpFrom("6.6.6.6, 1.2.3.4", "sock"), "1.2.3.4");
  assert.equal(clientIpFrom("spoofed, also-spoofed, 9.9.9.9", "sock"), "9.9.9.9");
});

test("clientIpFrom falls back to the socket address, then 'unknown'", () => {
  assert.equal(clientIpFrom("", "10.0.0.1"), "10.0.0.1");
  assert.equal(clientIpFrom(undefined, undefined), "unknown");
});

// ---- rate limiter -------------------------------------------------------------

test("rate limiter blocks after maxPerMin and resets after the window", () => {
  let t = 0;
  const rl = makeRateLimiter({ maxPerMin: 3, maxPerDay: 100, now: () => t });
  assert.equal(rl.limited("a"), false);
  assert.equal(rl.limited("a"), false);
  assert.equal(rl.limited("a"), false);
  assert.equal(rl.limited("a"), true);       // 4th within the minute
  t += 61_000;
  assert.equal(rl.limited("a"), false);      // window rolled over
});

test("rate limiter enforces the daily cap across minute windows", () => {
  let t = 0;
  const rl = makeRateLimiter({ maxPerMin: 100, maxPerDay: 5, now: () => t });
  for (let i = 0; i < 5; i++) { assert.equal(rl.limited("a"), false); t += 61_000; }
  assert.equal(rl.limited("a"), true);
});

test("rate limiter map stays bounded under identity rotation (FIFO eviction)", () => {
  const rl = makeRateLimiter({ maxEntries: 100 });
  for (let i = 0; i < 1_000; i++) rl.limited("ip-" + i);
  assert.ok(rl.size() <= 100);
});

// ---- evidence sanitising --------------------------------------------------------

test("sanitizeEvidence caps images at MAX_IMAGES and truncates text notes", () => {
  const evidence = [
    ...Array.from({ length: 6 }, (_, i) => ({ kind: "image", data: "x", label: "img" + i })),
    { text: "y".repeat(5000) },
  ];
  const r = sanitizeEvidence(evidence);
  assert.equal(r.evidence.filter((e) => e.kind === "image").length, MAX_IMAGES);
  assert.equal(r.evidence.at(-1).text.length, 2000);
});

test("sanitizeEvidence rejects an oversized image and tolerates junk input", () => {
  assert.ok(sanitizeEvidence([{ kind: "image", data: "z".repeat(3_000_000) }]).error);
  assert.deepEqual(sanitizeEvidence(null).evidence, []);
  assert.deepEqual(sanitizeEvidence([null, {}, { kind: "image" }]).evidence, []);
});

// ---- entitlement tokens ----------------------------------------------------------

test("entitlement token round-trips and is case-insensitive on email", () => {
  const t = signEntitlement("s3cret", "User@Example.com");
  assert.ok(t.length > 20);
  assert.equal(verifyEntitlement("s3cret", "user@example.com", t), true);
});

test("entitlement verification rejects wrong token / email / missing secret", () => {
  const t = signEntitlement("s3cret", "a@b.c");
  assert.equal(verifyEntitlement("s3cret", "a@b.c", t + "x"), false);
  assert.equal(verifyEntitlement("s3cret", "other@b.c", t), false);
  assert.equal(verifyEntitlement("", "a@b.c", t), false);       // unconfigured → never authed
  assert.equal(verifyEntitlement("s3cret", "a@b.c", ""), false);
});

// ---- static path containment ------------------------------------------------------

const ROOT = "/srv/judge-paws/";

test("resolvePublicPath serves files inside app/ and web/ only", () => {
  assert.ok(resolvePublicPath(ROOT, "/app/index.html").endsWith("/app/index.html"));
  assert.ok(resolvePublicPath(ROOT, "/logo.png").endsWith("/web/logo.png")); // implicit /web
});

test("resolvePublicPath blocks traversal out of the public dirs", () => {
  assert.equal(resolvePublicPath(ROOT, "/web/../.env"), null);
  assert.equal(resolvePublicPath(ROOT, "/app/../server.mjs"), null);
  assert.equal(resolvePublicPath(ROOT, "/web/%2e%2e/.env"), null);   // encoded dots
  assert.equal(resolvePublicPath(ROOT, "/app/a%00.html"), null);     // null byte
  assert.equal(resolvePublicPath(ROOT, "/%%%"), null);               // bad encoding → null, not throw
});
