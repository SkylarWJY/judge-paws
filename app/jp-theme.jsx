/* Judge Paws — design tokens + reusable UI primitives */

const JP = {
  // palette
  bubblegum: '#FF4D97',
  pink: '#FF87BE',
  pinkSoft: '#FFD3E6',
  lavender: '#B49BFF',
  lavenderSoft: '#E6DCFF',
  peach: '#FFB088',
  peachSoft: '#FFE0CC',
  mint: '#34D3A6',
  red: '#FF5470',
  gold: '#FFC24B',
  ink: '#5A2D49',       // deep plum text
  inkSoft: '#9A7690',
  inkFaint: '#C4A8BC',
  white: '#FFFFFF',
  cream: '#FFF6FB',
};

// ── animated dreamy background with floating blurred blobs ──
function Backdrop({ tint = 'pink', children }) {
  const palettes = {
    pink:     ['#FFF1F8', '#FFE4F2', '#FBE7FF'],
    lavender: ['#F4EFFF', '#EDE4FF', '#FFE9F6'],
    peach:    ['#FFF3EC', '#FFE8DC', '#FFEAF4'],
    court:    ['#FFF0F7', '#F3E9FF', '#FFE9DF'],
  };
  const [a, b, c] = palettes[tint] || palettes.pink;
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: `linear-gradient(165deg, ${a} 0%, ${b} 55%, ${c} 100%)`,
    }}>
      <div className="jp-blob" style={{ background: JP.pink, width: 280, height: 280, top: -60, left: -80, animationDelay: '0s' }} />
      <div className="jp-blob" style={{ background: JP.lavender, width: 240, height: 240, top: 220, right: -90, animationDelay: '-6s' }} />
      <div className="jp-blob" style={{ background: JP.peach, width: 220, height: 220, bottom: -70, left: -40, animationDelay: '-3s' }} />
      <div style={{ position: 'relative', height: '100%', zIndex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

// ── frosted glass card ──
function Glass({ children, style = {}, soft = false, onClick, className = '' }) {
  return (
    <div onClick={onClick} className={className} style={{
      position: 'relative', borderRadius: 28,
      background: soft ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.62)',
      backdropFilter: 'blur(22px) saturate(160%)',
      WebkitBackdropFilter: 'blur(22px) saturate(160%)',
      border: '1px solid rgba(255,255,255,0.85)',
      boxShadow: '0 10px 30px rgba(214,98,168,0.16), inset 0 1px 1px rgba(255,255,255,0.9)',
      ...style,
    }}>{children}</div>
  );
}

// ── primary pill button (gradient, springy) ──
function PawButton({ children, onClick, style = {}, secondary = false, full = false, small = false }) {
  const [press, setPress] = React.useState(false);
  const base = secondary ? {
    background: 'rgba(255,255,255,0.7)',
    color: JP.bubblegum,
    border: `1.5px solid ${JP.pinkSoft}`,
    boxShadow: '0 6px 16px rgba(214,98,168,0.10)',
  } : {
    background: `linear-gradient(180deg, ${JP.pink} 0%, ${JP.bubblegum} 100%)`,
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.45)',
    boxShadow: '0 10px 22px rgba(255,77,151,0.38), inset 0 1px 1px rgba(255,255,255,0.6)',
  };
  return (
    <button onClick={onClick}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerLeave={() => setPress(false)}
      style={{
        width: full ? '100%' : 'auto',
        padding: small ? '11px 20px' : '16px 28px',
        borderRadius: 999, cursor: 'pointer',
        fontFamily: 'Fredoka, sans-serif', fontWeight: 600,
        fontSize: small ? 15 : 18, letterSpacing: 0.2,
        transform: press ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.18s cubic-bezier(.34,1.56,.64,1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        ...base, ...style,
      }}>{children}</button>
  );
}

// ── the mascot: glass medallion with real photo (or emoji fallback) + judge badge ──
function Mascot({ size = 150, emoji = '🐶', mood = 'happy', float = true, badge = '⚖️' }) {
  const isImg = typeof emoji === 'string' && /[\/.]/.test(emoji);
  return (
    <div style={{ position: 'relative', width: size, height: size }} className={float ? 'jp-bob' : ''}>
      {/* glow halo */}
      <div style={{
        position: 'absolute', inset: -size * 0.12, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(255,135,190,0.45), rgba(255,135,190,0) 70%)`,
        filter: 'blur(6px)',
      }} />
      {/* medallion */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: isImg ? '#fff5fb' : `linear-gradient(160deg, #fff 0%, ${JP.pinkSoft} 60%, ${JP.lavenderSoft} 100%)`,
        border: '3px solid rgba(255,255,255,0.95)',
        boxShadow: '0 18px 40px rgba(214,98,168,0.30), inset 0 2px 6px rgba(255,255,255,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {isImg ? (
          <img src={emoji} alt="Judge Paws" draggable={false} style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: '50% 22%', transform: 'scale(1.16)', transformOrigin: '50% 30%',
          }} />
        ) : (
          <React.Fragment>
            {/* white judge wig hint */}
            <div style={{
              position: 'absolute', top: size * 0.06, left: '50%', transform: 'translateX(-50%)',
              width: size * 0.62, height: size * 0.30, borderRadius: '50% 50% 45% 45%',
              background: 'linear-gradient(180deg,#ffffff,#f3e9f3)',
              boxShadow: '0 2px 6px rgba(160,120,150,0.25)', zIndex: 2,
            }} />
            <span style={{ fontSize: size * 0.5, position: 'relative', zIndex: 3, marginTop: size * 0.06,
              filter: 'drop-shadow(0 4px 6px rgba(160,90,130,0.25))' }}>{emoji}</span>
          </React.Fragment>
        )}
      </div>
      {/* judge badge */}
      {badge && (
        <div style={{
          position: 'absolute', right: -size * 0.02, bottom: size * 0.04,
          width: size * 0.34, height: size * 0.34, borderRadius: '50%',
          background: `linear-gradient(160deg, ${JP.gold}, #FF9E3D)`,
          border: '2.5px solid #fff', boxShadow: '0 6px 14px rgba(255,158,61,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.17, zIndex: 4,
        }}>{badge}</div>
      )}
    </div>
  );
}

