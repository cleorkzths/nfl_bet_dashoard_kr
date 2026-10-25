import React from 'react';
import { STATUS_META, formatStat, formatPct } from '../utils/format.js';
import { formatOdds } from '../utils/odds.js';
import { calcElapsed, projectedTotal } from '../hooks/useGameScores.js';
import { impliedExpected } from '../utils/odds.js';

const TYPE_ICONS = {
  spread: '↕',
  total: '∑',
  moneyline: '◆',
  player_prop: '👤',
};

export default function LegRow({ leg, game }) {
  const meta = STATUS_META[leg.status] ?? STATUS_META.pending;
  const isLive = game && !game.completed && game.period > 0;
  const isFinal = game?.completed;

  return (
    <div className={`px-4 py-3 rounded-lg ${meta.bg} border border-white/5`}>
      {/* Main row */}
      <div className="flex items-center gap-3">
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

      {/* Game score bubble */}
      {game && (isLive || isFinal) && (
        <div className="mt-2 ml-10 flex flex-wrap gap-2 items-center">
          {/* Score chip */}
          <span className="inline-flex items-center gap-1.5 text-xs bg-gray-800 border border-gray-700 rounded-full px-3 py-1 font-mono">
            <span className="text-gray-300">{game.away.abbr}</span>
            <span className="text-white font-bold">{game.away.score}</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-300">{game.home.abbr}</span>
            <span className="text-white font-bold">{game.home.score}</span>
            <span className="text-gray-600 mx-1">|</span>
            {isFinal
              ? <span className="text-gray-400">Final</span>
              : <span className="text-emerald-400">Q{game.period} {game.clock}</span>
            }
          </span>

          {/* Projected value chip (totals) */}
          {leg.type === 'total' && !isFinal && (() => {
            const elapsed = calcElapsed(game.period, game.clock);
            const proj = projectedTotal(game.away.score + game.home.score, elapsed, leg.line);
            if (proj === null) return null;
            const isOver = proj > leg.line;
            return (
              <span className={`inline-flex items-center gap-1 text-xs rounded-full px-3 py-1 border ${
                isOver
                  ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-400'
                  : 'bg-red-900/30 border-red-700/40 text-red-400'
              }`}>
                proj ~{proj.toFixed(0)} pts {isOver ? '↑' : '↓'}
              </span>
            );
          })()}

          {/* Projected value chip (spreads) */}
          {leg.type === 'spread' && !isFinal && game && (() => {
            const teamIsHome = leg.team?.toUpperCase() === game.home.abbr?.toUpperCase();
            const teamScore = teamIsHome ? game.home.score : game.away.score;
            const oppScore = teamIsHome ? game.away.score : game.home.score;
            const margin = teamScore - oppScore;
            const coverMargin = margin + (leg.line ?? 0);
            const covering = coverMargin > 0;
            return (
              <span className={`inline-flex items-center gap-1 text-xs rounded-full px-3 py-1 border ${
                covering
                  ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-400'
                  : 'bg-red-900/30 border-red-700/40 text-red-400'
              }`}>
                {margin >= 0 ? '+' : ''}{margin} {covering ? 'covering' : 'not covering'}
              </span>
            );
          })()}

          {/* Player stat chip */}
          {leg.type === 'player_prop' && leg.current_value !== null && leg.current_value !== undefined && (() => {
            const elapsed = calcElapsed(game.period, game.clock);
            // Bayesian blend: weight pace by elapsed fraction, market prior by remaining fraction.
            // Prior is derived from the odds — e.g. over 5 rec at +140 implies expected ~4.4,
            // not 5, so we don't over-inflate projections for alt lines.
            const proj = elapsed > 120 ? (() => {
              const pace = (leg.current_value / elapsed) * 3600;
              const alpha = elapsed / 3600;
              const prior = impliedExpected(leg.line, leg.odds, leg.prop_type, leg.direction);
              return alpha * pace + (1 - alpha) * prior;
            })() : null;
            const onPace = proj !== null
              ? (leg.direction === 'over' ? proj >= leg.line : proj <= leg.line)
              : null;
            return (
              <span className={`inline-flex items-center gap-1 text-xs rounded-full px-3 py-1 border ${
                onPace === null ? 'bg-gray-800 border-gray-700 text-gray-400' :
                onPace ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-400'
                       : 'bg-red-900/30 border-red-700/40 text-red-400'
              }`}>
                {formatStat(leg.current_value, leg.prop_type)}
                {proj !== null && ` → proj ~${proj.toFixed(0)}`}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function formatLiveValue(leg) {
  if (leg.type === 'spread') {
    const diff = leg.current_value ?? 0;
    return diff >= 0 ? `+${diff}` : `${diff}`;
  }
  if (leg.type === 'total') return `${leg.current_value} pts`;
  if (leg.type === 'player_prop') return formatStat(leg.current_value, leg.prop_type);
  return leg.current_value;
}
