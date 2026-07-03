// Judge Paws — full-stack server.
//   /                landing page (web/)
//   /app/*           interactive court demo
//   POST /api/trials       AI verdict (Claude Opus 4.8, vision). Premium modes gated.
//   POST /api/waitlist     capture early-access emails (beehiiv or local)
//   POST /api/checkout     create a Stripe subscription checkout session
//   POST /api/stripe-webhook   Stripe events -> grant/revoke Judge Paws+
//   GET  /api/entitlement?email=  is this email subscribed?
// Secrets (ANTHROPIC_API_KEY, STRIPE_*) stay server-side.

import { createServer } from "node:http";
import { readFile, mkdir, readFile as rf, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, dirname, resolve, sep } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";

const PORT = process.env.PORT || 4319;
const ROOT = new URL(".", import.meta.url).pathname;
const WAITLIST = join(ROOT, "data", "waitlist.json");

const client = new Anthropic(); // ANTHROPIC_API_KEY from env
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || "";
const PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY || "";

// ---- Trial engine ----------------------------------------------------------

const SYSTEM = `You are Judge Paws — the presiding (and very cute) AI judge of the world's
first AI Relationship Court. It is a playful, viral, entertainment product: people bring a
relationship dispute and you deliver a verdict that is funny, shareable, and secretly fair.
Think internet-meme courtroom, not real legal advice.

Given a relationship type and any submitted evidence, return a complete verdict. When real
screenshots or text are provided, READ them carefully and base the ENTIRE verdict on the
ACTUAL conversation — quote real lines in the judgeNote and redFlags, use the real names or
handles if visible, and make the party quotes real messages from the chat. When NO real
evidence is provided, invent a vivid, relatable case. Rules:
- Be witty and warm. Puns encouraged. Never mean-spirited or cruel.
- The judgeNote must land a fair point on BOTH parties, even when one is "found guilty".
- Two parties with fun first names, a fitting emoji, a role label, a 0–100 "relationship
  credit score", and a punchy one-line quote in their own voice.
- "drama" 0–100, "blame" 0–100 (the DEFENDANT's share of fault).
- 3–5 redFlags (short punchy phrases) and 1–3 greenFlags.
- "ruling": a short ALL-CAPS punny verdict, e.g. "PAW-SITIVELY GUILTY".
- "rulingOf": MUST be exactly one of the two party names.
- "judgeNote": 2–3 sentences, funny but fair, ending in a light shared "sentence".
- "caption": a ready-to-post viral social caption with emoji.
If the evidence describes anything genuinely unsafe (abuse, threats, self-harm), drop the
comedy: keep it kind, and route them toward someone they trust.`;

const SAVAGE = `\n\nSAVAGE MODE (premium): turn up the heat. Be sharper, funnier, more
ruthless in the roast — still never cruel about protected traits or genuinely harmful, but
hold nothing back on the pettiness. The caption should be extra screenshot-worthy.`;

const PARTY = {
  type: "object", additionalProperties: false,
  properties: {
    name: { type: "string" }, emoji: { type: "string" }, role: { type: "string" },
    score: { type: "integer" }, quote: { type: "string" },
  },
  required: ["name", "emoji", "role", "score", "quote"],
};
const CASE_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    plaintiff: PARTY, defendant: PARTY,
    drama: { type: "integer" }, blame: { type: "integer" },
    redFlags: { type: "array", items: { type: "string" } },
    greenFlags: { type: "array", items: { type: "string" } },
    ruling: { type: "string" }, rulingOf: { type: "string" },
    judgeNote: { type: "string" }, caption: { type: "string" },
  },
  required: ["plaintiff", "defendant", "drama", "blame", "redFlags", "greenFlags",
    "ruling", "rulingOf", "judgeNote", "caption"],
};

