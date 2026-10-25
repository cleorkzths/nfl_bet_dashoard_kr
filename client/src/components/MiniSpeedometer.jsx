import React from 'react';

/**
 * Small semicircle speedometer showing win probability.
 * Needle sweeps left (0%) → up (50%) → right (100%).
 * Arc fills with a red→amber→green gradient.
 * Needle color: red <35%, amber 35–65%, green >65%.
 */
export default function MiniSpeedometer({ probability }) {
  const pct = Math.max(0.01, Math.min(0.99, probability ?? 0.5));

  // SVG dimensions
  const cx = 22, cy = 22, r = 18;
  const needleLen = 13;

  // Needle angle: 0% → -180° (left), 50% → -90° (up), 100% → 0° (right)
  const angleDeg = -180 + pct * 180;
  const angleRad = angleDeg * (Math.PI / 180);
  const nx = cx + needleLen * Math.cos(angleRad);
  const ny = cy + needleLen * Math.sin(angleRad);

  // Arc path: semicircle from (cx-r, cy) to (cx+r, cy)
  const arcLen = Math.PI * r; // ≈ 56.5

  // Needle + indicator color
  const needleColor = pct > 0.65 ? '#10b981' : pct < 0.35 ? '#ef4444' : '#f59e0b';

  return (
    <svg width="44" height="26" viewBox="0 0 44 26" className="flex-shrink-0">
      <defs>
        {/* Gradient along the arc: red → amber → green */}
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#ef4444" />
          <stop offset="50%"  stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Background arc track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#374151"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Filled arc (progress) */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="url(#arcGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={arcLen}
        strokeDashoffset={arcLen * (1 - pct)}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />

      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={nx} y2={ny}
        stroke={needleColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{ transition: 'x2 0.6s ease, y2 0.6s ease' }}
      />

      {/* Center pivot dot */}
      <circle cx={cx} cy={cy} r="2" fill={needleColor} />
    </svg>
  );
}
