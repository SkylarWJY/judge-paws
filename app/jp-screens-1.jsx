/* Judge Paws — screens part 1: Home, Relationship Picker, Evidence Upload */

// rotating quips for the mascot
const QUIPS = [
  "OBJECTION! That text is suspicious.",
  "Respectfully, you both need therapy.",
  "Sending 'k' was a criminal offense.",
  "Bestie… that was not a smart reply.",
  "Your honor has seen enough. 🐾",
  "Paw-sitively guilty.",
];

function useRotating(list, ms = 2600) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setI(v => (v + 1) % list.length), ms);
    return () => clearInterval(t);
  }, [list, ms]);
  return list[i];
}

// striped placeholder for evidence imagery
function EvidenceThumb({ label, w = 88, h = 110, hue = JP.pink }) {
  const id = 'st' + label.replace(/\W/g, '');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ borderRadius: 14, display: 'block' }}>
      <defs>
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill="#fff" />
          <rect width="5" height="10" fill={hue} opacity="0.18" />
        </pattern>
      </defs>
      <rect width={w} height={h} rx="14" fill={`url(#${id})`} stroke="rgba(255,255,255,0.9)" strokeWidth="2" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        fontFamily="ui-monospace, monospace" fontSize="9" fill={JP.inkSoft}>{label}</text>
    </svg>
  );
}

// ───────────────────────── HOME ─────────────────────────
function HomeScreen({ go, chaos, off, mascot }) {
  const quip = useRotating(QUIPS);
  return (
    <Backdrop tint="pink">
      <Particles kind="mix" count={chaos ? 16 : 8} run={!off} />
      <div style={{ position: 'relative', zIndex: 3, height: '100%', display: 'flex', flexDirection: 'column',
        padding: '64px 24px 30px', boxSizing: 'border-box' }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 22 }}>🐾</span>
            <span style={{ fontFamily: 'Fredoka, sans-serif', fontWeight: 600, fontSize: 19, color: JP.ink }}>Judge Paws</span>
          </div>
          <Glass style={{ borderRadius: 999, padding: '7px 13px', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 14 }}>🔥</span>
            <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 14, color: JP.ink }}>5</span>
          </Glass>
        </div>

        {/* mascot + bubble */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <ReactionBubble text={quip} style={{ marginBottom: 14, minHeight: 20 }} />
          <Mascot size={168} emoji={mascot} />
        </div>

        {/* headline */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontFamily: 'Fredoka, sans-serif', fontWeight: 600, fontSize: 38,
            lineHeight: 1.02, color: JP.ink, letterSpacing: -0.5 }}>
            Justice Has<br />Four&nbsp;Paws.
          </h1>
          <p style={{ margin: '12px auto 0', maxWidth: 280, fontFamily: 'Nunito, sans-serif', fontWeight: 600,
            fontSize: 15.5, lineHeight: 1.45, color: JP.inkSoft }}>
            Upload the evidence. Tell your side. Let the dog decide.
          </p>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <PawButton full onClick={() => go('type')}>Start a Trial 🐾</PawButton>
          <PawButton full secondary small onClick={() => go('type')}>Watch Viral Cases ▶</PawButton>
        </div>
      </div>
    </Backdrop>
  );
}

// ─────────────────── RELATIONSHIP PICKER ───────────────────
const REL_TYPES = [
  { id: 'couple', label: 'Couple', emoji: '💑', sub: 'It’s complicated, romantically' },
  { id: 'situationship', label: 'Situationship', emoji: '😶‍🌫️', sub: 'Undefined & dangerous' },
  { id: 'ex', label: 'Ex', emoji: '💔', sub: 'Reopening old cases' },
  { id: 'roommate', label: 'Roommate', emoji: '🛋️', sub: 'Dishes are evidence' },
  { id: 'bff', label: 'Best Friend', emoji: '👯', sub: 'Ride or die… allegedly' },
  { id: 'family', label: 'Family', emoji: '🏠', sub: 'Group chat warfare' },
];

function TypeScreen({ go, state, setState, chaos, off }) {
  const sel = state.relType;
  return (
    <Backdrop tint="lavender">
      <Particles kind="paws" count={chaos ? 10 : 5} run={!off} />
      <FlowHeader title="Who’s on trial?" sub="Pick the relationship to open a case file." step={0} onBack={() => go('home')} />
      <div style={{ position: 'relative', zIndex: 3, padding: '6px 20px 20px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {REL_TYPES.map(t => {
          const active = sel === t.id;
          return (
            <Glass key={t.id} onClick={() => setState(s => ({ ...s, relType: t.id }))}
              className="jp-tap" style={{
                padding: '18px 14px', cursor: 'pointer', textAlign: 'left',
                border: active ? `2px solid ${JP.bubblegum}` : '1px solid rgba(255,255,255,0.85)',
                background: active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.55)',
                boxShadow: active ? '0 14px 30px rgba(255,77,151,0.28)' : '0 8px 22px rgba(214,98,168,0.12)',
                transform: active ? 'translateY(-3px)' : 'none',
                transition: 'all 0.22s cubic-bezier(.34,1.56,.64,1)',
              }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>{t.emoji}</div>
              <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 17, color: JP.ink }}>{t.label}</div>
              <div style={{ fontFamily: 'Nunito', fontWeight: 600, fontSize: 11.5, color: JP.inkSoft, marginTop: 2 }}>{t.sub}</div>
              {active && <div style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 999,
                background: JP.bubblegum, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, boxShadow: '0 4px 10px rgba(255,77,151,0.5)' }}>✓</div>}
            </Glass>
          );
        })}
      </div>
      <FlowFooter disabled={!sel} onNext={() => go('upload')} label="Open the Case" />
    </Backdrop>
  );
}