// ── speech bubble for Judge Paws quips ──
function ReactionBubble({ text, tail = 'bottom', style = {} }) {
  return (
    <div className="jp-pop" style={{
      position: 'relative', display: 'inline-block',
      background: '#fff', borderRadius: 22,
      padding: '12px 18px', maxWidth: 260,
      fontFamily: 'Fredoka, sans-serif', fontWeight: 500, fontSize: 16,
      color: JP.ink, lineHeight: 1.3, textAlign: 'center',
      boxShadow: '0 12px 28px rgba(214,98,168,0.22)',
      border: '1.5px solid rgba(255,255,255,0.9)',
      ...style,
    }}>
      {text}
      <div style={{
        position: 'absolute', width: 16, height: 16, background: '#fff',
        transform: 'rotate(45deg)',
        ...(tail === 'bottom'
          ? { bottom: -7, left: '50%', marginLeft: -8, borderRight: '1.5px solid rgba(255,255,255,0.9)', borderBottom: '1.5px solid rgba(255,255,255,0.9)' }
          : { top: -7, left: '50%', marginLeft: -8, borderLeft: '1.5px solid rgba(255,255,255,0.9)', borderTop: '1.5px solid rgba(255,255,255,0.9)' }),
      }} />
    </div>
  );
}

// ── progress dots for the flow ──
function StepDots({ total, current }) {
  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 7, borderRadius: 999,
          width: i === current ? 22 : 7,
          background: i === current ? JP.bubblegum : i < current ? JP.pink : 'rgba(255,135,190,0.3)',
          transition: 'all 0.4s cubic-bezier(.34,1.56,.64,1)',
        }} />
      ))}
    </div>
  );
}

// ── floating particles (hearts / paws / confetti) ──
function Particles({ kind = 'hearts', count = 14, run = true }) {
  const glyphs = {
    hearts: ['💕', '💗', '💞', '🩷'],
    paws: ['🐾', '🐾', '🐾'],
    mix: ['💕', '🐾', '✨', '💗', '⚖️'],
    confetti: ['🎉', '✨', '💖', '🌟', '🎊'],
  }[kind] || ['💕'];
  const items = React.useMemo(() => Array.from({ length: count }).map((_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 6,
    dur: 6 + Math.random() * 5, size: 16 + Math.random() * 18,
    g: glyphs[i % glyphs.length], drift: (Math.random() - 0.5) * 60,
  })), [count, kind]);
  if (!run) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
      {items.map(it => (
        <span key={it.id} style={{
          position: 'absolute', left: it.left + '%', bottom: -40, fontSize: it.size,
          '--drift': it.drift + 'px',
          animation: `jp-rise ${it.dur}s linear ${it.delay}s infinite`,
          opacity: 0,
        }}>{it.g}</span>
      ))}
    </div>
  );
}

Object.assign(window, { JP, Backdrop, Glass, PawButton, Mascot, ReactionBubble, StepDots, Particles });
