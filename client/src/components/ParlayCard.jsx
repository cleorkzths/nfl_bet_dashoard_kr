import React, { useState } from 'react';
import LegRow from './LegRow.jsx';
import ProbabilityGauge from './ProbabilityGauge.jsx';
import { parlayProb, formatOdds, bookImpliedProb } from '../utils/odds.js';
import { STATUS_META, formatCurrency, formatDate } from '../utils/format.js';

export default function ParlayCard({ parlay, gameScores, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(true);
  const meta = STATUS_META[parlay.status] ?? STATUS_META.pending;
  const calcProb = parlayProb(parlay.legs);
  const bookProb = bookImpliedProb(parlay.stake, parlay.payout);
  const edge = bookProb !== null ? calcProb - bookProb : null;
  const isLive = ['active', 'winning', 'losing'].includes(parlay.status);

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition-all ${
      isLive ? 'border-emerald-500/40 shadow-lg shadow-emerald-900/20' : 'border-gray-700/50'
    }`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        {isLive && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-900/40 px-2 py-0.5 rounded-full flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        )}

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white truncate">{parlay.name}</h2>
          <p className="text-xs text-gray-500">
            {parlay.legs.length} leg{parlay.legs.length !== 1 ? 's' : ''}{parlay.game_date ? ` · ${formatDate(parlay.game_date)}` : ''}
          </p>
        </div>

        <div className="text-right flex-shrink-0 hidden sm:block">
          {parlay.stake && (
            <p className="text-sm text-gray-300">
              {formatCurrency(parlay.stake)} <span className="text-gray-500">→</span> {formatCurrency(parlay.payout)}
            </p>
          )}
          {parlay.odds && (
            <p className="text-xs text-gray-500 font-mono">{formatOdds(parlay.odds)}</p>
          )}
        </div>

        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${meta.color} ${meta.bg} border border-white/5`}>
          {meta.label}
        </span>

        <span className={`text-gray-500 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {parlay.legs.length > 0 && (
            <div className="flex items-center justify-between gap-4 bg-gray-800/60 rounded-xl p-4 mb-3">
              <ProbabilityGauge probability={calcProb} size={150} />
              <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
                <StatCell label="Legs" value={`${parlay.legs.filter(l => ['won','winning'].includes(l.status)).length} / ${parlay.legs.length}`} />
                <StatCell label="Stake → Payout" value={parlay.stake ? `${formatCurrency(parlay.stake)} → ${formatCurrency(parlay.payout)}` : '-'} />
                <StatCell label="Book implies" value={bookProb !== null ? `${(bookProb * 100).toFixed(1)}%` : '-'} mono />
                <StatCell label="Our estimate" value={`${(calcProb * 100).toFixed(1)}%`} mono
                  highlight={edge !== null && edge > 0}
                  dimmed={edge !== null && edge < 0}
                  suffix={edge !== null ? ` (${edge > 0 ? '+' : ''}${(edge * 100).toFixed(1)}%)` : ''}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {parlay.legs.map(leg => (
              <LegRow
                key={leg.id}
                leg={leg}
                game={gameScores?.[leg.game_id]}
              />
            ))}
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(parlay); }}
              className="text-xs text-gray-500 hover:text-emerald-400 transition-colors px-2 py-1 rounded"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(parlay.id); }}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, mono, highlight, dimmed, suffix }) {
  const color = highlight ? 'text-emerald-400' : dimmed ? 'text-red-400' : 'text-white';
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`font-semibold ${color} ${mono ? 'font-mono' : ''}`}>
        {value ?? '-'}{suffix && <span className="text-xs text-gray-400">{suffix}</span>}
      </p>
    </div>
  );
}
