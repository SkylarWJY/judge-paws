/* Judge Paws — billing: daily free limit, paywall (EN/中文), Stripe subscribe, share-to-unlock.
   Free metering is client-side (soft). Premium MODES are enforced server-side. */

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

const PAYWALL_COPY = {
  en: {
    limitTitle: 'Out of free verdicts today',
    limitSub: 'Come back tomorrow for a free one — or go unlimited now.',
    savageTitle: 'Savage Mode is Judge Paws+',
    savageSub: 'Unlock the ruthless judge — plus unlimited verdicts.',
    plus: 'Judge Paws+',
    perks: 'Unlimited verdicts · Savage mode · Appeals',
    emailPh: 'you@email.com',
    cta: 'Subscribe — $2.99/mo 🔨',
    opening: 'Opening checkout…',
    badEmail: 'Enter a valid email.',
    share: 'or share Judge Paws to earn a free verdict 🚀',
    shareText: 'I just got judged by Judge Paws ⚖️🐾 the AI relationship court. Get your verdict:',
  },
  zh: {
    limitTitle: '今天的免费判决用完啦',
    limitSub: '明天再来有免费的——或者现在解锁无限次。',
    savageTitle: '毒舌模式是 Judge Paws+ 专属',
    savageSub: '解锁嘴下不留情的法官——外加无限次判决。',
    plus: 'Judge Paws+',
    perks: '无限判决 · 毒舌模式 · 上诉重审',
    emailPh: 'you@email.com',
    cta: '订阅 — $2.99/月 🔨',
    opening: '正在打开收银台…',
    badEmail: '请输入有效邮箱。',
    share: '或者分享 Judge Paws,赚一次免费判决 🚀',
    shareText: '我刚被 AI 恋爱法庭 Judge Paws ⚖️🐾 审判了。你也来领一份判决:',
  },
};

function Paywall({ reason, lang, onClose, onUnlocked, mascot, chaos, off }) {
  const t = PAYWALL_COPY[lang === 'zh' ? 'zh' : 'en'];
  const [email, setEmail] = React.useState((window.JPB && JPB.email()) || '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const subscribe = async () => {
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr(t.badEmail); return; }
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
    const url = location.origin;
    try {
      if (navigator.share) await navigator.share({ text: t.shareText, url });
      else if (navigator.clipboard) await navigator.clipboard.writeText(t.shareText + ' ' + url);
    } catch (_) {}
    JPB.earnBonus();
    onUnlocked && onUnlocked();
  };

  const title = reason === 'savage' ? t.savageTitle : t.limitTitle;
  const sub = reason === 'savage' ? t.savageSub : t.limitSub;

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
            <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 19, color: JP.ink, textAlign: 'center' }}>{t.plus}</div>
            <div style={{ textAlign: 'center', fontFamily: 'Nunito', fontWeight: 800, fontSize: 12.5, color: JP.bubblegum, marginBottom: 12 }}>
              {t.perks}
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPh} inputMode="email"
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #fbdcec', borderRadius: 12, padding: '12px 14px',
                font: 'inherit', fontSize: 15, marginBottom: 10, background: '#fffafd' }} />
            <PawButton full onClick={subscribe} style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
              {busy ? t.opening : t.cta}
            </PawButton>
            {err && <div style={{ color: JP.red, fontWeight: 700, fontSize: 12.5, textAlign: 'center', marginTop: 8 }}>{err}</div>}
          </Glass>

          <button onClick={shareToUnlock} className="jp-tap" style={{ marginTop: 14, background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'Fredoka', fontWeight: 600, fontSize: 14, color: JP.bubblegum }}>
            {t.share}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}
window.Paywall = Paywall;
