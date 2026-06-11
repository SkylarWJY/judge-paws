/* Judge Paws — screens part 2: Build Case, Courtroom + Jury, Verdict */

// ───────────── the sample case (language-aware) ─────────────
function buildCase(relType, lang, names) {
  const cd = I18N[lang || 'en'].caseData;
  const roles = cd.roles[relType] || cd.roles.couple;
  const you = (names && names.you && names.you.trim()) || cd.youDefault;
  const them = (names && names.them && names.them.trim()) || cd.themDefault;
  return {
    plaintiff: { name: you, emoji: '👩🏻', role: roles.a, score: 84, color: JP.lavender, quote: cd.plaintiffQuote },
    defendant: { name: them, emoji: '👨🏽', role: roles.b, score: 78, color: JP.bubblegum, quote: cd.defendantQuote },
    drama: 82,
    blame: 67, // defendant's share
    redFlags: cd.redFlags,
    greenFlags: cd.greenFlags,
    ruling: cd.ruling,
    rulingOf: them,
    judgeNote: typeof cd.judgeNote === 'function' ? cd.judgeNote(you, them) : cd.judgeNote,
    caption: cd.caption,
  };
}

// ─────────── backend trial (real AI verdict) ───────────
// POST /api/trials with the user's story, names, language and screenshots.
// Falls back silently to buildCase() if the backend is unavailable.
async function fetchTrial(st, lang) {
  const email = window.JPB ? JPB.email() : '';
  const res = await fetch('/api/trials', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      relationshipType: (st && st.relType) || 'couple',
      lang: lang || 'en',
      story: (st && st.story) || '',
      you: (st && st.you) || '',
      them: (st && st.them) || '',
      mode: (st && st.mode) || 'default',
      email,
      evidence: ((st && st.evidence) || []).map(e => e.dataUrl
        ? { label: (e.src && e.src.id) || 'screenshot', kind: 'image', mediaType: e.mediaType || 'image/jpeg', data: e.dataUrl.split(',')[1] }
        : { label: (e.src && e.src.id) || 'evidence' }),
    }),
  });
  if (!res.ok) { const err = new Error('trial ' + res.status); err.status = res.status; throw err; }
  return res.json();
}
function withTheme(api) {
  return {
    ...api,
    plaintiff: { ...api.plaintiff, color: JP.lavender },
    defendant: { ...api.defendant, color: JP.bubblegum },
  };
}

// base jury (emoji + vote stay constant; breed/take come from I18N)
const JUROR_BASE = [
  { emoji: '🦮', vote: 'innocent' },
  { emoji: '🐕', vote: 'guilty' },
  { emoji: '🐶', vote: 'guilty' },
  { emoji: '🐺', vote: 'guilty' },
  { emoji: '🐕‍🦺', vote: 'guilty' },
];
const VOTE_BASE = {
  guilty:   { emoji: '🔨', color: JP.red, bg: 'rgba(255,84,112,0.12)' },
  innocent: { emoji: '😇', color: JP.mint, bg: 'rgba(52,211,166,0.14)' },
};
// Jury votes scale with the defendant's blame share — so each case differs instead of
// always reading 4/5. Only the Golden Retriever (idx0, "forgive everyone") and Shiba
// (idx1, "needs more evidence") ever acquit, matching their takes; the rest always convict.
// Clamped to a 3–5 guilty majority so it never contradicts a GUILTY ruling.
function juryFor(c) {
  const blame = (c && typeof c.blame === 'number') ? c.blame : 67;
  const guilty = blame >= 90 ? 5 : blame >= 75 ? 4 : 3;
  const acquit = [0, 1].slice(0, 5 - guilty);
  return JUROR_BASE.map((j, i) => ({ emoji: j.emoji, vote: acquit.includes(i) ? 'innocent' : 'guilty' }));
}

const BUILD_ICONS = ['📜', '💗', '🔀', '🚩', '💚', '🔮'];

