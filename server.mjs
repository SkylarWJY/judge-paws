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
import { join, dirname } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import {
  clientIpFrom, makeRateLimiter, sanitizeEvidence, MAX_TRIAL_BODY,
  signEntitlement, verifyEntitlement, resolvePublicPath, mimeFor,
} from "./server-lib.mjs";

const PORT = process.env.PORT || 4319;
const ROOT = new URL(".", import.meta.url).pathname;
const WAITLIST = join(ROOT, "data", "waitlist.json");
const IS_PROD = !!process.env.RENDER || process.env.NODE_ENV === "production";

// The SDK throws at construction when the key is missing — instantiate only
// when configured so the no-key dev boot (and the hasClaude fallbacks) work.
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || "";
const PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY || "";
// Secret for entitlement tokens. Falls back to the Stripe secret so no new env
// var is required; if neither exists, premium is unreachable anyway.
const ENT_SECRET = process.env.ENT_SECRET || process.env.STRIPE_SECRET_KEY || "";

// A crashed process serves nobody: log-and-survive beats Node's default
// exit-on-unhandledRejection for a single-instance product server.
process.on("unhandledRejection", (err) => console.error("unhandledRejection", err));
process.on("uncaughtException", (err) => console.error("uncaughtException", err));

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

let waitlistChain = Promise.resolve(); // serialise read-modify-write (no lost emails)

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
  // In production the local file lives on Render's EPHEMERAL disk — accepting
  // an email we'll silently lose on the next deploy is worse than an error.
  if (IS_PROD) throw new Error("waitlist misconfigured: BEEHIIV_* env vars missing in production");
  waitlistChain = waitlistChain.then(async () => {
    await mkdir(dirname(WAITLIST), { recursive: true });
    let list = [];
    if (existsSync(WAITLIST)) { try { list = JSON.parse(await rf(WAITLIST, "utf8")); } catch {} }
    if (!list.some((e) => e.email === email)) {
      list.push({ email, at: new Date().toISOString() });
      await writeFile(WAITLIST, JSON.stringify(list, null, 2));
    }
  });
  await waitlistChain;
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

