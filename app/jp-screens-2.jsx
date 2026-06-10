/* Judge Paws — screens part 2: Build Case, Courtroom + Jury, Verdict */

// ───────────── the sample case ─────────────
const ROLE_BY_TYPE = {
  couple:        { a: 'Girlfriend', b: 'Boyfriend' },
  situationship: { a: 'The One Who Caught Feelings', b: 'The One Who Didn’t' },
  ex:            { a: 'The Ex', b: 'The Other Ex' },
  roommate:      { a: 'Roommate A', b: 'Roommate B' },
  bff:           { a: 'Best Friend', b: 'Best Friend' },
  family:        { a: 'The Sibling', b: 'The Other Sibling' },
};

function buildCase(relType) {
  const roles = ROLE_BY_TYPE[relType] || ROLE_BY_TYPE.couple;
  return {
    plaintiff: { name: 'Maya', emoji: '👩🏻', role: roles.a, score: 84, color: JP.lavender,
      quote: '“He left me on read for 6 hours and then replied… ‘k’.”' },
    defendant: { name: 'Jordan', emoji: '👨🏽', role: roles.b, score: 78, color: JP.bubblegum,
      quote: '“I was AT THE GYM. ‘k’ literally means okay, your honor.”' },
    drama: 82,
    blame: 67, // defendant's share
    redFlags: ['Left on read 6h', 'Replied “k”', 'Said “you’re overthinking”', 'Liked an ex’s post mid-fight'],
    greenFlags: ['Apologized (eventually)', 'Brought up feelings calmly'],
    ruling: 'PAW-SITIVELY GUILTY',
    rulingOf: 'Jordan',
    judgeNote: 'The court finds that sending “k” to a six-hour silence constitutes emotional warfare. However, Maya’s 14 follow-up texts did not help her case. Both parties are sentenced to one (1) honest conversation.',
    caption: '“My boyfriend got convicted by 4 AI dogs for sending ‘k’ 😭🔨”',
  };
}

// ─────────── backend trial (real AI verdict) ───────────
// Calls POST /api/trials and merges the result into the case object.
// Falls back silently to buildCase() if the backend is unavailable.
async function fetchTrial(relType, evidence) {
  const res = await fetch('/api/trials', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      relationshipType: relType || 'couple',
      evidence: (evidence || []).map(e => ({ label: e?.src?.label, text: e?.text })),
    }),
  });
  if (!res.ok) throw new Error('trial failed');
  return res.json();
}
function withTheme(api) {
  // attach client-only theme colors the backend doesn't return
  return {
    ...api,
    plaintiff: { ...api.plaintiff, color: JP.lavender },
    defendant: { ...api.defendant, color: JP.bubblegum },
  };
}

const JURORS = [
  { breed: 'Golden Retriever', emoji: '🦮', take: 'Forgive everyone', vote: 'innocent' },
  { breed: 'Shiba Inu', emoji: '🐕', take: 'Needs more evidence', vote: 'guilty' },
  { breed: 'Chihuahua', emoji: '🐶', take: 'Everyone is guilty', vote: 'guilty' },
  { breed: 'Husky', emoji: '🐺', take: 'Too emotional, honestly', vote: 'guilty' },
  { breed: 'Corgi', emoji: '🐕‍🦺', take: 'Just here for drama', vote: 'guilty' },
];
const VOTE_META = {
  guilty:   { label: 'Guilty', emoji: '🔨', color: JP.red, bg: 'rgba(255,84,112,0.12)' },
  innocent: { label: 'Innocent', emoji: '😇', color: JP.mint, bg: 'rgba(52,211,166,0.14)' },
};

// ───────────────────── BUILD CASE ─────────────────────
const BUILD_STEPS = [
  { icon: '📜', label: 'Reconstructing the timeline', tail: '' },
  { icon: '💗', label: 'Tagging emotional moments', tail: '7 found' },
  { icon: '🔀', label: 'Cross-examining contradictions', tail: '3 found' },
  { icon: '🚩', label: 'Sniffing out red flags', tail: '4 found' },
  { icon: '💚', label: 'Detecting green flags', tail: '2 found' },
  { icon: '🔮', label: 'Mapping turning points', tail: '2 found' },
];

