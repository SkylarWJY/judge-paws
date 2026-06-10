/* Judge Paws — "Tell Me What Happened" (the emotional heart of the product) */

// pick the most-recently-typed matching reaction
function detectReaction(text, tr) {
  const lower = (text || '').toLowerCase();
  let best = null, bestPos = -1;
  tr.tell.reactions.forEach(r => {
    r.keys.forEach(k => {
      const p = lower.lastIndexOf(k.toLowerCase());
      if (p > -1 && p >= bestPos) { bestPos = p; best = r; }
    });
  });
  if (best) return best;
  if ((text || '').trim().length > 0) return { emoji: '🐶', text: tr.tell.reactionTyping };
  return { emoji: '🐶', text: tr.tell.reactionIdle };
}

// drama from the venting: length + red-flag keyword hits
function computeDrama(text, tr) {
  const lower = (text || '').toLowerCase();
  let hits = 0;
  tr.tell.reactions.forEach(r => { if (r.keys.some(k => lower.indexOf(k.toLowerCase()) > -1)) hits++; });
  const len = (text || '').trim().length;
  return Math.max(0, Math.min(100, Math.round(len * 0.85 + hits * 16)));
}

// segmented live drama bar
function DramaBar({ value, tierLabels }) {
  const SEG = 10;
  const filled = Math.round((value / 100) * SEG);
  const idx = DRAMA_LABELS.findIndex(d => value <= d.max);
  const tIdx = idx === -1 ? 4 : idx;
  const color = DRAMA_LABELS[tIdx].color;
  const label = (tierLabels && tierLabels[tIdx]) || DRAMA_LABELS[tIdx].label;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 13, color: JP.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15 }}>📺</span>{label && value > 0 ? '' : ''}{/* label below */}
        </span>
        <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 13, color }}>{label}</span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: SEG }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 9, borderRadius: 999,
            background: i < filled ? color : 'rgba(255,255,255,0.7)',
            boxShadow: i < filled ? `0 2px 6px ${color}55` : 'none',
            transition: 'background 0.35s ease, box-shadow 0.35s ease',
          }} />
        ))}
      </div>
    </div>
  );
}

