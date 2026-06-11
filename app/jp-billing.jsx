/* Judge Paws — billing: daily free limit, paywall (EN/中文), Stripe subscribe, share-to-unlock.
   Free metering is client-side (soft). Premium MODES are enforced server-side. */

(function () {
  const KEY = (k) => 'jpb_' + k;
  const today = () => new Date().toISOString().slice(0, 10);
  const get = (k, d) => { try { const v = localStorage.getItem(KEY(k)); return v == null ? d : JSON.parse(v); } catch (_) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (_) {} };
  const usage = () => { const u = get('usage', { date: '', used: 0, bonus: 0 }); return u.date === today() ? u : { date: today(), used: 0, bonus: 0 }; };

  const JPB = {
    // Growth model: FREE_QUOTA free verdicts/day, then a soft "share or follow"
    // unlock. Sharing ANY verdict (or sharing/following at the gate) sets a
    // permanent unlock → unlimited forever. So users who spread it never hit a
    // wall; only non-sharers see the gate after their free quota. No money.
    FREE_QUOTA: 2,
    subscribed() { return !!get('sub', false); },
    setSubscribed(v) { set('sub', !!v); },
    unlocked() { return !!get('unlocked', false); },
    setUnlocked() { set('unlocked', true); },
    softSeen() { return !!get('softseen', false); },   // the one-time gentle nudge
    setSoftSeen() { set('softseen', true); },
    email() { return get('email', '') || ''; },
    setEmail(e) { set('email', e); },
    remaining() { if (this.unlocked() || this.subscribed()) return Infinity; const u = usage(); return this.FREE_QUOTA - u.used; },
    canRun() { return this.unlocked() || this.subscribed() || this.remaining() > 0; },
    consume() { if (this.unlocked() || this.subscribed()) return; const u = usage(); u.used += 1; set('usage', u); },
    // sharing a verdict unlocks unlimited — rewards the organic viral loop
    earnBonus() { this.setUnlocked(); },
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

// Skylar's socials — used by the unlock gate (and reusable elsewhere via window.JP_SOCIAL)
const JP_SOCIAL = {
  ig: 'https://www.instagram.com/skylarwjy/',
  igHandle: '@skylarwjy',
  xhs: 'https://xhslink.com/m/AXPGBI3TmTh',
  xhsHandle: '@Skylar创业版',
  linkedin: 'https://www.linkedin.com/in/jiayiwang-skylar',
  linkedinHandle: 'Jiayi (Skylar) Wang',
};
window.JP_SOCIAL = JP_SOCIAL;

const PAYWALL_COPY = {
  en: {
    title: 'Want more verdicts?',
    sub: 'You’ve used today’s free ones. Unlock unlimited — share, or follow Skylar.',
    shareBtn: '🚀 Share Judge Paws',
    shareHint: 'instant unlock',
    or: 'or follow to unlock',
    igBtn: '📸 Instagram  ' + JP_SOCIAL.igHandle,
    xhsBtn: '📕 小红书 (RED)  ' + JP_SOCIAL.xhsHandle,
    liBtn: '💼 LinkedIn  ' + JP_SOCIAL.linkedinHandle,
    followedBtn: 'I followed — continue ✓',
    softTitle: 'Enjoyed your verdict? 🐾',
    softSub: 'Follow or share Skylar to support — totally optional.',
    skipBtn: 'Maybe later →',
    shareText: 'I just got judged by Judge Paws ⚖️🐾 the AI relationship court. Get your verdict:',
  },
  zh: {
    title: '想继续判?',
    sub: '今天的免费次数用完啦。分享一下、或关注 Skylar,即可解锁无限次。',
    shareBtn: '🚀 分享汪汪法官',
    shareHint: '分享即刻解锁',
    or: '或 关注解锁',
    igBtn: '📸 Instagram  ' + JP_SOCIAL.igHandle,
    xhsBtn: '📕 小红书  ' + JP_SOCIAL.xhsHandle,
    liBtn: '💼 领英 LinkedIn',
    followedBtn: '我已关注,继续 ✓',
    softTitle: '判得还满意吗?🐾',
    softSub: '关注或分享 Skylar 支持一下~ 完全自愿。',
    skipBtn: '稍后再说 →',
    shareText: '我刚被 AI 恋爱法庭 汪汪法官 ⚖️🐾 审判了。你也来领一份判决:',
  },
};

function Paywall({ reason, lang, onClose, onUnlocked, mascot, chaos, off, soft = false }) {
  const t = PAYWALL_COPY[lang === 'zh' ? 'zh' : 'en'];
  const [opened, setOpened] = React.useState(false);

  const unlock = () => { if (window.JPB) JPB.setUnlocked(); onUnlocked && onUnlocked(); };

  const shareToUnlock = async () => {
    const url = location.origin;
    try {
      if (navigator.share) await navigator.share({ text: t.shareText, url });
      else if (navigator.clipboard) await navigator.clipboard.writeText(t.shareText + ' ' + url);
    } catch (_) {}
    unlock();
  };

  const openSocial = (href) => {
    try { window.open(href, '_blank', 'noopener'); } catch (_) {}
    setOpened(true);
  };

  const followBtn = (label, href) => (
    <button onClick={() => openSocial(href)} className="jp-tap" style={{
      width: '100%', boxSizing: 'border-box', cursor: 'pointer', marginTop: 9,
      border: '1.5px solid rgba(214,98,168,0.35)', background: 'rgba(255,255,255,0.85)',
      borderRadius: 14, padding: '12px 14px', fontFamily: 'Fredoka', fontWeight: 600,
      fontSize: 14.5, color: JP.ink, textAlign: 'center' }}>{label}</button>
  );

  return (
    <Backdrop tint="pink">
      <Particles kind="confetti" count={chaos ? 14 : 8} run={!off} />
      <div style={{ position: 'relative', zIndex: 5, height: '100%', display: 'flex', flexDirection: 'column',
        padding: '60px 22px 28px', boxSizing: 'border-box' }}>
        {!soft && <button onClick={onClose} className="jp-tap" style={{ position: 'absolute', top: 54, left: 20, width: 38, height: 38,
          borderRadius: 999, border: '1.5px solid rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(14px)', cursor: 'pointer', fontSize: 18, color: JP.ink }}>‹</button>}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Mascot size={104} emoji={mascot} badge="⭐" />
          <h2 style={{ margin: '6px 0 2px', fontFamily: 'Fredoka', fontWeight: 600, fontSize: 24, color: JP.ink, textAlign: 'center' }}>{soft ? t.softTitle : t.title}</h2>
          <p style={{ margin: 0, fontFamily: 'Nunito', fontWeight: 700, fontSize: 14, color: JP.inkSoft, textAlign: 'center', maxWidth: 270 }}>{soft ? t.softSub : t.sub}</p>

          <Glass style={{ marginTop: 16, padding: 16, width: '100%' }}>
            {/* primary: share → instant unlock (also spreads the app) */}
            <PawButton full onClick={shareToUnlock}>{t.shareBtn}</PawButton>
            <div style={{ textAlign: 'center', fontFamily: 'Nunito', fontWeight: 800, fontSize: 11.5, color: JP.bubblegum, marginTop: 6 }}>
              {t.shareHint}
            </div>

            {/* divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 2px' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(214,98,168,0.2)' }} />
              <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 11.5, color: JP.inkSoft, whiteSpace: 'nowrap' }}>{t.or}</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(214,98,168,0.2)' }} />
            </div>

            {/* follow → honor-system unlock */}
            {followBtn(t.igBtn, JP_SOCIAL.ig)}
            {followBtn(t.xhsBtn, JP_SOCIAL.xhs)}
            {followBtn(t.liBtn, JP_SOCIAL.linkedin)}
            {opened && (
              <PawButton full secondary onClick={unlock} style={{ marginTop: 12 }}>{t.followedBtn}</PawButton>
            )}
          </Glass>

          {soft && (
            <button onClick={onClose} className="jp-tap" style={{ marginTop: 14, background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'Fredoka', fontWeight: 600, fontSize: 14, color: JP.inkSoft }}>
              {t.skipBtn}
            </button>
          )}
        </div>
      </div>
    </Backdrop>
  );
}
window.Paywall = Paywall;
