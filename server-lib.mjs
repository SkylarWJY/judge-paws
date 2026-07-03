// Judge Paws — pure, dependency-free helpers extracted from server.mjs so the
// security-critical logic is unit-testable (`npm test`). No I/O in this file.

import { createHmac, timingSafeEqual } from "node:crypto";
import { extname, join, resolve, sep } from "node:path";

// ---- Client IP (rate-limit key) ---------------------------------------------
// x-forwarded-for is APPENDED to by each proxy, so the only entry we can trust
// is the LAST one (written by our own edge — Render). Taking the first entry
// would let any client spoof a fresh "IP" per request and bypass rate limits.
export function clientIpFrom(xff, remoteAddress) {
  const chain = String(xff || "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - 1] || remoteAddress || "unknown";
}

// ---- Per-IP rate limiter ------------------------------------------------------
// Sliding windows (1 min / 1 day) with FIFO eviction so the map stays bounded
// even if someone rotates identities.
export function makeRateLimiter({ maxPerMin = 20, maxPerDay = 200, maxEntries = 50_000, now = Date.now } = {}) {
  const m = new Map(); // key -> { min:{c,reset}, day:{c,reset} }
  return {
    limited(key) {
      const t = now();
      let e = m.get(key);
      if (!e) {
        if (m.size >= maxEntries) m.delete(m.keys().next().value); // FIFO evict
        e = { min: { c: 0, reset: t + 60_000 }, day: { c: 0, reset: t + 86_400_000 } };
        m.set(key, e);
      }
      if (t > e.min.reset) { e.min.c = 0; e.min.reset = t + 60_000; }
      if (t > e.day.reset) { e.day.c = 0; e.day.reset = t + 86_400_000; }
      e.min.c++; e.day.c++;
      return e.min.c > maxPerMin || e.day.c > maxPerDay;
    },
    prune() { const t = now(); for (const [k, e] of m) if (t > e.day.reset) m.delete(k); },
    size() { return m.size; },
  };
}

// ---- Evidence sanitising ------------------------------------------------------
export const MAX_IMAGES = 4;
export const MAX_IMG_B64 = 2_800_000; // ~2MB base64 ≈ ~2.1MB decoded
// Body cap must fit a full evidence payload (4 images + story + slack),
// otherwise the server hangs up on legitimate requests mid-upload.
export const MAX_TRIAL_BODY = MAX_IMAGES * MAX_IMG_B64 + 800_000;

export function sanitizeEvidence(evidence) {
  const items = Array.isArray(evidence) ? evidence : [];
  let images = 0;
  const out = [];
  for (const e of items) {
    if (e && e.kind === "image" && e.data) {
      if (++images > MAX_IMAGES) continue; // drop extras rather than fail
      if (String(e.data).length > MAX_IMG_B64) return { error: "One of your screenshots is too large (max ~2MB each)." };
      out.push({ kind: "image", data: e.data, mediaType: e.mediaType, label: e.label });
    } else if (e && e.text) {
      out.push({ text: String(e.text).slice(0, 2000), label: e.label });
    }
  }
  return { evidence: out };
}

// ---- Entitlement tokens -------------------------------------------------------
// The email alone must never act as a bearer credential (it's guessable and it
// leaks via /api/entitlement). A token = HMAC(secret, email) proves the client
// obtained it from us — and we only hand it out after verifying a PAID Stripe
// checkout session (/api/claim). No expiry: subscription status is still
// re-checked against Stripe on every gate; the token only proves identity.
export function signEntitlement(secret, email) {
  if (!secret || !email) return "";
  return createHmac("sha256", secret).update(String(email).toLowerCase()).digest("base64url");
}

export function verifyEntitlement(secret, email, token) {
  if (!secret || !email || !token) return false;
  const want = Buffer.from(signEntitlement(secret, email));
  const got = Buffer.from(String(token));
  return want.length === got.length && timingSafeEqual(want, got);
}

// ---- Static file containment ---------------------------------------------------
// Returns the resolved absolute path if urlPath lands inside one of the public
// dirs, else null. Containing to ROOT is not enough — /web/../.env resolves
// inside ROOT and would serve secrets. Whitelist the public dirs instead.
export function resolvePublicPath(root, urlPath, publicDirs = ["app", "web"]) {
  let path;
  try { path = decodeURIComponent(String(urlPath || "/").split("?")[0]); } catch { return null; }
  if (path.includes("\0")) return null;
  if (!publicDirs.some((d) => path.startsWith(`/${d}/`))) path = "/web" + path;
  const safe = resolve(join(root, "." + path));
  const dirs = publicDirs.map((d) => resolve(join(root, d)));
  return dirs.some((d) => safe.startsWith(d + sep)) ? safe : null;
}

export const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".jsx": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".ico": "image/x-icon",
};

export function mimeFor(path) { return MIME[extname(path)] || "application/octet-stream"; }
