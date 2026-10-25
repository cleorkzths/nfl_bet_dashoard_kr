import React, { useState, useEffect, useMemo } from 'react';
import { formatOdds, impliedPayout, payoutToAmerican } from '../utils/odds.js';

// Match team names by their last word (e.g. "Chiefs" in "Kansas City Chiefs")
function teamNicknameMatch(a, b) {
  const last = s => s?.trim().split(/\s+/).pop()?.toLowerCase();
  return last(a) === last(b);
}

const LEG_TYPES = [
  { value: 'spread', label: 'Spread' },
  { value: 'total', label: 'Game Total' },
  { value: 'moneyline', label: 'Moneyline' },
  { value: 'player_prop', label: 'Player Prop' },
];

const PROP_TYPES = [
  { value: 'passing_yards', label: 'Passing Yards' },
  { value: 'passing_tds', label: 'Passing TDs' },
  { value: 'rushing_yards', label: 'Rushing Yards' },
  { value: 'rushing_tds', label: 'Rushing TDs' },
  { value: 'receiving_yards', label: 'Receiving Yards' },
  { value: 'receptions', label: 'Receptions' },
  { value: 'receiving_tds', label: 'Receiving TDs' },
  { value: 'receiving_targets', label: 'Receiving Targets' },
  { value: 'interceptions', label: 'Interceptions Thrown' },
];

function emptyLeg() {
  return {
    type: 'spread',
    description: '',
    team: '',
    opponent: '',
    line: '',
    direction: 'over',
    odds: '',
    player_name: '',
    prop_type: 'passing_yards',
    game_id: '',
    game_date: '',
  };
}

