import styles from './BackgroundCanvas.module.css'

const DOTS: [number, number][] = [
  [50, 80],
  [150, 650],
  [300, 30],
  [400, 900],
  [55, 400],
  [650, 22],
  [800, 980],
  [100, 975],
  [920, 28],
  [1050, 985],
  [1200, 38],
  [1350, 962],
  [1500, 75],
  [1650, 910],
  [1800, 195],
  [1905, 610],
  [1870, 42],
  [1752, 548],
  [1602, 195],
  [1448, 748],
  [1298, 148],
  [1148, 852],
  [998, 118],
  [848, 872],
  [698, 182],
  [548, 822],
  [398, 252],
  [248, 752],
  [128, 298],
  [78, 702],
  [198, 122],
  [1818, 802],
  [478, 478],
  [1442, 482],
  [964, 982],
  [960, 18],
  [318, 1058],
  [1598, 1058],
  [28, 548],
  [1892, 898]
]

const ORBITS = [
  { r: 200, dur: '6s', color: '#ef9f27', dotR: 4, begin: '0s' },
  { r: 350, dur: '9s', color: '#14b8a6', dotR: 3.5, begin: '2s' },
  { r: 500, dur: '14s', color: '#6366f1', dotR: 3, begin: '5s' },
  { r: 660, dur: '20s', color: '#f43f5e', dotR: 2.5, begin: '1s' }
]

export function BackgroundCanvas(): React.JSX.Element {
  return (
    <div className={styles.root}>
      <svg
        className={styles.svg}
        viewBox="0 0 1920 1080"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="bgGrid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="rgba(255,255,255,0.035)"
              strokeWidth="1"
            />
          </pattern>
          <pattern id="bgScanlines" width="1920" height="4" patternUnits="userSpaceOnUse">
            <rect width="1920" height="1" y="0" fill="rgba(0,0,0,0.1)" />
          </pattern>
          <radialGradient id="glowAmber" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef9f27" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ef9f27" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glowTeal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glowIndigo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glowRose" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Base fill */}
        <rect width="1920" height="1080" fill="#08070f" />

        {/* Glow orbs */}
        <ellipse cx="280" cy="180" rx="420" ry="300" fill="url(#glowIndigo)" />
        <ellipse cx="1700" cy="920" rx="360" ry="260" fill="url(#glowTeal)" />
        <ellipse cx="180" cy="820" rx="320" ry="220" fill="url(#glowAmber)" />
        <ellipse cx="1620" cy="140" rx="260" ry="210" fill="url(#glowRose)" />
        <ellipse cx="960" cy="540" rx="280" ry="200" fill="url(#glowIndigo)" />

        {/* Grid */}
        <rect width="1920" height="1080" fill="url(#bgGrid)" />

        {/* Concentric circles */}
        {[160, 280, 400, 520, 640, 760].map((r) => (
          <circle
            key={r}
            cx="960"
            cy="540"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}

        {/* Diagonal accent lines */}
        <line
          x1="-80"
          y1="0"
          x2="1080"
          y2="1080"
          stroke="rgba(239,159,39,0.06)"
          strokeWidth="1.5"
        />
        <line x1="840" y1="0" x2="2000" y2="1080" stroke="rgba(20,184,166,0.05)" strokeWidth="1" />
        <line x1="0" y1="280" x2="1920" y2="780" stroke="rgba(99,102,241,0.04)" strokeWidth="1" />
        <line x1="960" y1="0" x2="1920" y2="540" stroke="rgba(244,63,94,0.04)" strokeWidth="1" />

        {/* Dot field */}
        {DOTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.5 : 1} fill="rgba(255,255,255,0.2)" />
        ))}

        {/* Orbiting dots */}
        <g transform="translate(960 540)">
          {ORBITS.map((orbit, i) => (
            <g key={i}>
              <circle cx={orbit.r} cy="0" r={orbit.dotR} fill={orbit.color} opacity="0.7">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur={orbit.dur}
                  begin={orbit.begin}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}
        </g>

        {/* Scanlines */}
        <rect width="1920" height="1080" fill="url(#bgScanlines)" opacity="0.6" />
      </svg>

      <div className={styles.overlay} />
    </div>
  )
}