async function renderTrial({ relationshipType, evidence, mode, lang, story, you, them }) {
  const items = Array.isArray(evidence) ? evidence : [];
  const zh = lang === "zh";
  const content = [{
    type: "text",
    text: `New case filed.

Relationship type: ${relationshipType || "couple"}
Plaintiff (the one telling the story): ${(you || "").trim() || "(unnamed — pick a fun name)"}
Defendant (the other party): ${(them || "").trim() || "(unnamed — pick a fun name)"}
OUTPUT LANGUAGE: ${zh ? "Chinese (中文) — EVERY string field in the verdict must be written in natural, funny, internet-native Chinese. The ruling should be a punchy ALL-CAPS-energy Chinese phrase." : "English"}
`,
  }];
  if (story && story.trim()) {
    content.push({ type: "text", text: `The plaintiff's own account of what happened (their side, verbatim):\n"""${story.trim().slice(0, 4000)}"""` });
  }
  if (!items.length && !(story && story.trim())) {
    content.push({ type: "text", text: "(no evidence submitted — invent a juicy, relatable case)" });
  }
  for (const e of items) {
    if (e && e.kind === "image" && e.data) {
      content.push({ type: "text", text: `— ${e.label || "Screenshot"} (read this screenshot):` });
      content.push({ type: "image", source: { type: "base64", media_type: e.mediaType || "image/jpeg", data: e.data } });
    } else if (e && e.text) {
      content.push({ type: "text", text: `— ${e.label || "Note"}: ${e.text}` });
    }
  }
  content.push({ type: "text", text: "Hold court and return the full verdict, grounded in the story and evidence above. Remember: the plaintiff told their side — be fair to the absent defendant too. Use the provided party names verbatim in name fields and rulingOf." });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1500,
    system: mode === "savage" ? SYSTEM + SAVAGE : SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: CASE_SCHEMA } },
  }, { timeout: 25000 });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No verdict returned");
  return JSON.parse(textBlock.text);
}

// ---- Gemini trial engine (free tier — Flash-Lite, ~$0.0005/verdict) --------

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

// Gemini-flavored response schema (uppercase Type enums, no additionalProperties)
const G_PARTY = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" }, emoji: { type: "STRING" }, role: { type: "STRING" },
    score: { type: "INTEGER" }, quote: { type: "STRING" },
  },
  required: ["name", "emoji", "role", "score", "quote"],
};
const G_CASE_SCHEMA = {
  type: "OBJECT",
  properties: {
    plaintiff: G_PARTY, defendant: G_PARTY,
    drama: { type: "INTEGER" }, blame: { type: "INTEGER" },
    redFlags: { type: "ARRAY", items: { type: "STRING" } },
    greenFlags: { type: "ARRAY", items: { type: "STRING" } },
    ruling: { type: "STRING" }, rulingOf: { type: "STRING" },
    judgeNote: { type: "STRING" }, caption: { type: "STRING" },
  },
  required: ["plaintiff", "defendant", "drama", "blame", "redFlags", "greenFlags",
    "ruling", "rulingOf", "judgeNote", "caption"],
};

async function renderTrialGemini({ relationshipType, evidence, lang, story, you, them }) {
  const items = Array.isArray(evidence) ? evidence : [];
  const zh = lang === "zh";
  const parts = [{
    text: `New case filed.

Relationship type: ${relationshipType || "couple"}
Plaintiff (the one telling the story): ${(you || "").trim() || "(unnamed — pick a fun name)"}
Defendant (the other party): ${(them || "").trim() || "(unnamed — pick a fun name)"}
OUTPUT LANGUAGE: ${zh ? "Chinese (中文) — EVERY string field must be natural, funny, internet-native Chinese." : "English"}
`,
  }];
  if (story && story.trim()) parts.push({ text: `The plaintiff's account (verbatim):\n"""${story.trim().slice(0, 4000)}"""` });
  if (!items.length && !(story && story.trim())) parts.push({ text: "(no evidence — invent a juicy, relatable case)" });
  for (const e of items) {
    if (e && e.kind === "image" && e.data) {
      parts.push({ text: `— ${e.label || "Screenshot"} (read this screenshot):` });
      parts.push({ inline_data: { mime_type: e.mediaType || "image/jpeg", data: e.data } });
    } else if (e && e.text) parts.push({ text: `— ${e.label || "Note"}: ${e.text}` });
  }
  parts.push({ text: "Hold court and return the full verdict, grounded in the story and evidence. Use the provided party names verbatim in name fields and rulingOf." });

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: G_CASE_SCHEMA, maxOutputTokens: 1500 },
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const text = d?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
  if (!text) throw new Error("gemini: empty response");
  return JSON.parse(text);
}