export default function AddParlayModal({ onClose, onSave, initialParlay }) {
  const editing = !!initialParlay;
  const [name, setName] = useState(initialParlay?.name ?? '');
  const [stake, setStake] = useState(initialParlay?.stake ?? '');
  const [odds, setOdds] = useState(initialParlay?.odds ?? '');
  const [payout, setPayout] = useState(initialParlay?.payout ?? '');
  const [gameDate, setGameDate] = useState(initialParlay?.game_date ?? '');

  function handleStakeChange(val) {
    setStake(val);
    const s = parseFloat(val);
    if (!s) return;
    if (odds) {
      const o = parseInt(odds);
      const p = impliedPayout(s, o);
      if (p) setPayout(p.toFixed(2));
    } else if (payout) {
      const am = payoutToAmerican(s, parseFloat(payout));
      if (am) setOdds(String(am));
    }
  }

  function handleOddsChange(val) {
    setOdds(val);
    const o = parseInt(val);
    const s = parseFloat(stake);
    if (o && s) {
      const p = impliedPayout(s, o);
      if (p) setPayout(p.toFixed(2));
    }
  }

  function handlePayoutChange(val) {
    setPayout(val);
    const p = parseFloat(val);
    const s = parseFloat(stake);
    if (p && s) {
      const am = payoutToAmerican(s, p);
      if (am) setOdds(String(am));
    }
  }
  const [legs, setLegs] = useState(
    initialParlay?.legs?.length
      ? initialParlay.legs.map(l => ({ ...emptyLeg(), ...l, odds: l.odds ?? '', line: l.line ?? '', game_id: l.game_id ?? '', game_date: l.game_date ?? '' }))
      : [emptyLeg()]
  );
  const [games, setGames] = useState([]);
  const [preGameOdds, setPreGameOdds] = useState([]);
  const [propCache, setPropCache] = useState({}); // `${eventId}:${prop_type}` → outcomes[]
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/games/scoreboard').then(r => r.json()).then(setGames).catch(() => {});
    fetch('/api/games/odds/pregame').then(r => r.json()).then(setPreGameOdds).catch(() => {});
  }, []);

  // Map ESPN game id → Odds API entry, matched by team nickname
  const oddsMap = useMemo(() => {
    const map = {};
    for (const game of games) {
      const entry = preGameOdds.find(o =>
        teamNicknameMatch(o.homeTeam, game.home?.name) &&
        teamNicknameMatch(o.awayTeam, game.away?.name)
      );
      if (entry) map[game.id] = { entry, game };
    }
    return map;
  }, [games, preGameOdds]);

  // Fetch player prop odds when a prop leg has game + prop_type set
  useEffect(() => {
    for (const leg of legs) {
      if (leg.type !== 'player_prop' || !leg.game_id || !leg.prop_type) continue;
      const matched = oddsMap[leg.game_id];
      if (!matched) continue;
      const eventId = matched.entry.id;
      const cacheKey = `${eventId}:${leg.prop_type}`;
      if (cacheKey in propCache) continue;
      setPropCache(prev => ({ ...prev, [cacheKey]: null }));
      fetch(`/api/games/odds/player-props/${eventId}?prop_type=${leg.prop_type}`)
        .then(r => r.json())
        .then(data => setPropCache(prev => ({ ...prev, [cacheKey]: data })))
        .catch(() => setPropCache(prev => ({ ...prev, [cacheKey]: [] })));
    }
  }, [legs, oddsMap]);

  function getSuggestedOdds(leg) {
    const matched = oddsMap[leg.game_id];
    if (!matched) return null;
    const { entry, game } = matched;
    const enteredLine = leg.line !== '' && leg.line !== null ? parseFloat(leg.line) : null;

    if (leg.type === 'moneyline') {
      const abbr = leg.team?.toUpperCase();
      const fullName = abbr === game.home?.abbr ? game.home.name
                     : abbr === game.away?.abbr ? game.away.name : null;
      return entry.h2h.find(o => teamNicknameMatch(o.name, fullName))?.price ?? null;
    }

    if (leg.type === 'spread') {
      const abbr = leg.team?.toUpperCase();
      const fullName = abbr === game.home?.abbr ? game.home.name
                     : abbr === game.away?.abbr ? game.away.name : null;
      const candidates = entry.spreads.filter(o => teamNicknameMatch(o.name, fullName));
      if (enteredLine !== null) {
        return candidates.find(o => o.point === enteredLine)?.price ?? null;
      }
      return candidates[0]?.price ?? null;
    }

    if (leg.type === 'total') {
      const dir = (leg.direction || 'over').toLowerCase();
      const candidates = entry.totals.filter(o => o.name.toLowerCase() === dir);
      if (enteredLine !== null) {
        return candidates.find(o => o.point === enteredLine)?.price ?? null;
      }
      return candidates[0]?.price ?? null;
    }

    if (leg.type === 'player_prop') {
      const eventId = entry.id;
      const cacheKey = `${eventId}:${leg.prop_type}`;
      const outcomes = propCache[cacheKey];
      if (!outcomes || !leg.player_name) return null;
      const nameLower = leg.player_name.toLowerCase().trim();
      const lastName = nameLower.split(' ').pop();
      const dir = (leg.direction || 'over').toLowerCase();
      const candidates = outcomes.filter(o => {
        const desc = (o.description ?? '').toLowerCase();
        return (desc.includes(nameLower) || desc.endsWith(lastName)) && o.name.toLowerCase() === dir;
      });
      if (enteredLine !== null) {
        return candidates.find(o => o.point === enteredLine)?.price ?? null;
      }
      return candidates[0]?.price ?? null;
    }

    return null;
  }

  function updateLeg(idx, field, value) {
    setLegs(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  function applyOddsSuggestion(idx) {
    const leg = legs[idx];
    const suggested = getSuggestedOdds(leg);
    if (suggested !== null) updateLeg(idx, 'odds', String(suggested));
  }

  function addLeg() {
    setLegs(prev => [...prev, emptyLeg()]);
  }

  function removeLeg(idx) {
    setLegs(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!name.trim()) { setError('Parlay name is required.'); return; }
    if (legs.some(l => !l.description.trim())) { setError('All legs need a description.'); return; }

    setSaving(true);
    setError('');
    try {
      const body = {
        name: name.trim(),
        stake: stake ? parseFloat(stake) : null,
        odds: odds ? parseInt(odds) : null,
        payout: payout ? parseFloat(payout) : null,
        game_date: gameDate || null,
        legs: legs.map(l => ({
          type: l.type,
          description: l.description.trim(),
          team: l.team || null,
          opponent: l.opponent || null,
          line: l.line !== '' ? parseFloat(l.line) : null,
          direction: ['total', 'player_prop'].includes(l.type) ? l.direction : null,
          odds: l.odds !== '' ? parseInt(l.odds) : null,
          player_name: l.type === 'player_prop' ? l.player_name : null,
          prop_type: l.type === 'player_prop' ? l.prop_type : null,
          game_id: l.game_id || null,
          game_date: l.game_date || gameDate || null,
        })),
      };

      const res = await fetch(editing ? `/api/parlays/${initialParlay.id}` : '/api/parlays', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      const parlay = await res.json();
      onSave(parlay);
    } catch (err) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Parlay' : 'New Parlay'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5 scrollbar-thin">
          {/* Parlay info */}
          <div className="space-y-3">
            <div>
              <Label>Parlay Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Sunday Slate" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Stake ($)</Label>
                <Input type="number" value={stake} onChange={e => handleStakeChange(e.target.value)} placeholder="25" />
              </div>
              <div>
                <Label>Parlay Odds</Label>
                <Input type="number" value={odds} onChange={e => handleOddsChange(e.target.value)} placeholder="+650" />
              </div>
              <div>
                <Label>Total Payout ($)</Label>
                <Input type="number" value={payout} onChange={e => handlePayoutChange(e.target.value)} placeholder="175" />
              </div>
            </div>
          </div>

          <div>
            <Label>Game Date</Label>
            <Input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} />
          </div>

          {/* Legs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Legs</h3>
              <button
                onClick={addLeg}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium border border-emerald-700 rounded-lg px-3 py-1 transition-colors"
              >
                + Add Leg
              </button>
            </div>

            <div className="space-y-4">
              {legs.map((leg, idx) => (
                <LegForm
                  key={idx}
                  idx={idx}
                  leg={leg}
                  games={games}
                  suggestedOdds={getSuggestedOdds(leg)}
                  onApplySuggestion={() => applyOddsSuggestion(idx)}
                  onChange={(f, v) => updateLeg(idx, f, v)}
                  onRemove={legs.length > 1 ? () => removeLeg(idx) : null}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : editing ? 'Update Parlay' : 'Save Parlay'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LegForm({ idx, leg, games, suggestedOdds, onApplySuggestion, onChange, onRemove }) {
  const isProp = leg.type === 'player_prop';
  const isTotal = leg.type === 'total';
  const isSpread = leg.type === 'spread';
  const isMl = leg.type === 'moneyline';

  return (
    <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase">Leg {idx + 1}</span>
        {onRemove && (
          <button onClick={onRemove} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Remove</button>
        )}
      </div>

      {/* Type selector */}
      <div className="flex gap-1 flex-wrap">
        {LEG_TYPES.map(lt => (
          <button
            key={lt.value}
            onClick={() => onChange('type', lt.value)}
            className={`text-xs px-3 py-1 rounded-lg transition-colors font-medium ${
              leg.type === lt.value
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {lt.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <div>
        <Label>Description</Label>
        <Input
          value={leg.description}
          onChange={e => onChange('description', e.target.value)}
          placeholder={
            isProp ? 'Mahomes over 275.5 pass yds'
            : isTotal ? 'Chiefs/Raiders over 47.5'
            : isSpread ? 'Chiefs -3.5'
            : 'Chiefs ML'
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {/* Team */}
        {(isSpread || isMl || isProp) && (
          <div>
            <Label>{isProp ? 'Team' : 'Team'}</Label>
            <Input value={leg.team} onChange={e => onChange('team', e.target.value)} placeholder="KC" />
          </div>
        )}

        {/* Opponent */}
        {(isSpread || isMl || isTotal) && (
          <div>
            <Label>Opponent</Label>
            <Input value={leg.opponent} onChange={e => onChange('opponent', e.target.value)} placeholder="LV" />
          </div>
        )}

        {/* Line */}
        {(isSpread || isTotal || isProp) && (
          <div>
            <Label>{isSpread ? 'Spread' : 'Line'}</Label>
            <Input type="number" step="0.5" value={leg.line} onChange={e => onChange('line', e.target.value)} placeholder={isSpread ? '-3.5' : '47.5'} />
          </div>
        )}

        {/* Direction */}
        {(isTotal || isProp) && (
          <div>
            <Label>Direction</Label>
            <select
              value={leg.direction}
              onChange={e => onChange('direction', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="over">Over</option>
              <option value="under">Under</option>
            </select>
          </div>
        )}

        {/* Odds */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Odds</Label>
            {suggestedOdds !== null && (
              <button
                type="button"
                onClick={onApplySuggestion}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Use {suggestedOdds > 0 ? '+' : ''}{suggestedOdds} ↗
              </button>
            )}
          </div>
          <Input type="number" value={leg.odds} onChange={e => onChange('odds', e.target.value)} placeholder="-110" />
        </div>
      </div>

      {/* Player prop fields */}
      {isProp && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Player Name</Label>
            <Input value={leg.player_name} onChange={e => onChange('player_name', e.target.value)} placeholder="Patrick Mahomes" />
          </div>
          <div>
            <Label>Prop Type</Label>
            <select
              value={leg.prop_type}
              onChange={e => onChange('prop_type', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PROP_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Game picker */}
      {games.length > 0 && (
        <div>
          <Label>Link to Live Game (optional)</Label>
          <select
            value={leg.game_id}
            onChange={e => {
              const g = games.find(g => g.id === e.target.value);
              onChange('game_id', e.target.value);
              if (g?.date) onChange('game_date', g.date.split('T')[0]);
            }}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">— Not linked —</option>
            {games.map(g => (
              <option key={g.id} value={g.id}>{g.shortName} · {g.statusText}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function Label({ children }) {
  return <label className="block text-xs text-gray-400 mb-1 font-medium">{children}</label>;
}

function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${className}`}
    />
  );
}
