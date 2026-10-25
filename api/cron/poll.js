import { getActiveLegs, updateLeg, updateParlayStatus, getAllParlays } from '../../lib/queries.js';
import { getGameSummary, getPlayerStat } from '../../server/services/espn.js';
import { spreadProb, totalProb, playerPropProb, oddsImpliedProb } from '../../server/services/probability.js';

export default async function handler(req, res) {
  // Vercel sets this header automatically for cron jobs
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  try {
    await runPoll();
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    console.error('[cron/poll]', err);
    res.status(500).json({ error: err.message });
  }
}

export async function runPoll() {
  const legs = await getActiveLegs();
  if (!legs.length) return;

  const byGame = {};
  for (const leg of legs) {
    if (!byGame[leg.game_id]) byGame[leg.game_id] = [];
    byGame[leg.game_id].push(leg);
  }

  const summaries = {};
  await Promise.all(
    Object.keys(byGame).map(async (gameId) => {
      try { summaries[gameId] = await getGameSummary(gameId); }
      catch (err) { console.warn(`[poll] ESPN failed for ${gameId}:`, err.message); }
    })
  );

  for (const [gameId, gameLegs] of Object.entries(byGame)) {
    const summary = summaries[gameId];
    if (!summary) continue;
    for (const leg of gameLegs) {
      await updateLeg(leg.id, computeLegUpdate(leg, summary));
    }
  }

  const parlays = await getAllParlays();
  for (const parlay of parlays) {
    if (!['pending', 'active'].includes(parlay.status)) continue;
    const newStatus = deriveParlayStatus(parlay.legs);
    if (newStatus !== parlay.status) await updateParlayStatus(parlay.id, newStatus);
  }
}

function computeLegUpdate(leg, summary) {
  const { homeWinPct, awayWinPct, elapsedSeconds, playerStats, completed,
          homeScore, awayScore, homeAbbr, awayAbbr } = summary;
  const teamIsHome = leg.team?.toUpperCase() === homeAbbr?.toUpperCase();

  let status = ['won','lost','push'].includes(leg.status) ? leg.status : 'pending';
  let current_value = leg.current_value;
  let win_probability = leg.win_probability;

  if (leg.type === 'moneyline') {
    win_probability = homeWinPct !== null
      ? (teamIsHome ? homeWinPct : awayWinPct)
      : oddsImpliedProb(leg.odds);
    if (completed) {
      const ts = teamIsHome ? homeScore : awayScore;
      const os = teamIsHome ? awayScore : homeScore;
      status = ts > os ? 'won' : ts < os ? 'lost' : 'push';
    } else if (elapsedSeconds > 0) {
      status = win_probability >= 0.5 ? 'winning' : 'losing';
    }

  } else if (leg.type === 'spread') {
    const ts = teamIsHome ? homeScore : awayScore;
    const os = teamIsHome ? awayScore : homeScore;
    current_value = ts - os;
    win_probability = spreadProb({ teamScore: ts, oppScore: os, line: leg.line, elapsedSeconds, completed })
      ?? oddsImpliedProb(leg.odds);
    if (completed) {
      const diff = current_value + leg.line;
      status = diff > 0 ? 'won' : diff < 0 ? 'lost' : 'push';
    } else if (elapsedSeconds > 0) {
      status = win_probability >= 0.5 ? 'winning' : 'losing';
    }

  } else if (leg.type === 'total') {
    current_value = homeScore + awayScore;
    win_probability = totalProb({ homeScore, awayScore, line: leg.line, direction: leg.direction, elapsedSeconds, completed })
      ?? oddsImpliedProb(leg.odds);
    if (completed) {
      const diff = current_value - leg.line;
      status = Math.abs(diff) < 0.5 ? 'push' : (leg.direction === 'over') === (diff > 0) ? 'won' : 'lost';
    } else if (elapsedSeconds > 0) {
      status = win_probability >= 0.5 ? 'winning' : 'losing';
    }

  } else if (leg.type === 'player_prop') {
    const stat = getPlayerStat(playerStats, leg.player_name, leg.prop_type);
    current_value = stat;
    win_probability = stat !== null
      ? playerPropProb({ currentStat: stat, line: leg.line, direction: leg.direction, elapsedSeconds, completed })
      : oddsImpliedProb(leg.odds);
    if (completed && stat !== null) {
      const diff = stat - leg.line;
      status = Math.abs(diff) < 0.5 ? 'push' : (leg.direction === 'over') === (diff > 0) ? 'won' : 'lost';
    } else if (elapsedSeconds > 0 && stat !== null) {
      status = (win_probability ?? 0.5) >= 0.5 ? 'winning' : 'losing';
    }
  }

  return { status, current_value, win_probability };
}

function deriveParlayStatus(legs) {
  if (!legs.length) return 'pending';
  if (legs.some(l => l.status === 'lost')) return 'lost';
  if (legs.every(l => ['won','push'].includes(l.status)))
    return legs.every(l => l.status === 'push') ? 'push' : 'won';
  if (legs.some(l => ['winning','losing','won','push'].includes(l.status))) return 'active';
  return 'pending';
}