function BuildScreen({ go, state, setState, chaos, off, mascot, lang }) {
  const tr = I18N[lang];
  const steps = tr.build.steps;
  const [done, setDone] = React.useState(0);
  const [settled, setSettled] = React.useState(false);  // backend call resolved or failed
  const [paywall, setPaywall] = React.useState(() => window.JPB ? !JPB.canRun() : false);
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (paywall) return;
    if (done >= steps.length) return;
    const t = setTimeout(() => setDone(d => d + 1), done === 0 ? 500 : 720);
    return () => clearTimeout(t);
  }, [done, steps.length, paywall]);

  // Real AI verdict — gated by free credits; premium modes enforced server-side (402).
  React.useEffect(() => {
    if (paywall || startedRef.current) return;
    startedRef.current = true;
    let alive = true;
    fetchTrial(state, lang)
      .then(api => {
        if (!alive) return;
        if (api && api.ruling && setState) setState(s => ({ ...s, caseData: withTheme(api) }));
        if (window.JPB) JPB.consume();
      })
      .catch(err => {
        if (err && err.status === 402 && alive) { startedRef.current = false; setPaywall(true); }
        // other errors: keep the sample caseData so the demo never breaks
      })
      .finally(() => { if (alive) setSettled(true); });
    return () => { alive = false; };
  }, [paywall]);

  if (paywall) {
    const reason = (state && state.mode === 'savage' && (!window.JPB || !JPB.subscribed())) ? 'savage' : 'limit';
    return <Paywall reason={reason} lang={lang} mascot={mascot} chaos={chaos} off={off}
      onClose={() => go('upload')}
      onUnlocked={() => { if (setState) setState(s => ({ ...s, mode: 'default' })); startedRef.current = false; setSettled(false); setDone(0); setPaywall(false); }} />;
  }

  const finished = done >= steps.length && settled;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <Backdrop tint="court">
      <Particles kind="paws" count={chaos ? 10 : 5} run={!off} />
      <div style={{ position: 'relative', zIndex: 3, height: '100%', display: 'flex', flexDirection: 'column',
        padding: '70px 24px 28px', boxSizing: 'border-box' }}>
        <button onClick={() => go('upload')} className="jp-tap" style={{ position: 'absolute', top: 56, left: 18, zIndex: 6,
          width: 38, height: 38, borderRadius: 999, cursor: 'pointer', border: '1.5px solid rgba(255,255,255,0.9)',
          background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(14px)', fontSize: 18, color: JP.ink,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <Mascot size={120} emoji={mascot} />
            <div className="jp-bob" style={{ position: 'absolute', right: -6, top: 2, fontSize: 30, animationDelay: '-1s' }}>🔍</div>
          </div>
          <ReactionBubble text={finished ? tr.build.bubbleDone : tr.build.bubbleWork} tail="top" />
        </div>

        <h2 style={{ margin: '22px 0 4px', textAlign: 'center', fontFamily: 'Fredoka', fontWeight: 600,
          fontSize: 24, color: JP.ink }}>{tr.build.title}</h2>

        {/* progress bar */}
        <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.6)', margin: '8px 0 18px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', borderRadius: 999,
            background: `linear-gradient(90deg, ${JP.pink}, ${JP.bubblegum})`,
            transition: 'width 0.6s cubic-bezier(.34,1.56,.64,1)' }} />
        </div>

        {/* checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {steps.map((s, i) => {
            const isDone = i < done, active = i === done;
            return (
              <Glass key={i} soft style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                opacity: isDone || active ? 1 : 0.4,
                transform: active ? 'scale(1.015)' : 'scale(1)',
                transition: 'all 0.4s ease' }}>
                <span style={{ fontSize: 22 }} className={active ? 'jp-bob' : ''}>{BUILD_ICONS[i]}</span>
                <span style={{ flex: 1, fontFamily: 'Fredoka', fontWeight: 500, fontSize: 15, color: JP.ink }}>{s.label}</span>
                {isDone && s.tail && <span style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 12,
                  color: JP.bubblegum, background: 'rgba(255,77,151,0.12)', padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{s.tail}</span>}
                <span style={{ fontSize: 17, color: JP.mint, width: 18, textAlign: 'center' }}>
                  {isDone ? '✓' : active ? <span className="jp-spin" style={{ display: 'inline-block' }}>🐾</span> : ''}
                </span>
              </Glass>
            );
          })}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 18 }}>
          <PawButton full onClick={finished ? () => go('court') : undefined} style={{
            opacity: finished ? 1 : 0.45, pointerEvents: finished ? 'auto' : 'none' }}>
            {finished ? tr.build.enter : tr.build.investigating}
          </PawButton>
        </div>
      </div>
    </Backdrop>
  );
}

// ───────────────────── COURTROOM ─────────────────────
function CourtScreen({ go, state, chaos, off, mascot, lang }) {
  const tr = I18N[lang];
  const c = state.caseData;
  const quip = useRotating(tr.quipsCourt, 2800);
  const jury = juryFor(c);
  const [revealed, setRevealed] = React.useState(0);
  React.useEffect(() => {
    if (revealed >= jury.length) return;
    const t = setTimeout(() => setRevealed(r => r + 1), revealed === 0 ? 900 : 650);
    return () => clearTimeout(t);
  }, [revealed]);
  const allIn = revealed >= jury.length;
  const guilty = jury.slice(0, revealed).filter(j => j.vote === 'guilty').length;
  const fallback = [{ id: 'imessage', emoji: '💬' }, { id: 'whatsapp', emoji: '🟢' }, { id: 'photo', emoji: '📸' }];

  return (
    <Backdrop tint="court">
      <Particles kind="paws" count={chaos ? 8 : 4} run={!off} />
      <div style={{ position: 'relative', zIndex: 3, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ padding: '58px 18px 26px' }}>
          {/* session banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <button onClick={() => go('build')} className="jp-tap" style={{ position: 'absolute', left: 18,
              width: 38, height: 38, borderRadius: 999, cursor: 'pointer', border: '1.5px solid rgba(255,255,255,0.9)',
              background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(14px)', fontSize: 18, color: JP.ink }}>‹</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 999,
              background: 'rgba(255,77,151,0.12)', border: '1.5px solid rgba(255,77,151,0.3)' }}>
              <span className="jp-pulse" style={{ width: 8, height: 8, borderRadius: 999, background: JP.red, display: 'inline-block' }} />
              <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 12.5, color: '#C13A53', letterSpacing: 1, whiteSpace: 'nowrap' }}>
                {tr.court.session}
              </span>
            </div>
          </div>

          {/* judge bench */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ReactionBubble text={quip} />
            <Mascot size={116} badge="🔨" emoji={mascot} />
            <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 15, color: JP.ink }}>{tr.court.presiding}</div>
          </div>

          {/* parties */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', margin: '10px 0 4px' }}>
            <PartyCard p={c.plaintiff} tag={tr.court.plaintiff} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="jp-bob" style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 18, color: JP.bubblegum,
                background: '#fff', borderRadius: 999, width: 38, height: 38, display: 'flex', alignItems: 'center',
                justifyContent: 'center', boxShadow: '0 6px 14px rgba(255,77,151,0.3)' }}>VS</div>
            </div>
            <PartyCard p={c.defendant} tag={tr.court.defendant} />
          </div>

          {/* evidence strip */}
          <div style={{ margin: '16px 0 6px' }}>
            <SectionLabel icon="🗂️" text={tr.court.evidenceOnFile(Math.max(state.evidence.length, 3))} />
            <div style={{ display: 'flex', gap: 9, overflowX: 'auto', paddingBottom: 6 }}>
              {(state.evidence.length ? state.evidence : fallback).slice(0, 6).map((e, i) => {
                const sid = e.src ? e.src.id : e.id;
                const emoji = e.src ? e.src.emoji : e.emoji;
                return (
                  <div key={i} className="jp-floatin" style={{ animationDelay: (i*0.05)+'s', flexShrink: 0,
                    width: 86, background: '#fff', borderRadius: 14, padding: '12px 8px', textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 6px 14px rgba(214,98,168,0.12)' }}>
                    <div style={{ fontSize: 24 }}>{emoji}</div>
                    <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 11, color: JP.ink, marginTop: 4,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr.sources[sid] || ''}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* dog jury */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionLabel icon="🐾" text={tr.court.dogJury} />
              <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 12.5,
                color: allIn ? JP.red : JP.inkSoft }}>
                {allIn ? tr.court.votedGuilty(guilty) : tr.court.deliberating}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {jury.map((j, i) => {
                const shown = i < revealed;
                const vm = VOTE_BASE[j.vote];
                const jt = tr.jurors[i];
                return (
                  <Glass key={i} soft style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                    <span style={{ fontSize: 26 }}>{j.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 14.5, color: JP.ink }}>{jt.breed}</div>
                      <div style={{ fontFamily: 'Nunito', fontWeight: 600, fontSize: 11.5, color: JP.inkSoft }}>“{jt.take}”</div>
                    </div>
                    <div className={shown ? 'jp-pop' : ''} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999,
                      background: shown ? vm.bg : 'rgba(255,255,255,0.5)',
                      border: `1.5px solid ${shown ? vm.color : 'rgba(196,168,188,0.4)'}`,
                      minWidth: 78, justifyContent: 'center',
                    }}>
                      {shown ? <>
                        <span style={{ fontSize: 14 }}>{vm.emoji}</span>
                        <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 13, color: vm.color }}>{tr.vote[j.vote]}</span>
                      </> : <span className="jp-spin" style={{ fontSize: 14 }}>🐾</span>}
                    </div>
                  </Glass>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 18, paddingBottom: 6 }}>
            <PawButton full onClick={allIn ? () => go('verdict') : undefined} style={{
              opacity: allIn ? 1 : 0.45, pointerEvents: allIn ? 'auto' : 'none' }}>
              {allIn ? tr.court.deliver : tr.court.juryDeliberating}
            </PawButton>
          </div>
        </div>
      </div>
    </Backdrop>
  );
}