// ───────────────────── EVIDENCE UPLOAD ─────────────────────
const SOURCES = [
  { id: 'imessage', label: 'iMessage', emoji: '💬' },
  { id: 'whatsapp', label: 'WhatsApp', emoji: '🟢' },
  { id: 'discord', label: 'Discord', emoji: '🎮' },
  { id: 'wechat', label: 'WeChat', emoji: '💚' },
  { id: 'voice', label: 'Voice Note', emoji: '🎙️' },
  { id: 'photo', label: 'Photo', emoji: '📸' },
];

function UploadScreen({ go, state, setState, chaos, off }) {
  const ev = state.evidence;
  const add = (src) => setState(s => ({
    ...s, evidence: [...s.evidence, { id: Date.now() + Math.random(), src }],
  }));
  const remove = (id) => setState(s => ({ ...s, evidence: s.evidence.filter(e => e.id !== id) }));
  return (
    <Backdrop tint="peach">
      <Particles kind="paws" count={chaos ? 8 : 4} run={!off} />
      <FlowHeader title="Submit the evidence" sub="Drop the receipts. Judge Paws sniffs everything." step={1} onBack={() => go('type')} />

      {/* source chips */}
      <div style={{ position: 'relative', zIndex: 3, padding: '4px 18px 0', flexShrink: 0,
        display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        {SOURCES.map(s => (
          <button key={s.id} onClick={() => add(s)} className="jp-tap" style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap',
            padding: '9px 14px', borderRadius: 999, border: '1.5px solid rgba(255,255,255,0.9)',
            background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(14px)',
            fontFamily: 'Fredoka', fontWeight: 500, fontSize: 14, color: JP.ink,
            boxShadow: '0 5px 14px rgba(214,98,168,0.10)',
          }}>
            <span style={{ fontSize: 16 }}>{s.emoji}</span>{s.label} <span style={{ color: JP.bubblegum, fontWeight: 600 }}>+</span>
          </button>
        ))}
      </div>

      {/* dropzone / floated cards */}
      <div style={{ position: 'relative', zIndex: 3, margin: '16px 18px 0', flex: '1 1 auto', minHeight: 0 }}>
        <Glass soft style={{ padding: 16, minHeight: 230 }}>
          {ev.length === 0 ? (
            <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 40 }} className="jp-bob">🐾</div>
              <div style={{ fontFamily: 'Fredoka', fontWeight: 500, fontSize: 15, color: JP.inkSoft, maxWidth: 200 }}>
                Tap a source above to float evidence into the courtroom.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-start' }}>
              {ev.map((e, i) => (
                <div key={e.id} className="jp-floatin" style={{ position: 'relative', animationDelay: (i * 0.04) + 's' }}>
                  <EvidenceThumb label={e.src.label} hue={[JP.pink, JP.lavender, JP.peach][i % 3]} />
                  <div style={{ position: 'absolute', top: -6, left: -6, fontSize: 16,
                    background: '#fff', borderRadius: 999, width: 24, height: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.12)' }}>{e.src.emoji}</div>
                  <button onClick={() => remove(e.id)} style={{ position: 'absolute', top: -7, right: -7,
                    width: 22, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: JP.red, color: '#fff', fontSize: 12, lineHeight: 1,
                    boxShadow: '0 3px 8px rgba(255,84,112,0.5)' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </Glass>
        {ev.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 12, fontFamily: 'Fredoka', fontWeight: 500,
            fontSize: 14, color: JP.bubblegum }}>
            {ev.length} piece{ev.length > 1 ? 's' : ''} of evidence submitted 🐾
          </div>
        )}
      </div>

      <FlowFooter disabled={ev.length === 0} onNext={() => go('build')} label="Build the Case" />
    </Backdrop>
  );
}

// ───────────── shared flow header / footer ─────────────
function FlowHeader({ title, sub, step, onBack }) {
  return (
    <div style={{ position: 'relative', zIndex: 4, padding: '60px 20px 14px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={onBack} className="jp-tap" style={{ width: 40, height: 40, borderRadius: 999, cursor: 'pointer',
          border: '1.5px solid rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(14px)', fontSize: 18, color: JP.ink, display: 'flex',
          alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <StepDots total={4} current={step} />
        <div style={{ width: 40 }} />
      </div>
      <h2 style={{ margin: 0, fontFamily: 'Fredoka', fontWeight: 600, fontSize: 27, color: JP.ink, letterSpacing: -0.3 }}>{title}</h2>
      {sub && <p style={{ margin: '5px 0 0', fontFamily: 'Nunito', fontWeight: 600, fontSize: 14, color: JP.inkSoft }}>{sub}</p>}
    </div>
  );
}

function FlowFooter({ onNext, disabled, label }) {
  return (
    <div style={{ position: 'relative', zIndex: 4, padding: '12px 20px 28px', marginTop: 'auto', flexShrink: 0 }}>
      <PawButton full onClick={disabled ? undefined : onNext} style={{
        opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? 'none' : 'auto',
      }}>{label} →</PawButton>
    </div>
  );
}

Object.assign(window, { HomeScreen, TypeScreen, UploadScreen, FlowHeader, FlowFooter, EvidenceThumb, REL_TYPES, useRotating });
