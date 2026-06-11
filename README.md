# ⚖️🐾 Judge Paws

> The first AI relationship court. Tell your side by voice or text, drop in the receipts — a fluffy AI judge and a jury of five dogs deliver a funny-but-fair verdict you can't stop sharing.

**Live → [judgepaws.skylarnyc.com](https://judgepaws.skylarnyc.com)** · Bilingual 🇺🇸 EN / 🇨🇳 中文 · installs to your home screen as a fullscreen app

A full-stack, growth-engineered consumer product by **[Skylar](https://github.com/SkylarWJY)**:
a marketing landing page, an interactive bilingual courtroom, a **tiered LLM verdict engine**
(vision + structured output), a built-in **shareable long-image** loop, and a **social-unlock
growth model** designed for an audience that pays with shares, not credit cards.

<p align="center">
  <img src="docs/landing.png" width="420" alt="Judge Paws landing page">
</p>

### The court app

<p align="center">
  <img src="docs/screens/1-home.png" width="150" alt="Home">
  <img src="docs/screens/2-type.png" width="150" alt="Pick the relationship">
  <img src="docs/screens/3-evidence.png" width="150" alt="Submit evidence">
  <img src="docs/screens/4-build.png" width="150" alt="Building the case">
  <img src="docs/screens/5-court.png" width="150" alt="The courtroom + dog jury">
  <img src="docs/screens/6-verdict.png" width="150" alt="The verdict">
</p>
<p align="center"><sub>Home · Pick the relationship · Submit evidence · Build the case · Courtroom &amp; dog jury · Verdict</sub></p>

## What's inside

```
judge-paws/
├── web/            landing page + waitlist capture
├── app/            interactive court (React in-browser, no build step) + PWA manifest
├── server.mjs      full-stack server — landing, app, and the API
├── data/           waitlist / entitlements storage (git-ignored)
└── .env.example
```

- **`/`** — marketing landing page with an email waitlist
- **`/app/index.html`** — the interactive bilingual courtroom (installable PWA)
- **`POST /api/trials`** — renders a full verdict as structured JSON (parties, credit
  scores, drama meter, blame %, red/green flags, ruling, judge's note, shareable caption)
  with a safety gate for genuinely unsafe input
- **`POST /api/waitlist`** — pushes early-access emails into **beehiiv** (or a local
  `data/waitlist.json` fallback)

## How the AI plugs in

**Real evidence in, via vision.** On the evidence screen you upload actual chat
screenshots. They're compressed client-side and sent to `POST /api/trials` as image
blocks; the model **reads them with vision** and grounds the entire verdict in the real
conversation — quoting real lines in the ruling and red flags. With no upload, it invents
a plausible, relatable case.

**Tiered model routing** keeps it fast and nearly free at scale:

| Tier | Model | Why |
|------|-------|-----|
| Free | **Gemini Flash-Lite** (vision + `responseSchema`) | ~$0.0005/verdict — cheap enough to give away |
| Premium / Savage | **Claude Opus 4.8** (vision + structured output) | best reasoning + bite for paying users |

The server picks the tier per request and **degrades gracefully** — Gemini → Claude →
a bundled sample case — so a verdict *always* renders, even if every key is missing.

The court app renders entirely from one `caseData` object. `BuildScreen` in
[`app/jp-screens-2.jsx`](app/jp-screens-2.jsx) calls `POST /api/trials`; the server returns
a verdict in the exact `caseData` shape.

```
screenshots + story  ─►  /api/trials  ─►  Gemini Flash-Lite  (free)  ┐
                                          Claude Opus 4.8   (premium) ┴─►  caseData
                                                                            │
                                                          Courtroom + dog jury + Verdict
```

**Shareable verdict.** The verdict screen's *Share* button renders a downloadable vertical
**long-image** (canvas, CJK-aware wrapping, EN/中 versions) and uses the Web Share API where
available — the viral loop is built into the product.

## Growth model — share &amp; follow, not paywalls

Built virality-first for a market where most users can't pay with foreign cards, so the
currency is **a share or a follow**, not money:

| Stage | What happens |
|-------|--------------|
| First verdicts | **Free.** The first one even gets a gentle, skippable "follow / share Skylar" nudge |
| After the free quota | A **share-or-follow unlock** — share your verdict, or follow on Instagram / 小红书 / LinkedIn → unlimited |
| Anyone who shares | **Permanent unlock.** Sharing a verdict (the growth loop) never hits a wall |

- The shareable long-image is the engine — never gated.
- Unlock state is client-side and intentionally low-friction.
- A **Stripe subscription** path (`/api/checkout` + webhook entitlements) is wired and can
  be re-enabled when the audience and payment rails are ready — web-only, no App Store cut.

## Bilingual &amp; installable

- **EN / 中文** throughout, with a live language toggle (`app/jp-i18n.jsx`).
- **Add to Home Screen** → launches fullscreen (no browser chrome) with a branded icon.
  On phones the app drops its device-mockup frame and fills the real screen edge-to-edge;
  on desktop it renders inside a contain-scaled phone mockup.

## Run it

```bash
npm install
cp .env.example .env      # paste GEMINI_API_KEY (free tier) and/or ANTHROPIC_API_KEY
npm start                 # → http://localhost:4319
```

Open the landing page, join the waitlist, or jump to `/app/index.html` to hold a real,
AI-rendered trial. Keys stay server-side and never ship to the browser. With no key set,
the app still runs on its bundled sample verdict.

### Waitlist → beehiiv

Set `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID` and waitlist signups land directly in
your beehiiv publication. Leave them blank for local dev and emails append to
`data/waitlist.json`.

### Analytics → GoatCounter

A privacy-friendly **GoatCounter** snippet (`app/index.html`, `app/landing.html`) reports
visits with no cookies or personal-data tracking.

## Deploy

Any Node host works (the app is a single `node server.mjs` process). A `Procfile` is
included for **Render** / **Railway** — point it at the repo, set the env vars, done. The
live build runs on Render behind `judgepaws.skylarnyc.com` (Cloudflare), with a static
mirror on GitHub Pages.

## Privacy

Uploaded screenshots are sent to the verdict API for a single request and are **not
persisted** server-side. Don't upload anything you wouldn't want read by the model.

## Origin

Judge Paws started as a project for the **Miro × Kiro LA Hackathon**
([hackathon repo](https://github.com/SkylarWJY/judge-paw)). This repo is the full-stack
continuation — concept, design, frontend, and AI backend by Skylar.

## License

[MIT](LICENSE)

## More from Skylar

- [**ANSIO**](https://github.com/SkylarWJY/ANSIO-conversational) — the first conversational growth engineer for creators
- [**skylarnyc.com**](https://skylarnyc.com) — NYC date-spot guide: 100 review-backed picks
- More projects → [github.com/SkylarWJY](https://github.com/SkylarWJY)