function BuildScreen({ go, state, setState, chaos, off, mascot }) {
  const [done, setDone] = React.useState(0); // how many steps complete
  const [settled, setSettled] = React.useState(false); // backend call resolved or failed
  React.useEffect(() => {
    if (done >= BUILD_STEPS.length) return;
    const t = setTimeout(() => setDone(d => d + 1), done === 0 ? 500 : 720);
    return () => clearTimeout(t);
  }, [done]);
  // Real AI verdict: fetch once on mount, upgrade caseData; fall back silently.
  React.useEffect(() => {
    let alive = true;
    fetchTrial(state && state.relType, state && state.evidence)
      .then(api => { if (alive && api && api.ruling && setState) setState(s => ({ ...s, caseData: withTheme(api) })); })
      .catch(() => {}) // keep the hardcoded buildCase() result
      .finally(() => { if (alive) setSettled(true); });
    return () => { alive = false; };
  }, []);
  const finished = done >= BUILD_STEPS.length && settled;
  const pct = Math.round((done / BUILD_STEPS.length) * 100);
  return (
    <Backdrop tint="court">
      <Particles kind="paws" count={chaos ? 10 : 5} run={!off} />
      <div style={{ position: 'relative', zIndex: 3, height: '100%', display: 'flex', flexDirection: 'column',
        padding: '70px 24px 28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <Mascot size={120} emoji={mascot} />
            <div className="jp-bob" style={{ position: 'absolute', right: -6, top: 2, fontSize: 30,
              animationDelay: '-1s' }}>🔍</div>
          </div>
          <ReactionBubble text={finished ? 'Your honor has reached a conclusion.' : 'Hmm… let me sniff the evidence. 🐾'}
            tail="top" />
        </div>

        <h2 style={{ margin: '22px 0 4px', textAlign: 'center', fontFamily: 'Fredoka', fontWeight: 600,
          fontSize: 24, color: JP.ink }}>Building the case…</h2>

        {/* progress bar */}
        <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.6)', margin: '8px 0 18px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', borderRadius: 999,
            background: `linear-gradient(90deg, ${JP.pink}, ${JP.bubblegum})`,
            transition: 'width 0.6s cubic-bezier(.34,1.56,.64,1)' }} />
        </div>

        {/* checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {BUILD_STEPS.map((s, i) => {
            const isDone = i < done, active = i === done;
            return (
              <Glass key={i} soft style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                opacity: isDone || active ? 1 : 0.4,
                transform: active ? 'scale(1.015)' : 'scale(1)',
                transition: 'all 0.4s ease' }}>
                <span style={{ fontSize: 22 }} className={active ? 'jp-bob' : ''}>{s.icon}</span>
                <span style={{ flex: 1, fontFamily: 'Fredoka', fontWeight: 500, fontSize: 15, color: JP.ink }}>{s.label}</span>
                {isDone && s.tail && <span style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 12,
                  color: JP.bubblegum, background: 'rgba(255,77,151,0.12)', padding: '3px 9px', borderRadius: 999 }}>{s.tail}</span>}
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
            {finished ? 'Enter Relationship Court ⚖️' : 'Investigating…'}
          </PawButton>
        </div>
      </div>
    </Backdrop>
  );
}

// ───────────────────── COURTROOM ─────────────────────
const COURT_QUIPS = [
  'OBJECTION! That “k” was hostile.',
  'Order! Order in the group chat!',
  'Exhibit A is… a lot. 🐾',
  'The court will now cringe.',
];

function CourtScreen({ go, state, chaos, off, mascot }) {
  const c = state.caseData;
  const quip = useRotating(COURT_QUIPS, 2800);
  const [revealed, setRevealed] = React.useState(0);
  React.useEffect(() => {
    if (revealed >= JURORS.length) return;
    const t = setTimeout(() => setRevealed(r => r + 1), revealed === 0 ? 900 : 650);
    return () => clearTimeout(t);
  }, [revealed]);
  const allIn = revealed >= JURORS.length;
  const guilty = JURORS.slice(0, revealed).filter(j => j.vote === 'guilty').length;

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
                SESSION 001 · IN SESSION
              </span>
            </div>
          </div>

          {/* judge bench */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <ReactionBubble text={quip} />
            <Mascot size={116} badge="🔨" emoji={mascot} />
            <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 15, color: JP.ink }}>Judge Paws presiding</div>
          </div>

          {/* parties */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', margin: '10px 0 4px' }}>
            <PartyCard p={c.plaintiff} tag="PLAINTIFF" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="jp-bob" style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 18, color: JP.bubblegum,
                background: '#fff', borderRadius: 999, width: 38, height: 38, display: 'flex', alignItems: 'center',
                justifyContent: 'center', boxShadow: '0 6px 14px rgba(255,77,151,0.3)' }}>VS</div>
            </div>
            <PartyCard p={c.defendant} tag="DEFENDANT" />
          </div>

          {/* evidence strip */}
          <div style={{ margin: '16px 0 6px' }}>
            <SectionLabel icon="🗂️" text={`Evidence on file (${Math.max(state.evidence.length, 3)})`} />
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
              {(state.evidence.length ? state.evidence : [{src:{label:'iMessage'}},{src:{label:'Voice Note'}},{src:{label:'Screenshot'}}])
                .slice(0, 6).map((e, i) => (
                <div key={i} className="jp-floatin" style={{ animationDelay: (i*0.05)+'s', flexShrink: 0 }}>
                  <EvidenceThumb label={e.src.label} w={76} h={96} hue={[JP.pink, JP.lavender, JP.peach][i%3]} />
                </div>
              ))}
            </div>
          </div>

          {/* dog jury */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionLabel icon="🐾" text="The Dog Jury" />
              <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 12.5,
                color: allIn ? JP.red : JP.inkSoft }}>
                {allIn ? `${guilty}/5 voted guilty` : 'deliberating…'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {JURORS.map((j, i) => {
                const shown = i < revealed;
                const vm = VOTE_META[j.vote];
                return (
                  <Glass key={i} soft style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                    <span style={{ fontSize: 26 }}>{j.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 14.5, color: JP.ink }}>{j.breed}</div>
                      <div style={{ fontFamily: 'Nunito', fontWeight: 600, fontSize: 11.5, color: JP.inkSoft }}>“{j.take}”</div>
                    </div>
                    <div className={shown ? 'jp-pop' : ''} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999,
                      background: shown ? vm.bg : 'rgba(255,255,255,0.5)',
                      border: `1.5px solid ${shown ? vm.color : 'rgba(196,168,188,0.4)'}`,
                      minWidth: 78, justifyContent: 'center',
                    }}>
                      {shown ? <>
                        <span style={{ fontSize: 14 }}>{vm.emoji}</span>
                        <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 13, color: vm.color }}>{vm.label}</span>
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
              {allIn ? 'Deliver the Verdict 🔨' : 'Jury is deliberating…'}
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

// ───────────────────── VERDICT ─────────────────────
function VerdictScreen({ go, state, chaos, off, mascot, drama }) {
  const c = state.caseData;
  const [stamp, setStamp] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setStamp(true), 400); return () => clearTimeout(t); }, []);
  const guilty = JURORS.filter(j => j.vote === 'guilty').length;
  return (
    <Backdrop tint="pink">
      <Particles kind="confetti" count={chaos ? 22 : 12} run={!off} />
      <div style={{ position: 'relative', zIndex: 3, height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: '58px 18px 120px' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18 }}>
            <Mascot size={66} float={false} badge="🔨" emoji={mascot} />
            <div>
              <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 22, color: JP.ink, lineHeight: 1.1 }}>The Verdict</div>
              <div style={{ fontFamily: 'Nunito', fontWeight: 700, fontSize: 12, color: JP.inkSoft, whiteSpace: 'nowrap' }}>Case 001 · Judge Paws</div>
            </div>
          </div>

          {/* HERO shareable card */}
          <Glass style={{ padding: '22px 20px', overflow: 'hidden',
            background: 'linear-gradient(165deg, rgba(255,255,255,0.85), rgba(255,236,246,0.8))' }}>
            {/* ruling */}
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 12, letterSpacing: 1.5, color: JP.inkSoft }}>
                {c.rulingOf.toUpperCase()} IS FOUND
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
                <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 13, color: JP.bubblegum, whiteSpace: 'nowrap' }}>Judge Paws’ ruling</span>
              </div>
              <p style={{ margin: 0, fontFamily: 'Nunito', fontWeight: 600, fontSize: 13.5, lineHeight: 1.5, color: JP.ink }}>{c.judgeNote}</p>
            </div>

            {/* drama meter */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <SectionLabel icon="📺" text="Drama Meter" />
              <DramaMeter value={drama != null ? drama : c.drama} />
            </div>

            {/* jury result */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 16px', borderRadius: 16, background: 'rgba(255,84,112,0.10)',
              border: '1.5px solid rgba(255,84,112,0.3)' }}>
              <span style={{ fontSize: 18 }}>🐕🐺🐶🦮</span>
              <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 14.5, color: '#C13A53' }}>
                Convicted by {guilty} of 5 dogs
              </span>
            </div>

            {/* watermark */}
            <div style={{ marginTop: 16, textAlign: 'center', fontFamily: 'Fredoka', fontWeight: 600,
              fontSize: 12, color: JP.inkFaint }}>🐾 judgepaws.app</div>
          </Glass>

          {/* scores */}
          <Glass style={{ marginTop: 14, padding: '18px 16px' }}>
            <SectionLabel icon="💳" text="Relationship Credit Score" />
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <ScoreRing value={c.plaintiff.score} label={c.plaintiff.name} emoji={c.plaintiff.emoji} color={JP.lavender} />
              <ScoreRing value={c.defendant.score} label={c.defendant.name} emoji={c.defendant.emoji} color={JP.bubblegum} />
            </div>
          </Glass>

          {/* who started it */}
          <Glass style={{ marginTop: 14, padding: '18px 16px' }}>
            <SectionLabel icon="🥧" text="Who Started It?" />
            <BlamePie a={c.blame} b={100 - c.blame} aLabel={c.defendant.name} bLabel={c.plaintiff.name} />
          </Glass>

          {/* flags */}
          <Glass style={{ marginTop: 14, padding: '18px 16px' }}>
            <SectionLabel icon="🚩" text="Red Flags" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {c.redFlags.map((f, i) => <FlagPill key={i} text={f} type="red" />)}
            </div>
            <div style={{ height: 14 }} />
            <SectionLabel icon="💚" text="Green Flags" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {c.greenFlags.map((f, i) => <FlagPill key={i} text={f} type="green" />)}
            </div>
          </Glass>

          {/* viral caption */}
          <Glass soft style={{ marginTop: 14, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 11, letterSpacing: 1, color: JP.inkSoft, marginBottom: 6 }}>
              READY-TO-POST CAPTION
            </div>
            <div style={{ fontFamily: 'Fredoka', fontWeight: 500, fontSize: 16, color: JP.ink, lineHeight: 1.35 }}>{c.caption}</div>
          </Glass>
        </div>
      </div>

      {/* sticky share footer */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5, padding: '14px 18px 30px',
        background: 'linear-gradient(180deg, rgba(255,241,248,0), rgba(255,241,248,0.95) 40%)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <PawButton full onClick={() => state.onShare && state.onShare()}>Share Verdict 🚀</PawButton>
          <PawButton secondary small onClick={() => go('home')} style={{ flexShrink: 0, paddingLeft: 18, paddingRight: 18 }}>New Trial</PawButton>
        </div>
      </div>
    </Backdrop>
  );
}

Object.assign(window, { BuildScreen, CourtScreen, VerdictScreen, buildCase, JURORS, COURT_QUIPS });
