import React from 'react';
import { STATUS_META, formatStat, formatPct } from '../utils/format.js';
import { formatOdds } from '../utils/odds.js';

const TYPE_ICONS = {
  spread: '↕',
  total: '∑',
  moneyline: '◆',
  player_prop: '👤',
};

export default function LegRow({ leg }) {
  const meta = STATUS_META[leg.status] ?? STATUS_META.pending;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${meta.bg} border border-white/5`}>
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />

      {/* Type icon */}
      <span className="text-sm w-5 text-center flex-shrink-0 select-none">
        {TYPE_ICONS[leg.type] ?? '?'}
      </span>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{leg.description}</p>
        {leg.player_name && (
          <p className="text-xs text-gray-400">{leg.player_name}</p>
        )}
      </div>

      {/* Live value */}
      {leg.current_value !== null && leg.current_value !== undefined && (
        <div className="text-right flex-shrink-0">
          <p className={`text-sm font-mono font-semibold ${meta.color}`}>
            {formatLiveValue(leg)}
          </p>
          <p className="text-xs text-gray-500">
            {leg.type === 'player_prop' ? formatStat(leg.current_value, leg.prop_type) : `vs ${leg.line}`}
          </p>
        </div>
      )}

      {/* Win probability */}
      {leg.win_probability !== null && leg.win_probability !== undefined && (
        <div className="flex-shrink-0 w-12 text-right">
          <p className={`text-xs font-semibold ${meta.color}`}>
            {formatPct(leg.win_probability)}
          </p>
        </div>
      )}

      {/* Odds */}
      <div className="flex-shrink-0 w-12 text-right">
        <span className="text-xs text-gray-400 font-mono">{formatOdds(leg.odds)}</span>
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color} bg-black/20`}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

function formatLiveValue(leg) {
  if (leg.type === 'spread') {
    const diff = leg.current_value ?? 0;
    return diff >= 0 ? `+${diff}` : `${diff}`;
  }
  if (leg.type === 'total') {
    return `${leg.current_value} pts`;
  }
  if (leg.type === 'player_prop') {
    return formatStat(leg.current_value, leg.prop_type);
  }
  return leg.current_value;
}