function PartyCard({ p, tag }) {
  return (
    <Glass style={{ flex: 1, padding: '13px 11px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 9.5, letterSpacing: 1, color: JP.inkSoft }}>{tag}</div>
      <div style={{ fontSize: 38, margin: '4px 0' }}>{p.emoji}</div>
      <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 16, color: JP.ink }}>{p.name}</div>
      <div style={{ fontFamily: 'Nunito', fontWeight: 700, fontSize: 10.5, color: p.color, marginBottom: 6 }}>{p.role}</div>
      <div style={{ fontFamily: 'Nunito', fontWeight: 600, fontSize: 11.5, color: JP.inkSoft, lineHeight: 1.3 }}>{p.quote}</div>
    </Glass>
  );
}

function SectionLabel({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 14.5, color: JP.ink }}>{text}</span>
    </div>
  );
}

// ─────────── shareable LONG-image verdict card (长图, canvas, no deps) ───────────
function _rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// wrap that handles BOTH Chinese (no spaces, per-char) and English (per-word)
function _wrapText(ctx, text, x, y, maxW, lh, draw = true) {
  const t = String(text || '');
  const hasCJK = /[一-鿿]/.test(t);
  const units = hasCJK ? Array.from(t) : t.split(/\s+/);
  const glue = hasCJK ? '' : ' ';
  let line = '', yy = y, lines = 0;
  for (const u of units) {
    const test = line ? line + glue + u : u;
    if (ctx.measureText(test).width > maxW && line) {
      if (draw) ctx.fillText(line, x, yy);
      line = u; yy += lh; lines++;
    } else line = test;
  }
  if (line) { if (draw) ctx.fillText(line, x, yy); lines++; }
  return yy + lh;
}
function _loadImg(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

async function renderVerdictLongImage(c, lang, drama, guilty, mascot) {
  const tr = I18N[lang];
  const W = 1080, PAD = 70, CW = W - PAD * 2;
  const PINK = '#FF4D97', INK = '#3A1F33', SOFT = '#9A7690', RED = '#FF5470', MINT = '#34D3A6', LAV = '#A78BFA';
  const F = (w, s) => `${w} ${s}px -apple-system, "PingFang SC", "Microsoft YaHei", Arial, sans-serif`;

  // measure pass for judge note + flags to compute height
  const m = document.createElement('canvas').getContext('2d');
  m.font = F(600, 34);
  // card = title block (116) + wrapped body + bottom padding
  const noteH = 116 + _wrapText(m, c.judgeNote, 0, 0, CW - 80, 48, false) + 28;
  const flagsH = (c.redFlags.length + c.greenFlags.length) * 64 + 150;
  m.font = F(700, 40);
  const capH = _wrapText(m, c.caption, 0, 0, CW - 80, 54, false) + 110;
  const H = 460 + 210 + noteH + 240 + 285 + 230 + flagsH + capH + 170;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // bg
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#FFE8F4'); g.addColorStop(0.5, '#F3E9FF'); g.addColorStop(1, '#FFE6DC');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  let y = 90;
  ctx.textAlign = 'center';

  // header — judge avatar in a circle
  const photo = /[\/.]/.test(String(mascot)) ? await _loadImg(mascot) : null;
  const cx = W / 2, r = 95;
  if (photo) {
    ctx.save(); ctx.beginPath(); ctx.arc(cx, y + r, r, 0, Math.PI * 2); ctx.clip();
    const s = Math.max((r * 2) / photo.width, (r * 2) / photo.height);
    ctx.drawImage(photo, cx - (photo.width * s) / 2, y + r - (photo.height * s) / 2, photo.width * s, photo.height * s);
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, y + r, r, 0, Math.PI * 2);
    ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.stroke();
  } else {
    ctx.font = F(400, 130); ctx.fillText(String(mascot || '🐶'), cx, y + r + 45);
  }
  y += r * 2 + 70;
  ctx.fillStyle = INK; ctx.font = F(800, 52);
  ctx.fillText('⚖️ ' + (tr.appName || 'Judge Paws') + ' 🐾', cx, y);
  y += 44;
  ctx.fillStyle = SOFT; ctx.font = F(700, 28);
  ctx.fillText(tr.verdict.caseLine, cx, y);
  y += 80;

  // ruling stamp
  ctx.fillStyle = SOFT; ctx.font = F(800, 30);
  ctx.fillText(tr.verdict.isFound(c.rulingOf), cx, y);
  y += 30;
  ctx.save();
  ctx.translate(cx, y + 70); ctx.rotate(-0.045);
  ctx.font = F(800, 64);
  const rw = Math.min(ctx.measureText(c.ruling + ' 🔨').width + 90, CW);
  const rg = ctx.createLinearGradient(-rw / 2, 0, rw / 2, 0);
  rg.addColorStop(0, '#FF87BE'); rg.addColorStop(1, PINK);
  ctx.fillStyle = rg; _rr(ctx, -rw / 2, -55, rw, 120, 28); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
  ctx.fillText(c.ruling + ' 🔨', 0, 6);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  y += 190;

  // judge note card
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; _rr(ctx, PAD, y, CW, noteH, 30); ctx.fill();
  ctx.fillStyle = PINK; ctx.font = F(800, 30); ctx.textAlign = 'left';
  ctx.fillText('🐾 ' + tr.verdict.ruling, PAD + 40, y + 58);
  ctx.fillStyle = INK; ctx.font = F(600, 34);
  _wrapText(ctx, c.judgeNote, PAD + 40, y + 116, CW - 80, 48);
  y += noteH + 50;

  // drama meter
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; _rr(ctx, PAD, y, CW, 180, 30); ctx.fill();
  ctx.fillStyle = INK; ctx.font = F(800, 30);
  ctx.fillText('📺 ' + tr.verdict.dramaMeter, PAD + 40, y + 58);
  const dv = c.drama != null ? c.drama : drama;
  const tierIdx = Math.min(4, Math.floor(dv / 20.0001));
  ctx.fillStyle = PINK; ctx.font = F(800, 30); ctx.textAlign = 'right';
  ctx.fillText(dv + ' · ' + tr.dramaTiers[tierIdx], PAD + CW - 40, y + 58);
  ctx.textAlign = 'left';
  const SEG = 10, segW = (CW - 80 - 9 * 8) / SEG;
  for (let i = 0; i < SEG; i++) {
    ctx.fillStyle = i < Math.round(dv / 10) ? PINK : 'rgba(255,77,151,0.18)';
    _rr(ctx, PAD + 40 + i * (segW + 8), y + 96, segW, 28, 14); ctx.fill();
  }
  y += 230;

  // credit scores
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; _rr(ctx, PAD, y, CW, 235, 30); ctx.fill();
  ctx.fillStyle = INK; ctx.font = F(800, 30);
  ctx.fillText('💳 ' + tr.verdict.creditScore, PAD + 40, y + 58);
  const drawScore = (px, who, score, col) => {
    ctx.beginPath(); ctx.arc(px, y + 130, 48, -Math.PI / 2, -Math.PI / 2 + (score / 100) * Math.PI * 2);
    ctx.lineWidth = 12; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = F(800, 36); ctx.textAlign = 'center';
    ctx.fillText(String(score), px, y + 143);
    ctx.fillStyle = SOFT; ctx.font = F(700, 26);
    ctx.fillText(who, px, y + 200);
    ctx.textAlign = 'left';
  };
  drawScore(W / 2 - 200, c.plaintiff.name, c.plaintiff.score, LAV);
  drawScore(W / 2 + 200, c.defendant.name, c.defendant.score, PINK);
  y += 285;

  // blame split bar
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; _rr(ctx, PAD, y, CW, 180, 30); ctx.fill();
  ctx.fillStyle = INK; ctx.font = F(800, 30);
  ctx.fillText('🥧 ' + tr.verdict.whoStarted, PAD + 40, y + 58);
  const bw = CW - 80, defW = Math.round(bw * (c.blame / 100));
  ctx.fillStyle = PINK; _rr(ctx, PAD + 40, y + 88, defW, 40, 20); ctx.fill();
  ctx.fillStyle = LAV; _rr(ctx, PAD + 40 + defW, y + 88, bw - defW, 40, 20); ctx.fill();
  ctx.fillStyle = SOFT; ctx.font = F(700, 26);
  ctx.fillText(c.defendant.name + ' ' + c.blame + '%', PAD + 40, y + 162);
  ctx.textAlign = 'right';
  ctx.fillText(c.plaintiff.name + ' ' + (100 - c.blame) + '%', PAD + CW - 40, y + 162);
  ctx.textAlign = 'left';
  y += 230;

  // flags
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; _rr(ctx, PAD, y, CW, flagsH, 30); ctx.fill();
  let fy = y + 64;
  ctx.fillStyle = RED; ctx.font = F(800, 30);
  ctx.fillText('🚩 ' + tr.verdict.redFlags, PAD + 40, fy); fy += 26;
  ctx.font = F(700, 30);
  for (const f of c.redFlags) {
    ctx.fillStyle = 'rgba(255,84,112,0.10)';
    const fw = Math.min(ctx.measureText(f).width + 60, CW - 80);
    _rr(ctx, PAD + 40, fy, fw, 50, 25); ctx.fill();
    ctx.fillStyle = '#C13A53'; ctx.fillText(f, PAD + 70, fy + 35); fy += 64;
  }
  fy += 24;
  ctx.fillStyle = MINT; ctx.font = F(800, 30);
  ctx.fillText('💚 ' + tr.verdict.greenFlags, PAD + 40, fy); fy += 26;
  ctx.font = F(700, 30);
  for (const f of c.greenFlags) {
    ctx.fillStyle = 'rgba(52,211,166,0.12)';
    const fw = Math.min(ctx.measureText(f).width + 60, CW - 80);
    _rr(ctx, PAD + 40, fy, fw, 50, 25); ctx.fill();
    ctx.fillStyle = '#0E8A66'; ctx.fillText(f, PAD + 70, fy + 35); fy += 64;
  }
  y += flagsH + 50;

  // jury line + caption
  ctx.textAlign = 'center'; ctx.fillStyle = '#C13A53'; ctx.font = F(800, 32);
  ctx.fillText('🐕🐺🐶🦮 ' + tr.verdict.convicted(guilty), cx, y);
  y += 70;
  ctx.fillStyle = INK; ctx.font = F(700, 40);
  y = _wrapText(ctx, c.caption, cx, y, CW - 80, 54);

  // watermark footer
  ctx.fillStyle = SOFT; ctx.font = F(800, 30);
  ctx.fillText('🐾 ' + (location.host || 'judgepaws.app'), cx, H - 60);

  return cv;
}