// readBody with a per-route cap: the trials endpoint legitimately carries
// ~11MB of screenshots, while waitlist/checkout/webhook bodies are tiny —
// giving every route the big cap would hand attackers free memory amplification.
function readBody(req, limit = 64_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { req.destroy(); reject(new Error("Body too large")); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
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
  return clientIpFrom(req.headers["x-forwarded-for"], req.socket.remoteAddress);
}

// Server-side backstop for the expensive /api/trials endpoint (the free quota
// itself is client-side). Keyed on the rightmost x-forwarded-for hop — see lib.
const limiter = makeRateLimiter({ maxPerMin: 20, maxPerDay: 200 });
setInterval(() => limiter.prune(), 3600_000).unref?.();

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
    // readBody rejects on oversized bodies — unwrapped, that rejection would
    // become an unhandledRejection (one oversized POST = crashed process).
    let raw;
    try { raw = await readBody(req, 1_000_000); }
    catch { return sendJSON(res, 413, { error: "Body too large" }); }
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
      if (limiter.limited(clientIp(req))) return sendJSON(res, 429, { error: "Whoa — too many cases at once. Give the dogs a minute. 🐾" });
      const { relationshipType, evidence, mode, email, token, lang, story, you, them } = JSON.parse((await readBody(req, MAX_TRIAL_BODY)) || "{}");
      const clean = sanitizeEvidence(evidence);
      if (clean.error) return sendJSON(res, 413, { error: clean.error });
      // Premium requires PROOF of identity (HMAC token from /api/claim), not a
      // bare email — emails are guessable and must never act as credentials.
      const authed = verifyEntitlement(ENT_SECRET, email, token);
      const subscribed = authed && (await isSubscribed(email));
      if (mode && mode !== "default" && !subscribed) {
        return sendJSON(res, 402, { error: "Judge Paws+ required for premium modes.", upgrade: true });
      }
      // Tiered model routing:
      //   subscribers + premium modes → Claude Opus (best quality, worth the cost)
      //   free tier → Gemini Flash-Lite (~$0.0005/verdict) when configured
      const premium = (mode && mode !== "default") || subscribed;
      const hasClaude = !!process.env.ANTHROPIC_API_KEY;
      const hasGemini = !!process.env.GEMINI_API_KEY;
      const args = { relationshipType, evidence: clean.evidence, mode, lang, story: typeof story === "string" ? story.slice(0, 4000) : story, you, them };
      const serve = (model, verdict) => {
        console.log(`trial model=${model} premium=${premium} images=${clean.evidence.filter((e) => e.kind === "image").length}`);
        return sendJSON(res, 200, verdict);
      };
      if (premium && hasClaude) return serve("opus", await renderTrial(args));
      if (hasGemini) {
        try { return serve("gemini", await renderTrialGemini(args)); }
        catch (err) { console.error("gemini failed, falling back:", err.message); if (!hasClaude) throw err; }
      }
      if (hasClaude) return serve("opus", await renderTrial(args));
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
        // {CHECKOUT_SESSION_ID} is substituted by Stripe. The session id — not
        // the email — is what the success page exchanges for an entitlement
        // token (/api/claim): unguessable, and only the payer's browser has it.
        success_url: `${base}/app/index.html?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/app/index.html?canceled=1`,
      });
      return sendJSON(res, 200, { url: session.url });
    } catch (err) { console.error(err); return sendJSON(res, 500, { error: "Could not start checkout. Try again." }); }
  }

  // --- Claim entitlement token after checkout ---
  // Proof-of-payment → credential exchange. The frontend posts the session_id
  // from the success redirect; we verify with Stripe that this session is PAID
  // and mint the HMAC token the client uses for premium calls from then on.
  if (req.method === "POST" && req.url === "/api/claim") {
    try {
      if (limiter.limited(clientIp(req))) return sendJSON(res, 429, { error: "Too many attempts." });
      if (!stripe) return sendJSON(res, 500, { error: "Payments aren't configured yet." });
      const { session_id } = JSON.parse((await readBody(req)) || "{}");
      if (!session_id || typeof session_id !== "string") return sendJSON(res, 400, { error: "Missing session_id." });
      const session = await stripe.checkout.sessions.retrieve(session_id);
      const email = (session.customer_details?.email || session.customer_email || "").toLowerCase();
      if (session.payment_status !== "paid" || !email) return sendJSON(res, 402, { error: "Session not paid." });
      cacheEntitlement(email, true);
      return sendJSON(res, 200, { email, token: signEntitlement(ENT_SECRET, email) });
    } catch (err) { console.error("claim", err.message); return sendJSON(res, 400, { error: "Could not verify checkout session." }); }
  }

  // --- Check subscription status (token required — without it this endpoint
  // is an oracle that lets anyone probe which emails are paying customers) ---
  if (req.method === "GET" && req.url.startsWith("/api/entitlement")) {
    const q = new URL(req.url, "http://x").searchParams;
    const email = q.get("email"), token = q.get("token");
    if (!verifyEntitlement(ENT_SECRET, email, token)) return sendJSON(res, 200, { subscribed: false });
    return sendJSON(res, 200, { subscribed: await isSubscribed(email) });
  }

  // --- Home → the designed marketing landing ---
  if (req.url === "/" || req.url === "") {
    res.writeHead(302, { location: "/app/landing.html" });
    return res.end();
  }

  // --- Static (containment logic lives in server-lib.resolvePublicPath) ---
  const safe = resolvePublicPath(ROOT, req.url);
  if (!safe) {
    res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found");
  }
  try {
    const data = await readFile(safe);
    // App code (html/jsx/json) must always be fresh — otherwise iOS caches a
    // stale index.html/CSS and updates never reach installed home-screen PWAs.
    // Static assets (images/fonts) can cache hard.
    const cache = /\.(html|jsx|json|webmanifest)$/i.test(safe)
      ? "no-cache, must-revalidate"
      : "public, max-age=86400";
    res.writeHead(200, { "content-type": mimeFor(safe), "cache-control": cache });
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
