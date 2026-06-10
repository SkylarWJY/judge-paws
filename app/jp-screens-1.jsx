/* Judge Paws — screens part 1: Home, Relationship Picker, Evidence Upload */

function useRotating(list, ms = 2600) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => { setI(0); }, [list]);
  React.useEffect(() => {
    const t = setInterval(() => setI(v => (v + 1) % list.length), ms);
    return () => clearInterval(t);
  }, [list, ms]);
  return list[i % list.length];
}

// striped placeholder for evidence imagery
function EvidenceThumb({ label, w = 88, h = 110, hue = JP.pink }) {
  const id = 'st' + String(label).replace(/\W/g, '');
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

// little fake voice waveform
function WaveBars({ n = 26, color = JP.bubblegum }) {
  const bars = React.useMemo(() => Array.from({ length: n }, (_, i) => 4 + Math.abs(Math.sin(i * 1.7) + Math.cos(i * 0.6)) * 11), [n]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24, flex: 1, overflow: 'hidden' }}>
      {bars.map((h, i) => (
        <div key={i} style={{ width: 2.5, height: h, borderRadius: 2, background: color, opacity: 0.3 + (h / 22) * 0.7, flexShrink: 0 }} />
      ))}
    </div>
  );
}

// type-aware evidence card (chat snippet / voice note / photo / real upload)
function EvidenceCard({ srcId, emoji, idx, lang, onRemove, img }) {
  const tr = I18N[lang];
  const type = srcId === 'voice' ? 'voice' : srcId === 'photo' ? 'photo' : 'chat';
  const appName = tr.sources[srcId];
  const eu = tr.evidenceUI;
  let body = null;

  if (img) {
    // a real uploaded screenshot — show the actual image
    body = (
      <img src={img} alt={appName} style={{ display: 'block', width: '100%', maxHeight: 160,
        objectFit: 'cover', borderRadius: 12, border: '1px solid rgba(214,98,168,0.18)' }} />
    );
  } else if (type === 'chat') {
    const s = tr.evidenceSamples.chat[idx % tr.evidenceSamples.chat.length];
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ alignSelf: 'flex-start', maxWidth: '84%', background: '#F1ECF4', color: JP.ink,
          padding: '7px 11px', borderRadius: '14px 14px 14px 4px', fontFamily: 'Nunito', fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{s.them}</div>
        <div style={{ alignSelf: 'flex-end', maxWidth: '84%', background: `linear-gradient(180deg, ${JP.pink}, ${JP.bubblegum})`, color: '#fff',
          padding: '7px 11px', borderRadius: '14px 14px 4px 14px', fontFamily: 'Nunito', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{s.me}</div>
      </div>
    );
  } else if (type === 'voice') {
    const s = tr.evidenceSamples.voice[idx % tr.evidenceSamples.voice.length];
    body = (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0,
            background: `linear-gradient(160deg, ${JP.pink}, ${JP.bubblegum})`, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
            boxShadow: '0 4px 10px rgba(255,77,151,0.4)' }}>▶</div>
          <WaveBars />
        </div>
        <div style={{ marginTop: 9, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <span style={{ flexShrink: 0, fontFamily: 'Fredoka', fontWeight: 600, fontSize: 10, color: JP.bubblegum,
            background: 'rgba(255,77,151,0.1)', padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{eu.transcript}</span>
          <span style={{ fontFamily: 'Nunito', fontWeight: 600, fontSize: 12.5, color: JP.inkSoft, lineHeight: 1.4 }}>{s.text}</span>
        </div>
      </div>
    );
  } else {
    const s = tr.evidenceSamples.photo[idx % tr.evidenceSamples.photo.length];
    body = (
      <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
        <EvidenceThumb label="IMG" w={52} h={64} hue={JP.peach} />
        <span style={{ flex: 1, fontFamily: 'Nunito', fontWeight: 700, fontSize: 13, color: JP.ink, lineHeight: 1.4 }}>{s.cap}</span>
      </div>
    );
  }

  return (
    <div className="jp-floatin" style={{ position: 'relative' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '11px 13px',
        border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 6px 16px rgba(214,98,168,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <span style={{ fontSize: 15 }}>{emoji}</span>
          <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 12.5, color: JP.ink }}>{appName}</span>
          {type === 'voice' && <span style={{ marginLeft: 'auto', fontFamily: 'Fredoka', fontWeight: 600, fontSize: 11.5, color: JP.inkSoft }}>{tr.evidenceSamples.voice[idx % tr.evidenceSamples.voice.length].dur}</span>}
        </div>
        {body}
      </div>
      <button onClick={onRemove} style={{ position: 'absolute', top: -7, right: -7,
        width: 22, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: JP.red, color: '#fff', fontSize: 12, lineHeight: 1,
        boxShadow: '0 3px 8px rgba(255,84,112,0.5)' }}>✕</button>
    </div>
  );
}

// ───────────────────────── HOME ─────────────────────────
function HomeScreen({ go, chaos, off, mascot, lang, petPhoto, onPetPhoto }) {
  const tr = I18N[lang];
  const quip = useRotating(tr.quips);
  const onPickPet = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => onPetPhoto && onPetPhoto(ev.target.result);
    reader.readAsDataURL(f);
    e.target.value = '';
  };
  return (
    <Backdrop tint="pink">
      <Particles kind="mix" count={chaos ? 16 : 8} run={!off} />
      <div style={{ position: 'relative', zIndex: 3, height: '100%', display: 'flex', flexDirection: 'column',
        padding: '64px 24px 30px', boxSizing: 'border-box' }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 22 }}>🐾</span>
            <span style={{ fontFamily: 'Fredoka, sans-serif', fontWeight: 600, fontSize: 19, color: JP.ink, whiteSpace: 'nowrap' }}>{tr.appName}</span>
          </div>
        </div>

        {/* mascot + bubble */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <ReactionBubble text={quip} style={{ marginBottom: 14, minHeight: 20 }} />
          <label className="jp-tap" title={tr.home.petCta} style={{ position: 'relative', cursor: 'pointer', display: 'block' }}>
            <Mascot size={168} emoji={mascot} />
            <input type="file" accept="image/*" onChange={onPickPet} style={{ display: 'none' }} />
          </label>
          {petPhoto ? (
            <button onClick={() => onPetPhoto && onPetPhoto('')} className="jp-tap" style={{
              marginTop: 14, cursor: 'pointer', border: '1.5px solid rgba(255,255,255,0.9)',
              background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '7px 14px', borderRadius: 999,
              fontFamily: 'Fredoka', fontWeight: 500, fontSize: 13, color: JP.ink }}>↺ {tr.home.useJudge}</button>
          ) : (
            <label className="jp-tap" style={{
              marginTop: 14, cursor: 'pointer', border: '1.5px solid rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(10px)', padding: '7px 14px', borderRadius: 999,
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Nunito', fontWeight: 700, fontSize: 12, color: JP.inkSoft }}>
              📷 {tr.home.petCta}
              <input type="file" accept="image/*" onChange={onPickPet} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {/* headline */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontFamily: 'Fredoka, sans-serif', fontWeight: 600, fontSize: 32,
            lineHeight: 1.06, color: JP.ink, letterSpacing: -0.5 }}>
            {tr.home.lines[0]}<br />{tr.home.lines[1]}
          </h1>
          <p style={{ margin: '12px auto 0', maxWidth: 300, fontFamily: 'Nunito, sans-serif', fontWeight: 600,
            fontSize: 15.5, lineHeight: 1.5, color: JP.inkSoft }}>
            {(tr.home.subLines || [tr.home.sub]).map((l, i) => <React.Fragment key={i}>{l}{i === 0 ? <br /> : null}</React.Fragment>)}
          </p>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <PawButton full onClick={() => go('type')}>{tr.home.start}</PawButton>
          <PawButton full secondary small onClick={() => go('type')}>{tr.home.watch}</PawButton>
        </div>
      </div>
    </Backdrop>
  );
}

// ─────────────────── RELATIONSHIP PICKER ───────────────────
const REL_BASE = [
  { id: 'couple', emoji: '💑' },
  { id: 'situationship', emoji: '😶‍🌫️' },
  { id: 'ex', emoji: '💔' },
  { id: 'roommate', emoji: '🛋️' },
  { id: 'bff', emoji: '👯' },
  { id: 'family', emoji: '🏠' },
];

function TypeScreen({ go, state, setState, chaos, off, lang }) {
  const tr = I18N[lang];
  const sel = state.relType;
  return (
    <Backdrop tint="lavender">
      <Particles kind="paws" count={chaos ? 10 : 5} run={!off} />
      <FlowHeader title={tr.type.title} sub={tr.type.sub} step={0} onBack={() => go('home')} />
      <div style={{ position: 'relative', zIndex: 3, padding: '6px 20px 20px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {REL_BASE.map(t => {
          const active = sel === t.id;
          const txt = tr.relTypes[t.id];
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
              <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 17, color: JP.ink }}>{txt.label}</div>
              <div style={{ fontFamily: 'Nunito', fontWeight: 600, fontSize: 11.5, color: JP.inkSoft, marginTop: 2 }}>{txt.sub}</div>
              {active && <div style={{ position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 999,
                background: JP.bubblegum, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, boxShadow: '0 4px 10px rgba(255,77,151,0.5)' }}>✓</div>}
            </Glass>
          );
        })}
      </div>
      <FlowFooter disabled={!sel} onNext={() => go('tell')} label={tr.type.next} />
    </Backdrop>
  );
}

// ───────────────────── EVIDENCE UPLOAD ─────────────────────
const SOURCE_BASE = [
  { id: 'imessage', emoji: '💬' },
  { id: 'whatsapp', emoji: '🟢' },
  { id: 'instagram', emoji: '📸' },
  { id: 'wechat', emoji: '💚' },
  { id: 'moments', emoji: '👥' },
  { id: 'photo', emoji: '🖼️' },
];

// downscale a chosen image to a compressed JPEG data URL (keeps payloads small)
function fileToCompressedDataUrl(file, maxW = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function UploadScreen({ go, state, setState, chaos, off, lang }) {
  const tr = I18N[lang];
  const ev = state.evidence;
  const fileRef = React.useRef(null);
  const pendingSrc = React.useRef(null);
  // tapping a source opens the picker → attach a REAL screenshot
  const add = (src) => { pendingSrc.current = src; if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } };
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    const src = pendingSrc.current;
    if (!src) return;
    if (!f) { // user cancelled the picker → keep the pretty sample card so the flow still works
      setState(s => {
        const idx = s.evidence.filter(x => x.src.id === src.id).length;
        return { ...s, evidence: [...s.evidence, { id: Date.now() + Math.random(), src, idx }] };
      });
      return;
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(f);
      setState(s => {
        const idx = s.evidence.filter(x => x.src.id === src.id).length;
        return { ...s, evidence: [...s.evidence, { id: Date.now() + Math.random(), src, idx, dataUrl, mediaType: 'image/jpeg' }] };
      });
    } catch (err) {}
  };
  const remove = (id) => setState(s => ({ ...s, evidence: s.evidence.filter(e => e.id !== id) }));
  return (
    <Backdrop tint="peach">
      <Particles kind="paws" count={chaos ? 8 : 4} run={!off} />
      <FlowHeader title={tr.upload.title} sub={tr.upload.sub} step={1} onBack={() => go('tell')} />
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />

      {/* source chips */}
      <div style={{ position: 'relative', zIndex: 3, padding: '4px 18px 0', flexShrink: 0,
        display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        {SOURCE_BASE.map(s => (
          <button key={s.id} onClick={() => add(s)} className="jp-tap" style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap',
            padding: '9px 14px', borderRadius: 999, border: '1.5px solid rgba(255,255,255,0.9)',
            background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(14px)',
            fontFamily: 'Fredoka', fontWeight: 500, fontSize: 14, color: JP.ink,
            boxShadow: '0 5px 14px rgba(214,98,168,0.10)',
          }}>
            <span style={{ fontSize: 16 }}>{s.emoji}</span>{tr.sources[s.id]} <span style={{ color: JP.bubblegum, fontWeight: 600 }}>+</span>
          </button>
        ))}
      </div>

      {/* dropzone / evidence cards */}
      <div style={{ position: 'relative', zIndex: 3, margin: '14px 18px 0', flex: '1 1 auto', minHeight: 0,
        display: 'flex', flexDirection: 'column' }}>
        <Glass soft style={{ padding: 12, flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {ev.length === 0 ? (
            <div style={{ flex: 1, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 40 }} className="jp-bob">🐾</div>
              <div style={{ fontFamily: 'Fredoka', fontWeight: 500, fontSize: 15, color: JP.inkSoft, maxWidth: 220 }}>
                {tr.upload.empty}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingRight: 4, paddingTop: 4 }}>
              {ev.map((e) => (
                <EvidenceCard key={e.id} srcId={e.src.id} emoji={e.src.emoji} idx={e.idx || 0}
                  lang={lang} img={e.dataUrl} onRemove={() => remove(e.id)} />
              ))}
            </div>
          )}
        </Glass>
        {ev.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 10, fontFamily: 'Fredoka', fontWeight: 500,
            fontSize: 14, color: JP.bubblegum, flexShrink: 0 }}>
            {tr.upload.submitted(ev.length)}
          </div>
        )}
      </div>

      <FlowFooter disabled={false} onNext={() => go('build')} label={tr.upload.next} />
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

Object.assign(window, { HomeScreen, TypeScreen, UploadScreen, FlowHeader, FlowFooter, EvidenceThumb, EvidenceCard, WaveBars, REL_BASE, SOURCE_BASE, useRotating });
