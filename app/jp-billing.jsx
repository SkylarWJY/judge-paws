/* Judge Paws — billing: daily free limit, paywall, Stripe subscribe, share-to-unlock.
   Free metering is client-side (soft, low-friction). Premium MODES are enforced server-side
   (the server checks the subscriber email), so paid value can't be faked. */

(function () {
  const KEY = (k) => 'jpb_' + k;
  const today = () => new Date().toISOString().slice(0, 10);
  const get = (k, d) => { try { const v = localStorage.getItem(KEY(k)); return v == null ? d : JSON.parse(v); } catch (_) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (_) {} };
  const usage = () => { const u = get('usage', { date: '', used: 0, bonus: 0 }); return u.date === today() ? u : { date: today(), used: 0, bonus: 0 }; };

  const JPB = {
    DAILY_FREE: 1,
    subscribed() { return !!get('sub', false); },
    setSubscribed(v) { set('sub', !!v); },
    email() { return get('email', '') || ''; },
    setEmail(e) { set('email', e); },
    remaining() { if (this.subscribed()) return Infinity; const u = usage(); return (this.DAILY_FREE + u.bonus) - u.used; },
    canRun() { return this.subscribed() || this.remaining() > 0; },
    consume() { if (this.subscribed()) return; const u = usage(); u.used += 1; set('usage', u); },
    earnBonus() { if (this.subscribed()) return; const u = usage(); u.bonus += 1; set('usage', u); },
  };
  window.JPB = JPB;

  // Returning from Stripe checkout (?paid=1&email=...) — unlock optimistically.
  try {
    const p = new URLSearchParams(location.search);
    if (p.get('paid') === '1') {
      const em = p.get('email') || '';
      if (em) JPB.setEmail(em);
      JPB.setSubscribed(true);
      history.replaceState({}, '', location.pathname);
    }
  } catch (_) {}
})();

function Paywall({ reason, onClose, onUnlocked, mascot, chaos, off }) {
  const [email, setEmail] = React.useState((window.JPB && JPB.email()) || '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const subscribe = async () => {
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr('Enter a valid email.'); return; }
    JPB.setEmail(email);
    setBusy(true);
    try {
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, plan: 'monthly' }) });
      const d = await res.json();
      if (!res.ok || !d.url) throw new Error(d.error || 'Checkout unavailable.');
      window.location.href = d.url;
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const shareToUnlock = async () => {
    const text = 'I just got judged by Judge Paws ⚖️🐾 the AI relationship court. Get your verdict:';
    const url = location.origin;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text + ' ' + url);
    } catch (_) {}
    JPB.earnBonus();
    onUnlocked && onUnlocked();
  };

  const title = reason === 'savage' ? 'Savage Mode is Judge Paws+' : "Out of free verdicts today";
  const sub = reason === 'savage'
    ? 'Unlock the ruthless judge — plus unlimited verdicts.'
    : 'Come back tomorrow for a free one — or go unlimited now.';

  return (
    <Backdrop tint="pink">
      <Particles kind="confetti" count={chaos ? 14 : 8} run={!off} />
      <div style={{ position: 'relative', zIndex: 5, height: '100%', display: 'flex', flexDirection: 'column',
        padding: '60px 22px 28px', boxSizing: 'border-box' }}>
        <button onClick={onClose} className="jp-tap" style={{ position: 'absolute', top: 54, left: 20, width: 38, height: 38,
          borderRadius: 999, border: '1.5px solid rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(14px)', cursor: 'pointer', fontSize: 18, color: JP.ink }}>‹</button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Mascot size={104} emoji={mascot} badge="⭐" />
          <h2 style={{ margin: '6px 0 2px', fontFamily: 'Fredoka', fontWeight: 600, fontSize: 24, color: JP.ink, textAlign: 'center' }}>{title}</h2>
          <p style={{ margin: 0, fontFamily: 'Nunito', fontWeight: 700, fontSize: 14, color: JP.inkSoft, textAlign: 'center', maxWidth: 260 }}>{sub}</p>

          <Glass style={{ marginTop: 16, padding: 16, width: '100%' }}>
            <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 19, color: JP.ink, textAlign: 'center' }}>Judge Paws+</div>
            <div style={{ textAlign: 'center', fontFamily: 'Nunito', fontWeight: 800, fontSize: 12.5, color: JP.bubblegum, marginBottom: 12 }}>
              Unlimited verdicts · Savage mode · Appeals
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" inputMode="email"
              style={{ width: '100%', border: '1.5px solid #fbdcec', borderRadius: 12, padding: '12px 14px',
                font: 'inherit', fontSize: 15, marginBottom: 10, background: '#fffafd' }} />
            <PawButton full onClick={subscribe} style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
              {busy ? 'Opening checkout…' : 'Subscribe — $2.99/mo 🔨'}
            </PawButton>
            {err && <div style={{ color: JP.red, fontWeight: 700, fontSize: 12.5, textAlign: 'center', marginTop: 8 }}>{err}</div>}
          </Glass>

          <button onClick={shareToUnlock} className="jp-tap" style={{ marginTop: 14, background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'Fredoka', fontWeight: 600, fontSize: 14, color: JP.bubblegum }}>
            or share Judge Paws to earn a free verdict 🚀
          </button>
        </div>
      </div>
    </Backdrop>
  );
}
window.Paywall = Paywall;