async function shareVerdictLongImage(c, lang, drama, guilty, mascot) {
  try {
    const cv = await renderVerdictLongImage(c, lang, drama, guilty, mascot);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'judge-paws-verdict.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: c.caption || '' }); return; } catch (e) {}
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'judge-paws-verdict.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (e) {}
}

// ───────────────────── VERDICT ─────────────────────
function VerdictScreen({ go, state, chaos, off, mascot, drama, lang }) {
  const tr = I18N[lang];
  const c = state.caseData;
  const [stamp, setStamp] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setStamp(true), 400); return () => clearTimeout(t); }, []);
  const guilty = juryFor(c).filter(j => j.vote === 'guilty').length;
  return (
    <Backdrop tint="pink">
      <Particles kind="confetti" count={chaos ? 22 : 12} run={!off} />
      <div style={{ position: 'relative', zIndex: 3, height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: '58px 18px 120px' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18, paddingRight: 76, paddingLeft: 8 }}>
            <Mascot size={66} float={false} badge="🔨" emoji={mascot} />
            <div>
              <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 22, color: JP.ink, lineHeight: 1.1 }}>{tr.verdict.title}</div>
              <div style={{ fontFamily: 'Nunito', fontWeight: 700, fontSize: 12, color: JP.inkSoft, whiteSpace: 'nowrap' }}>{tr.verdict.caseLine}</div>
            </div>
          </div>

          {/* HERO shareable card */}
          <Glass style={{ padding: '22px 20px', overflow: 'hidden',
            background: 'linear-gradient(165deg, rgba(255,255,255,0.85), rgba(255,236,246,0.8))' }}>
            {/* ruling */}
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 12, letterSpacing: 1.5, color: JP.inkSoft }}>
                {tr.verdict.isFound(c.rulingOf)}
              </div>
              <div className={stamp ? 'jp-stamp' : ''} style={{ margin: '8px auto', display: 'inline-block',
                fontFamily: 'Fredoka', fontWeight: 600, fontSize: 32, lineHeight: 1.05, color: '#fff',
                padding: '8px 20px', borderRadius: 18, transform: 'rotate(-3deg)',
                background: `linear-gradient(160deg, ${JP.pink}, ${JP.bubblegum})`,
                boxShadow: '0 14px 30px rgba(255,77,151,0.45)' }}>
                {c.ruling} 🔨
              </div>
            </div>

            {/* judge note */}
            <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.9)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>🐾</span>
                <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 13, color: JP.bubblegum, whiteSpace: 'nowrap' }}>{tr.verdict.ruling}</span>
              </div>
              <p style={{ margin: 0, fontFamily: 'Nunito', fontWeight: 600, fontSize: 13.5, lineHeight: 1.5, color: JP.ink }}>{c.judgeNote}</p>
            </div>

            {/* drama meter */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <SectionLabel icon="📺" text={tr.verdict.dramaMeter} />
              <DramaMeter value={c.drama != null ? c.drama : drama} tierLabels={tr.dramaTiers} />
            </div>

            {/* jury result */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 16px', borderRadius: 16, background: 'rgba(255,84,112,0.10)',
              border: '1.5px solid rgba(255,84,112,0.3)' }}>
              <span style={{ fontSize: 18 }}>🐕🐺🐶🦮</span>
              <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 14.5, color: '#C13A53' }}>
                {tr.verdict.convicted(guilty)}
              </span>
            </div>

            {/* watermark */}
            <div style={{ marginTop: 16, textAlign: 'center', fontFamily: 'Fredoka', fontWeight: 600,
              fontSize: 12, color: JP.inkFaint }}>🐾 judgepaws.app</div>
          </Glass>

          {/* case file: what happened + key evidence (showcase cases carry these) */}
          {(c.story || (c.evidence && c.evidence.length)) ? (
            <Glass style={{ marginTop: 14, padding: '18px 16px' }}>
              {c.story ? (
                <div style={{ marginBottom: (c.evidence && c.evidence.length) ? 16 : 0 }}>
                  <SectionLabel icon="📝" text={tr.court.testimony} />
                  <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '12px 14px',
                    border: '1px solid rgba(255,255,255,0.9)', fontFamily: 'Nunito', fontWeight: 600,
                    fontSize: 13, color: JP.ink, lineHeight: 1.5 }}>
                    “{c.story}”
                  </div>
                </div>
              ) : null}
              {c.evidence && c.evidence.length ? (
                <div>
                  <SectionLabel icon="🧾" text={tr.court.keyEvidence} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {c.evidence.map((e, i) => (
                      <div key={i} className="jp-floatin" style={{ animationDelay: (i * 0.06) + 's',
                        background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '11px 13px',
                        border: '1px solid rgba(255,255,255,0.9)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: (e.them || e.cap) ? 8 : 0 }}>
                          <span style={{ fontSize: 14 }}>{e.emoji}</span>
                          <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 12, color: JP.ink }}>{tr.sources[e.src] || e.src}</span>
                        </div>
                        {e.cap ? (
                          <div style={{ fontFamily: 'Nunito', fontWeight: 600, fontSize: 12.5, color: JP.inkSoft, lineHeight: 1.4 }}>{e.cap}</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {e.them ? <div style={{ alignSelf: 'flex-start', maxWidth: '84%', background: '#F1ECF4', color: JP.ink,
                              padding: '7px 11px', borderRadius: '14px 14px 14px 4px', fontFamily: 'Nunito', fontWeight: 600, fontSize: 12.5, lineHeight: 1.3 }}>{e.them}</div> : null}
                            {e.me ? <div style={{ alignSelf: 'flex-end', maxWidth: '84%', color: '#fff',
                              background: `linear-gradient(180deg, ${JP.pink}, ${JP.bubblegum})`,
                              padding: '7px 11px', borderRadius: '14px 14px 4px 14px', fontFamily: 'Nunito', fontWeight: 700, fontSize: 12.5, lineHeight: 1.3 }}>{e.me}</div> : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Glass>
          ) : null}

          {/* scores */}
          <Glass style={{ marginTop: 14, padding: '18px 16px' }}>
            <SectionLabel icon="💳" text={tr.verdict.creditScore} />
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <ScoreRing value={c.plaintiff.score} label={c.plaintiff.name} emoji={c.plaintiff.emoji} color={JP.lavender} />
              <ScoreRing value={c.defendant.score} label={c.defendant.name} emoji={c.defendant.emoji} color={JP.bubblegum} />
            </div>
          </Glass>

          {/* who started it */}
          <Glass style={{ marginTop: 14, padding: '18px 16px' }}>
            <SectionLabel icon="🥧" text={tr.verdict.whoStarted} />
            <BlamePie a={c.blame} b={100 - c.blame} aLabel={c.defendant.name} bLabel={c.plaintiff.name} centerLabel={tr.blame} />
          </Glass>

          {/* flags */}
          <Glass style={{ marginTop: 14, padding: '18px 16px' }}>
            <SectionLabel icon="🚩" text={tr.verdict.redFlags} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {c.redFlags.map((f, i) => <FlagPill key={i} text={f} type="red" />)}
            </div>
            <div style={{ height: 14 }} />
            <SectionLabel icon="💚" text={tr.verdict.greenFlags} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {c.greenFlags.map((f, i) => <FlagPill key={i} text={f} type="green" />)}
            </div>
          </Glass>

          {/* viral caption */}
          <Glass soft style={{ marginTop: 14, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 11, letterSpacing: 1, color: JP.inkSoft, marginBottom: 6 }}>
              {tr.verdict.caption}
            </div>
            <div style={{ fontFamily: 'Fredoka', fontWeight: 500, fontSize: 16, color: JP.ink, lineHeight: 1.35 }}>{c.caption}</div>
          </Glass>
        </div>
      </div>

      {/* sticky share footer */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5, padding: '14px 18px 30px',
        background: 'linear-gradient(180deg, rgba(255,241,248,0), rgba(255,241,248,0.95) 40%)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <PawButton full onClick={() => {
            shareVerdictLongImage(c, lang, drama != null ? drama : c.drama, guilty, mascot);
            if (window.JPB) JPB.earnBonus();
            state.onShare && state.onShare();
          }}>{tr.verdict.share}</PawButton>
          <PawButton secondary small onClick={() => go('home')} style={{ flexShrink: 0, paddingLeft: 18, paddingRight: 18 }}>{tr.verdict.newTrial}</PawButton>
        </div>
      </div>
    </Backdrop>
  );
}

Object.assign(window, { BuildScreen, CourtScreen, VerdictScreen, buildCase, JUROR_BASE, VOTE_BASE });
