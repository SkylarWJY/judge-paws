/* Judge Paws — "Viral Cases" gallery: pre-built showcase dramas → instant verdict */

function ViralScreen({ go, state, setState, lang, chaos, off }) {
  const tr = I18N[lang];
  const v = tr.viral;
  const cases = tr.viralCases || [];

  const openCase = (c) => {
    const cd = {
      ...c.case,
      plaintiff: { ...c.case.plaintiff, color: JP.lavender },
      defendant: { ...c.case.defendant, color: JP.bubblegum },
    };
    setState(s => ({ ...s, caseData: cd, you: c.case.plaintiff.name, them: c.case.defendant.name }));
    go('verdict');
  };

  return (
    <Backdrop tint="lavender">
      <Particles kind="paws" count={chaos ? 8 : 4} run={!off} />
      <div style={{ position: 'relative', zIndex: 3, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ padding: '56px 18px 28px' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <button onClick={() => go('home')} className="jp-tap" style={{ width: 38, height: 38, borderRadius: 999, cursor: 'pointer',
              border: '1.5px solid rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(14px)',
              fontSize: 18, color: JP.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
            <h2 style={{ margin: 0, fontFamily: 'Fredoka', fontWeight: 600, fontSize: 24, color: JP.ink }}>🔥 {v.title}</h2>
          </div>
          <p style={{ margin: '4px 0 18px 48px', fontFamily: 'Nunito', fontWeight: 700, fontSize: 13.5, color: JP.inkSoft }}>{v.sub}</p>

          {/* case cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {cases.map((c, i) => (
              <div key={c.id} onClick={() => openCase(c)} className="jp-tap jp-floatin"
                style={{ animationDelay: (i * 0.06) + 's', cursor: 'pointer' }}>
                <Glass style={{ padding: '15px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                    <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 11.5, color: '#C13A53',
                      background: 'rgba(255,77,151,0.12)', padding: '4px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>{c.tag}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span className="jp-pulse" style={{ width: 7, height: 7, borderRadius: 999, background: JP.red, display: 'inline-block' }} />
                      <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 10.5, color: JP.inkSoft, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{v.live} · ❤️ {c.likes}</span>
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 16.5, color: JP.ink, lineHeight: 1.28 }}>{c.headline}</div>
                  <div style={{ fontFamily: 'Nunito', fontWeight: 600, fontSize: 12.5, color: JP.inkSoft, marginTop: 6, lineHeight: 1.4 }}>{c.blurb}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 22 }}>{c.case.plaintiff.emoji}</span>
                      <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 12, color: JP.bubblegum }}>VS</span>
                      <span style={{ fontSize: 22 }}>{c.case.defendant.emoji}</span>
                    </div>
                    <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 13.5, color: JP.bubblegum }}>{v.readVerdict}</span>
                  </div>
                </Glass>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <PawButton full onClick={() => go('type')}>{v.tryYours}</PawButton>
          </div>
        </div>
      </div>
    </Backdrop>
  );
}

Object.assign(window, { ViralScreen });