// ---- Waitlist (beehiiv or local) -------------------------------------------

async function addToWaitlist(email) {
  const apiKey = process.env.BEEHIIV_API_KEY, pubId = process.env.BEEHIIV_PUBLICATION_ID;
  if (apiKey && pubId) {
    const r = await fetch(`https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ email, reactivate_existing: true, send_welcome_email: true, utm_source: "judge-paws", utm_medium: "waitlist" }),
    });
    if (!r.ok) throw new Error(`beehiiv ${r.status}`);
    return;
  }
  await mkdir(dirname(WAITLIST), { recursive: true });
  let list = [];
  if (existsSync(WAITLIST)) { try { list = JSON.parse(await rf(WAITLIST, "utf8")); } catch {} }
  if (!list.some((e) => e.email === email)) {
    list.push({ email, at: new Date().toISOString() });
    await writeFile(WAITLIST, JSON.stringify(list, null, 2));
  }
}

// ---- Entitlements (who has Judge Paws+) ------------------------------------
// Stripe (the Axio Lab account) is the single source of truth. No local file:
// Render's disk is ephemeral, so a JSON cache silently resets on every deploy.
// A small in-memory TTL cache keeps us from hitting Stripe on every request.

const ENT_TTL_TRUE = 10 * 60 * 1000;  // subscribed: recheck every 10 min
const ENT_TTL_FALSE = 60 * 1000;      // not subscribed: recheck every 60s
const entCache = new Map();           // email -> { subscribed, exp }

function cacheEntitlement(email, subscribed) {
  if (!email) return;
  entCache.set(email.toLowerCase(), {
    subscribed, exp: Date.now() + (subscribed ? ENT_TTL_TRUE : ENT_TTL_FALSE),
  });
}

async function isSubscribed(email) {
  if (!email) return false;
  const key = email.toLowerCase();
  const hit = entCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.subscribed;
  if (!stripe) return false;
  try {
    const customers = await stripe.customers.list({ email: key, limit: 1 });
    let subscribed = false;
    if (customers.data.length) {
      const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
      subscribed = subs.data.length > 0;
    }
    cacheEntitlement(key, subscribed);
    return subscribed;
  } catch (err) {
    console.error("stripe subscription check", err.message);
    return hit ? hit.subscribed : false;  // stale-if-error beats a hard no
  }
}

// ---- HTTP plumbing ---------------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".jsx": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".ico": "image/x-icon",
};
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 9e6) { req.destroy(); reject(new Error("Body too large")); } });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
function sendJSON(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function originOf(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${req.headers.host}`;
}
function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown";
}

// ---- Per-IP rate limit for the expensive /api/trials endpoint --------------
// The free quota is client-side (localStorage); this is the server-side backstop
// that stops a script from looping the endpoint and burning the model budget.
const RL_MAX_MIN = 20, RL_MAX_DAY = 200;
const rlMap = new Map(); // ip -> { min:{c,reset}, day:{c,reset} }
function rateLimited(ip) {
  const now = Date.now();
  let e = rlMap.get(ip);
  if (!e) { e = { min: { c: 0, reset: now + 60000 }, day: { c: 0, reset: now + 86400000 } }; rlMap.set(ip, e); }
  if (now > e.min.reset) { e.min.c = 0; e.min.reset = now + 60000; }
  if (now > e.day.reset) { e.day.c = 0; e.day.reset = now + 86400000; }
  e.min.c++; e.day.c++;
  return e.min.c > RL_MAX_MIN || e.day.c > RL_MAX_DAY;
}
// prune stale IPs hourly so the map can't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of rlMap) if (now > e.day.reset) rlMap.delete(ip);
}, 3600000).unref?.();

