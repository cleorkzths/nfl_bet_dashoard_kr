import React from 'react';

/**
 * SVG semi-circle gauge showing parlay win probability.
 * 0% = full red arc on left, 100% = full green arc on right.
 */
export default function ProbabilityGauge({ probability, size = 140 }) {
  const pct = probability ?? 0;
  const r = 48;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const strokeWidth = 10;
  const circumference = Math.PI * r; // half circle

  // Arc goes from 180° (left) to 0° (right) — left-to-right sweep
  const filled = circumference * pct;
  const empty = circumference - filled;

  // Color interpolation: red → yellow → green
  const hue = Math.round(pct * 120); // 0 = red, 60 = yellow, 120 = green
  const color = `hsl(${hue}, 90%, 55%)`;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6}`}>
        {/* Background track */}
        <path
          d={describeArc(cx, cy, r)}
          fill="none"
          stroke="#1f2937"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={describeArc(cx, cy, r)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${empty}`}
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
        />
        {/* Percentage label */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="white"
          fontSize="18"
          fontWeight="700"
          fontFamily="Inter, sans-serif"
        >
          {Math.round(pct * 100)}%
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize="9"
          fontFamily="Inter, sans-serif"
        >
          WIN PROB
        </text>
        {/* Min/Max labels */}
        <text x={cx - r - 4} y={cy + 14} textAnchor="end" fill="#6b7280" fontSize="9">0%</text>
        <text x={cx + r + 4} y={cy + 14} textAnchor="start" fill="#6b7280" fontSize="9">100%</text>
      </svg>
    </div>
  );
}

function describeArc(cx, cy, r) {
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;
  return `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;
}