function TellScreen({ go, state, setState, lang, mascot, off, chaos }) {
  const tr = I18N[lang];
  const text = state.story || '';
  const setText = (v) => setState(s => ({ ...s, story: v }));
  const [recording, setRecording] = React.useState(false);
  const taRef = React.useRef(null);

  const reaction = detectReaction(text, tr);
  const drama = computeDrama(text, tr);

  // Real speech-to-text via the browser's Web Speech API (free, supports zh-CN/en-US).
  // Falls back to pasting the sample transcript where unsupported (e.g. Firefox).
  const recRef = React.useRef(null);
  const baseRef = React.useRef('');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const stopRec = () => {
    setRecording(false);
    if (recRef.current) { try { recRef.current.stop(); } catch (e) {} recRef.current = null; }
  };

  const toggleRecord = () => {
    if (recording) { stopRec(); return; }
    if (!SR) {
      setRecording(true);
      setTimeout(() => {
        setRecording(false);
        setText((text ? text + '\n' : '') + tr.tell.voiceSample);
        if (taRef.current) taRef.current.scrollTop = taRef.current.scrollHeight;
      }, 1600);
      return;
    }
    const rec = new SR();
    rec.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = state.story || '';
    rec.onresult = (ev) => {
      let finalTxt = '', interim = '';
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalTxt += r[0].transcript; else interim += r[0].transcript;
      }
      const joined = (baseRef.current ? baseRef.current + (lang === 'zh' ? '' : ' ') : '') + finalTxt + interim;
      setText(joined);
      if (taRef.current) taRef.current.scrollTop = taRef.current.scrollHeight;
    };
    rec.onerror = () => stopRec();
    rec.onend = () => setRecording(false);
    recRef.current = rec;
    try { rec.start(); setRecording(true); } catch (e) { stopRec(); }
  };

  React.useEffect(() => () => { if (recRef.current) { try { recRef.current.stop(); } catch (e) {} } }, []);

  const useExample = (ex) => {
    const clean = ex.replace(/[“”"]/g, '');
    setText((text ? text + ' ' : '') + clean);
    if (taRef.current) taRef.current.focus();
  };

  const EVI = [
    { id: 'screenshots', emoji: '📷' },
    { id: 'chat', emoji: '💬' },
  ];

  return (
    <Backdrop tint="court">
      <Particles kind="mix" count={chaos ? 10 : 5} run={!off} />
      <div style={{ position: 'relative', zIndex: 3, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ padding: '54px 18px 30px' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 96, marginBottom: 14 }}>
            <button onClick={() => go('type')} className="jp-tap" style={{ width: 34, height: 34, borderRadius: 999, cursor: 'pointer',
              border: '1.5px solid rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(14px)',
              fontSize: 16, color: JP.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
            <span style={{ fontSize: 18 }}>🐾</span>
            <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 16, color: JP.ink, whiteSpace: 'nowrap' }}>{tr.tell.judgeName}</span>
            <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 10.5, letterSpacing: 0.5, color: JP.inkSoft,
              background: 'rgba(255,255,255,0.55)', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap',
              border: '1px solid rgba(255,255,255,0.8)' }}>{tr.tell.caseNo}</span>
          </div>

          {/* hero: cloud bench + mascot */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 26, marginBottom: -6, position: 'relative', zIndex: 2 }} className="jp-bob">⚖️</div>
            <div style={{ position: 'relative' }}>
              <Mascot size={132} emoji={mascot} badge={null} />
              {/* cloud bench */}
              <div style={{ position: 'absolute', left: '50%', bottom: -6, transform: 'translateX(-50%)',
                width: 180, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.85)',
                filter: 'blur(6px)', zIndex: -1 }} />
            </div>
          </div>

          {/* title */}
          <div style={{ textAlign: 'center', margin: '6px 0 18px' }}>
            <h1 style={{ margin: 0, fontFamily: 'Fredoka', fontWeight: 600, fontSize: 28, lineHeight: 1.1, color: JP.ink, letterSpacing: -0.4 }}>
              {tr.tell.title}
            </h1>
            <p style={{ margin: '7px auto 0', maxWidth: 280, fontFamily: 'Nunito', fontWeight: 700, fontSize: 14.5, color: JP.inkSoft }}>
              {tr.tell.subtitle}
            </p>
          </div>

          {/* who's involved — solves "we don't know the names" */}
          <Glass soft style={{ padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 12.5, color: JP.inkSoft, marginBottom: 8 }}>{tr.tell.whoLabel}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input value={state.you || ''} onChange={(e) => setState(s => ({ ...s, you: e.target.value }))}
                placeholder={tr.tell.youPh} maxLength={14} style={{
                  flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 12, textAlign: 'center',
                  border: `1.5px solid ${JP.lavenderSoft}`, background: 'rgba(255,255,255,0.7)', outline: 'none',
                  fontFamily: 'Nunito', fontWeight: 700, fontSize: 14, color: JP.ink }} />
              <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 12, color: JP.bubblegum, flexShrink: 0 }}>VS</span>
              <input value={state.them || ''} onChange={(e) => setState(s => ({ ...s, them: e.target.value }))}
                placeholder={tr.tell.themPh} maxLength={14} style={{
                  flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 12, textAlign: 'center',
                  border: `1.5px solid ${JP.pinkSoft}`, background: 'rgba(255,255,255,0.7)', outline: 'none',
                  fontFamily: 'Nunito', fontWeight: 700, fontSize: 14, color: JP.ink }} />
            </div>
            <div style={{ fontFamily: 'Nunito', fontWeight: 600, fontSize: 11, color: JP.inkFaint, marginTop: 7, textAlign: 'center' }}>{tr.tell.whoHint}</div>
          </Glass>

          {/* examples */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 12.5, color: JP.inkSoft, marginBottom: 8, textAlign: 'center' }}>
              {tr.tell.examplesTitle}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {tr.tell.examples.map((ex, i) => (
                <button key={i} onClick={() => useExample(ex)} className="jp-tap" style={{
                  cursor: 'pointer', border: '1.5px solid rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.55)',
                  backdropFilter: 'blur(10px)', padding: '8px 13px', borderRadius: 999,
                  fontFamily: 'Nunito', fontWeight: 700, fontSize: 12.5, color: JP.ink,
                  boxShadow: '0 4px 12px rgba(214,98,168,0.08)' }}>{ex}</button>
              ))}
            </div>
          </div>

          {/* voice-first input — the big centered mic, below the examples */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, margin: '4px 0 18px' }}>
            <button onClick={toggleRecord} className="jp-tap" style={{
              position: 'relative', width: 92, height: 92, borderRadius: '50%', cursor: 'pointer', border: 'none',
              background: recording ? `linear-gradient(160deg, ${JP.red}, ${JP.bubblegum})` : `linear-gradient(160deg, ${JP.pink}, ${JP.bubblegum})`,
              color: '#fff', fontSize: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 14px 30px rgba(255,77,151,0.45), inset 0 2px 3px rgba(255,255,255,0.5)' }}>
              {recording ? '⏹' : '🎙️'}
              {recording && <span style={{ position: 'absolute', inset: -8, borderRadius: '50%',
                border: `3px solid ${JP.bubblegum}`, opacity: 0.6, animation: 'jp-ring 1.2s ease-out infinite' }} />}
            </button>
            {recording ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <WaveBars n={20} color={JP.bubblegum} />
                <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 14, color: JP.bubblegum }}>🐶 {tr.tell.listening}</span>
              </div>
            ) : (
              <span style={{ fontFamily: 'Fredoka', fontWeight: 500, fontSize: 14, color: JP.inkSoft }}>{tr.tell.recordHint}</span>
            )}
          </div>

          {/* live reaction bubble */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
              border: '2px solid #fff', boxShadow: '0 6px 14px rgba(214,98,168,0.25)',
              background: `linear-gradient(160deg,#fff,${JP.pinkSoft})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/[\/.]/.test(String(mascot))
                ? <img src={mascot} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 24 }}>{mascot}</span>}
            </div>
            <div key={reaction.text} className="jp-pop" style={{ position: 'relative', background: '#fff', borderRadius: '6px 18px 18px 18px',
              padding: '11px 15px', fontFamily: 'Fredoka', fontWeight: 500, fontSize: 14.5, color: JP.ink, lineHeight: 1.3,
              boxShadow: '0 10px 24px rgba(214,98,168,0.18)', border: '1.5px solid rgba(255,255,255,0.9)', maxWidth: 250 }}>
              <span style={{ fontSize: 16, marginRight: 5 }}>{reaction.emoji}</span>{reaction.text}
            </div>
          </div>

          {/* text area */}
          <Glass style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 15, color: JP.ink, marginBottom: 8 }}>{tr.tell.whatHappened}</div>
            <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={tr.tell.placeholder} rows={4} style={{
                width: '100%', boxSizing: 'border-box', resize: 'none', border: 'none', outline: 'none',
                background: 'transparent', fontFamily: 'Nunito', fontWeight: 600, fontSize: 15, lineHeight: 1.5,
                color: JP.ink, minHeight: 92 }} />
          </Glass>

          {/* drama meter */}
          <Glass soft style={{ padding: '14px 16px', marginBottom: 14 }}>
            <DramaBar value={drama} tierLabels={tr.dramaTiers} />
          </Glass>

          {/* quick upload */}
          <Glass soft style={{ padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 13.5, color: JP.ink, marginBottom: 10 }}>{tr.tell.addEvidence}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {EVI.map(e => (
                <button key={e.id} onClick={() => go('upload')} className="jp-tap" style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left',
                  padding: '11px 13px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.9)',
                  background: 'rgba(255,255,255,0.6)', fontFamily: 'Fredoka', fontWeight: 500, fontSize: 13.5, color: JP.ink,
                  boxShadow: '0 4px 12px rgba(214,98,168,0.08)' }}>
                  <span style={{ fontSize: 18 }}>{e.emoji}</span>{tr.tell.evidenceBtns[e.id]}
                </button>
              ))}
            </div>
          </Glass>

          {/* CTA */}
          <PawButton full onClick={() => go('upload')} style={{ fontSize: 19, padding: '17px 28px' }}>
            ⚖️ {tr.tell.openCase}
          </PawButton>
        </div>
      </div>
    </Backdrop>
  );
}

Object.assign(window, { TellScreen, detectReaction, computeDrama, DramaBar });
