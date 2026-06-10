/* Judge Paws — data viz: drama meter, score ring, pie, flags */

// animate a number from 0 → value once mounted
function useCountUp(value, ms = 1100, run = true) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!run) { setN(0); return; }
    let raf, start;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      const ease = 1 - Math.pow(1 - p, 3);
      setN(value * ease);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, run]);
  return n;
}

const DRAMA_LABELS = [
  { max: 20, label: 'Healthy Discussion', color: JP.mint },
  { max: 40, label: 'Minor Drama', color: '#8FD14F' },
  { max: 60, label: 'Reality Show', color: JP.gold },
  { max: 80, label: 'Netflix Documentary', color: JP.peach },
  { max: 100, label: 'Season Finale', color: JP.bubblegum },
];
function dramaTier(v) { return DRAMA_LABELS.find(d => v <= d.max) || DRAMA_LABELS[4]; }

// semicircle gauge
function DramaMeter({ value = 82, run = true }) {
  const n = useCountUp(value, 1300, run);
  const tier = dramaTier(n);
  const R = 100, SW = 20, cx = 120, cy = 120;
  const circ = Math.PI * R; // semicircle length
  const frac = n / 100;
  const angle = -180 + frac * 180; // degrees for needle
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="240" height="142" viewBox="0 0 240 140">
        <defs>
          <linearGradient id="dramaGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={JP.mint} />
            <stop offset="45%" stopColor={JP.gold} />
            <stop offset="75%" stopColor={JP.peach} />
            <stop offset="100%" stopColor={JP.bubblegum} />
          </linearGradient>
        </defs>
        {/* track */}
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none"
          stroke="rgba(255,255,255,0.6)" strokeWidth={SW} strokeLinecap="round" />
        {/* fill */}
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none"
          stroke="url(#dramaGrad)" strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} />
        {/* needle */}
        <g transform={`rotate(${angle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy} x2={cx + R - 14} y2={cy} stroke={JP.ink} strokeWidth="4" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="9" fill={JP.ink} />
          <circle cx={cx} cy={cy} r="4" fill="#fff" />
        </g>
      </svg>
      <div style={{ marginTop: -14, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 44, color: JP.ink, lineHeight: 1 }}>{Math.round(n)}</div>
        <div style={{ display: 'inline-block', marginTop: 6, padding: '5px 14px', borderRadius: 999, whiteSpace: 'nowrap',
          background: tier.color, color: '#fff', fontFamily: 'Fredoka', fontWeight: 600, fontSize: 14,
          boxShadow: `0 6px 14px ${tier.color}66` }}>{tier.label}</div>
      </div>
    </div>
  );
}

// circular score ring
function ScoreRing({ value = 78, label, emoji, color = JP.bubblegum, run = true, size = 96 }) {
  const n = useCountUp(value, 1200, run);
  const R = size / 2 - 8, C = 2 * Math.PI * R;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="8" />
          <circle cx={size/2} cy={size/2} r={R} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - n / 100)} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 20 }}>{emoji}</span>
          <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 22, color: JP.ink, lineHeight: 1 }}>{Math.round(n)}</span>
        </div>
      </div>
      <div style={{ fontFamily: 'Fredoka', fontWeight: 500, fontSize: 14, color: JP.inkSoft }}>{label}</div>
    </div>
  );
}

// who-started-it pie (conic)
function BlamePie({ a = 67, b = 33, aLabel = 'Jordan', bLabel = 'Maya', run = true }) {
  const n = useCountUp(a, 1200, run);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
          background: `conic-gradient(${JP.bubblegum} 0% ${n}%, ${JP.lavender} ${n}% 100%)`,
          boxShadow: '0 12px 26px rgba(214,98,168,0.25)' }} />
        <div style={{ position: 'absolute', inset: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 22 }}>⚖️</span>
          <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 12, color: JP.inkSoft }}>blame</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <BlameRow color={JP.bubblegum} label={aLabel} val={Math.round(n)} />
        <BlameRow color={JP.lavender} label={bLabel} val={100 - Math.round(n)} />
      </div>
    </div>
  );
}
function BlameRow({ color, label, val }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 14, height: 14, borderRadius: 5, background: color }} />
      <span style={{ fontFamily: 'Nunito', fontWeight: 700, fontSize: 14, color: JP.ink, minWidth: 60 }}>{label}</span>
      <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 18, color }}>{val}%</span>
    </div>
  );
}

// flag pill (red / green)
function FlagPill({ text, type = 'red' }) {
  const red = type === 'red';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 16,
      background: red ? 'rgba(255,84,112,0.10)' : 'rgba(52,211,166,0.12)',
      border: `1.5px solid ${red ? 'rgba(255,84,112,0.3)' : 'rgba(52,211,166,0.35)'}` }}>
      <span style={{ fontSize: 17 }}>{red ? '🚩' : '💚'}</span>
      <span style={{ fontFamily: 'Nunito', fontWeight: 700, fontSize: 13.5, color: red ? '#C13A53' : '#1E8E6E' }}>{text}</span>
    </div>
  );
}

Object.assign(window, { DramaMeter, ScoreRing, BlamePie, FlagPill, useCountUp, dramaTier, DRAMA_LABELS });