// ---- Evidence sanitising (bound payload → memory + model cost) --------------
const MAX_IMAGES = 4, MAX_IMG_B64 = 2_800_000; // ~2MB base64 ≈ ~2.1MB decoded
function sanitizeEvidence(evidence) {
  const items = Array.isArray(evidence) ? evidence : [];
  let images = 0;
  const out = [];
  for (const e of items) {
    if (e && e.kind === "image" && e.data) {
      if (++images > MAX_IMAGES) continue;        // drop extras rather than fail
      if (String(e.data).length > MAX_IMG_B64) return { error: "One of your screenshots is too large (max ~2MB each)." };
      out.push({ kind: "image", data: e.data, mediaType: e.mediaType, label: e.label });
    } else if (e && e.text) {
      out.push({ text: String(e.text).slice(0, 2000), label: e.label });
    }
  }
  return { evidence: out };
}

const server = createServer(async (req, res) => {
  // request log for API routes (method, path, status, latency — no query strings)
  const t0 = Date.now();
  res.on("finish", () => {
    const path = (req.url || "").split("?")[0];
    if (path.startsWith("/api/")) console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - t0}ms`);
  });

  // --- Health check (uptime probes / keepalive) ---
  if (req.method === "GET" && req.url === "/healthz") {
    return sendJSON(res, 200, {
      ok: true, uptime: Math.round(process.uptime()),
      gemini: !!process.env.GEMINI_API_KEY, claude: !!process.env.ANTHROPIC_API_KEY, stripe: !!stripe,
    });
  }

  // --- Stripe webhook (needs raw body; check before other JSON routes) ---
  if (req.method === "POST" && req.url === "/api/stripe-webhook") {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return sendJSON(res, 400, { error: "Stripe not configured" });
    const raw = await readBody(req);
    let event;
    try {
      event = stripe.webhooks.constructEvent(raw, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) { return sendJSON(res, 400, { error: `Webhook signature failed: ${err.message}` }); }
    try {
      if (event.type === "checkout.session.completed") {
        const s = event.data.object;
        const email = s.customer_details?.email || s.customer_email;
        cacheEntitlement(email, true);
      } else if (event.type === "customer.subscription.deleted") {
        // resolve the email from Stripe itself — no local map to depend on
        const sub = event.data.object;
        const cust = await stripe.customers.retrieve(sub.customer);
        if (cust && !cust.deleted && cust.email) cacheEntitlement(cust.email, false);
      }
    } catch (err) { console.error("webhook handler", err); }
    return sendJSON(res, 200, { received: true });
  }

  // --- AI verdict (premium modes gated) ---
  if (req.method === "POST" && req.url === "/api/trials") {
    try {
      if (rateLimited(clientIp(req))) return sendJSON(res, 429, { error: "Whoa — too many cases at once. Give the dogs a minute. 🐾" });
      const { relationshipType, evidence, mode, email, lang, story, you, them } = JSON.parse((await readBody(req)) || "{}");
      const clean = sanitizeEvidence(evidence);
      if (clean.error) return sendJSON(res, 413, { error: clean.error });
      if (mode && mode !== "default") {
        if (!(await isSubscribed(email))) return sendJSON(res, 402, { error: "Judge Paws+ required for premium modes.", upgrade: true });
      }
      // Tiered model routing:
      //   subscribers + premium modes → Claude Opus (best quality, worth the cost)
      //   free tier → Gemini Flash-Lite (~$0.0005/verdict) when configured
      const premium = (mode && mode !== "default") || (await isSubscribed(email));
      const hasClaude = !!process.env.ANTHROPIC_API_KEY;
      const hasGemini = !!process.env.GEMINI_API_KEY;
      const args = { relationshipType, evidence: clean.evidence, mode, lang, story: typeof story === "string" ? story.slice(0, 4000) : story, you, them };
      if (premium && hasClaude) return sendJSON(res, 200, await renderTrial(args));
      if (hasGemini) {
        try { return sendJSON(res, 200, await renderTrialGemini(args)); }
        catch (err) { console.error("gemini failed, falling back:", err.message); if (!hasClaude) throw err; }
      }
      if (hasClaude) return sendJSON(res, 200, await renderTrial(args));
      return sendJSON(res, 500, { error: "Server has no model key configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY)." });
    } catch (err) { console.error(err); return sendJSON(res, 500, { error: "Judge Paws could not reach a verdict. Try again." }); }
  }

  // --- Waitlist ---
  if (req.method === "POST" && req.url === "/api/waitlist") {
    try {
      const { email } = JSON.parse((await readBody(req)) || "{}");
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return sendJSON(res, 400, { error: "Please enter a valid email." });
      await addToWaitlist(email.toLowerCase());
      return sendJSON(res, 200, { ok: true });
    } catch (err) { console.error(err); return sendJSON(res, 500, { error: "Could not save your email. Try again." }); }
  }

  // --- Create Stripe subscription checkout ---
  if (req.method === "POST" && req.url === "/api/checkout") {
    try {
      const { email, plan } = JSON.parse((await readBody(req)) || "{}");
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return sendJSON(res, 400, { error: "Enter a valid email to subscribe." });
      if (!stripe) return sendJSON(res, 500, { error: "Payments aren't configured yet." });
      const price = plan === "yearly" ? PRICE_YEARLY : PRICE_MONTHLY;
      if (!price) return sendJSON(res, 500, { error: "Missing Stripe price id (set STRIPE_PRICE_MONTHLY)." });
      const base = originOf(req);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        customer_email: email,
        allow_promotion_codes: true,
        success_url: `${base}/app/index.html?paid=1&email=${encodeURIComponent(email)}`,
        cancel_url: `${base}/app/index.html?canceled=1`,
      });
      return sendJSON(res, 200, { url: session.url });
    } catch (err) { console.error(err); return sendJSON(res, 500, { error: "Could not start checkout. Try again." }); }
  }

  // --- Check subscription status ---
  if (req.method === "GET" && req.url.startsWith("/api/entitlement")) {
    const email = new URL(req.url, "http://x").searchParams.get("email");
    return sendJSON(res, 200, { subscribed: await isSubscribed(email) });
  }

  // --- Home → the designed marketing landing ---
  if (req.url === "/" || req.url === "") {
    res.writeHead(302, { location: "/app/landing.html" });
    return res.end();
  }

  // --- Static ---
  let path = decodeURIComponent((req.url || "/").split("?")[0]);
  if (!path.startsWith("/app/") && !path.startsWith("/web/")) path = "/web" + path;
  // containment check: the resolved path must land inside app/ or web/ ONLY.
  // (Containing to ROOT is not enough — /web/../.env resolves inside ROOT and
  // would serve secrets. Whitelist the two public dirs instead.)
  const safe = resolve(join(ROOT, "." + path));
  const PUBLIC_DIRS = [resolve(join(ROOT, "app")), resolve(join(ROOT, "web"))];
  if (!PUBLIC_DIRS.some((d) => safe.startsWith(d + sep))) {
    res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found");
  }
  try {
    const data = await readFile(safe);
    const ext = extname(safe);
    // App code (html/jsx/json) must always be fresh — otherwise iOS caches a
    // stale index.html/CSS and updates never reach installed home-screen PWAs.
    // Static assets (images/fonts) can cache hard.
    const cache = /\.(html|jsx|json|webmanifest)$/i.test(safe)
      ? "no-cache, must-revalidate"
      : "public, max-age=86400";
    res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream", "cache-control": cache });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`🐾 Judge Paws running at http://localhost:${PORT}`);
  console.log(`   Landing: http://localhost:${PORT}/`);
  console.log(`   App:     http://localhost:${PORT}/app/index.html`);
  if (!process.env.ANTHROPIC_API_KEY) console.log("⚠️  Set ANTHROPIC_API_KEY to enable verdicts.");
  if (!stripe) console.log("ℹ️  Stripe not configured — paywall shows but checkout is disabled (set STRIPE_SECRET_KEY).");
});
