// Judge Paws — full-stack server.
//   /                landing page (web/)
//   /app/*           interactive court demo
//   POST /api/trials AI verdict (Claude Opus 4.8, structured output)
//   POST /api/waitlist  capture early-access emails
// The ANTHROPIC_API_KEY stays server-side.

import { createServer } from "node:http";
import { readFile, mkdir, readFile as rf, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, dirname } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const PORT = process.env.PORT || 4319;
const ROOT = new URL(".", import.meta.url).pathname;
const WAITLIST = join(ROOT, "data", "waitlist.json");
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

// ---- Trial engine ----------------------------------------------------------

const SYSTEM = `You are Judge Paws — the presiding (and very cute) AI judge of the world's
first AI Relationship Court. It is a playful, viral, entertainment product: people bring a
relationship dispute and you deliver a verdict that is funny, shareable, and secretly fair.
Think internet-meme courtroom, not real legal advice.

Given a relationship type and any submitted "evidence", invent a vivid, specific case and
return a complete verdict. Rules:
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

async function renderTrial({ relationshipType, evidence }) {
  const ev = Array.isArray(evidence) && evidence.length
    ? evidence.map((e) => `- ${e.label || "evidence"}${e.text ? `: ${e.text}` : ""}`).join("\n")
    : "(no specific evidence submitted — invent a juicy, relatable case)";
  const userPrompt = `New case filed.\n\nRelationship type: ${relationshipType || "couple"}\n\nEvidence on file:\n${ev}\n\nHold court and return the full verdict.`;
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: { type: "json_schema", schema: CASE_SCHEMA } },
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No verdict returned");
  return JSON.parse(textBlock.text);
}

// ---- Waitlist --------------------------------------------------------------

async function addToWaitlist(email) {
  await mkdir(dirname(WAITLIST), { recursive: true });
  let list = [];
  if (existsSync(WAITLIST)) {
    try { list = JSON.parse(await rf(WAITLIST, "utf8")); } catch {}
  }
  if (!list.some((e) => e.email === email)) {
    list.push({ email, at: new Date().toISOString() });
    await writeFile(WAITLIST, JSON.stringify(list, null, 2));
  }
  return list.length;
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
    req.on("data", (c) => { data += c; if (data.length > 1e6) reject(new Error("Body too large")); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
function sendJSON(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

const server = createServer(async (req, res) => {
  // API: trial verdict
  if (req.method === "POST" && req.url === "/api/trials") {
    try {
      const { relationshipType, evidence } = JSON.parse((await readBody(req)) || "{}");
      if (!process.env.ANTHROPIC_API_KEY) return sendJSON(res, 500, { error: "Server is missing ANTHROPIC_API_KEY (see .env.example)." });
      return sendJSON(res, 200, await renderTrial({ relationshipType, evidence }));
    } catch (err) { console.error(err); return sendJSON(res, 500, { error: "Judge Paws could not reach a verdict. Try again." }); }
  }

  // API: waitlist
  if (req.method === "POST" && req.url === "/api/waitlist") {
    try {
      const { email } = JSON.parse((await readBody(req)) || "{}");
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return sendJSON(res, 400, { error: "Please enter a valid email." });
      const count = await addToWaitlist(email.toLowerCase());
      return sendJSON(res, 200, { ok: true, count });
    } catch (err) { console.error(err); return sendJSON(res, 500, { error: "Could not save your email. Try again." }); }
  }

  // Static — landing at /, app under /app, web assets at root
  let path = decodeURIComponent((req.url || "/").split("?")[0]);
  if (path === "/" || path === "") path = "/web/index.html";
  else if (!path.startsWith("/app/") && !path.startsWith("/web/")) path = "/web" + path; // serve web/ assets from root
  const safe = normalize(path).replace(/^(\.\.[/\\])+/, "");
  try {
    const data = await readFile(join(ROOT, safe));
    res.writeHead(200, { "content-type": MIME[extname(safe)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`🐾 Judge Paws running at http://localhost:${PORT}`);
  console.log(`   Landing: http://localhost:${PORT}/`);
  console.log(`   App:     http://localhost:${PORT}/app/Judge%20Paws.html`);
  if (!process.env.ANTHROPIC_API_KEY) console.log("⚠️  Set ANTHROPIC_API_KEY to enable real verdicts (see .env.example).");
});
