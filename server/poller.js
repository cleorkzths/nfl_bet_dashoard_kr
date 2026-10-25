/**
 * Background poller: fetches ESPN data for games with active legs,
 * updates leg statuses, and emits socket events.
 */

import { getActiveLegs, updateLeg, updateParlayStatus, getAllParlays } from './db/queries.js';
import { getGameSummary, getPlayerStat } from './services/espn.js';
import { spreadProb, totalProb, playerPropProb, moneylineProb, oddsImpliedProb } from './services/probability.js';

const POLL_INTERVAL_MS = 30_000;
let io = null;
let intervalId = null;

export function startPoller(socketIo) {
  io = socketIo;
  poll();
  intervalId = setInterval(poll, POLL_INTERVAL_MS);
  console.log('[poller] started, interval=30s');
}

export function stopPoller() {
  if (intervalId) clearInterval(intervalId);
}

async function poll() {
  try {
    const legs = await getActiveLegs();
    if (!legs.length) return;

    // Group by game_id to avoid redundant ESPN calls
    const byGame = {};
    for (const leg of legs) {
      if (!byGame[leg.game_id]) byGame[leg.game_id] = [];
      byGame[leg.game_id].push(leg);
    }

    const summaries = {};
    await Promise.all(
      Object.keys(byGame).map(async (gameId) => {
        try {
          summaries[gameId] = await getGameSummary(gameId);
        } catch (err) {
          console.warn(`[poller] ESPN fetch failed for game ${gameId}:`, err.message);
        }
      })
    );

    for (const [gameId, gameLegs] of Object.entries(byGame)) {
      const summary = summaries[gameId];
      if (!summary) continue;
      for (const leg of gameLegs) {
        const update = computeLegUpdate(leg, summary);
        await updateLeg(leg.id, update);
      }
    }

    // Recalculate parlay statuses
    const parlays = await getAllParlays();
    for (const parlay of parlays) {
      if (!['pending', 'active'].includes(parlay.status)) continue;
      const newStatus = deriveParlayStatus(parlay.legs);
      if (newStatus !== parlay.status) {
        await updateParlayStatus(parlay.id, newStatus);
      }
    }

    if (io) {
      io.emit('parlays:update', await getAllParlays());
    }
  } catch (err) {
    console.error('[poller] error:', err);
  }
}

function computeLegUpdate(leg, summary) {
  const { homeWinPct, awayWinPct, elapsedSeconds, playerStats, completed,
          homeScore, awayScore, homeAbbr, awayAbbr } = summary;

  let status = leg.status === 'won' || leg.status === 'lost' || leg.status === 'push'
    ? leg.status : 'pending';
  let current_value = leg.current_value;
  let win_probability = leg.win_probability;

  const teamIsHome = leg.team?.toUpperCase() === homeAbbr?.toUpperCase();

  if (leg.type === 'moneyline') {
    win_probability = homeWinPct !== null
      ? (teamIsHome ? homeWinPct : awayWinPct)
      : oddsImpliedProb(leg.odds);

    if (completed) {
      const teamScore = teamIsHome ? homeScore : awayScore;
      const oppScore = teamIsHome ? awayScore : homeScore;
      status = teamScore > oppScore ? 'won' : teamScore < oppScore ? 'lost' : 'push';
    } else if (elapsedSeconds > 0) {
      status = win_probability >= 0.5 ? 'winning' : 'losing';
    }

  } else if (leg.type === 'spread') {
    const teamScore = teamIsHome ? homeScore : awayScore;
    const oppScore = teamIsHome ? awayScore : homeScore;
    current_value = teamScore - oppScore;

    win_probability = spreadProb({
      teamScore, oppScore, line: leg.line, elapsedSeconds, completed,
    }) ?? oddsImpliedProb(leg.odds);

    if (completed) {
      const diff = current_value + leg.line;
      status = diff > 0 ? 'won' : diff < 0 ? 'lost' : 'push';
    } else if (elapsedSeconds > 0) {
      status = win_probability >= 0.5 ? 'winning' : 'losing';
    }

  } else if (leg.type === 'total') {
    current_value = homeScore + awayScore;

    win_probability = totalProb({
      homeScore, awayScore, line: leg.line, direction: leg.direction, elapsedSeconds, completed,
    }) ?? oddsImpliedProb(leg.odds);

    if (completed) {
      const diff = current_value - leg.line;
      const push = Math.abs(diff) < 0.5;
      status = push ? 'push' : (leg.direction === 'over') === (diff > 0) ? 'won' : 'lost';
    } else if (elapsedSeconds > 0) {
      status = win_probability >= 0.5 ? 'winning' : 'losing';
    }

  } else if (leg.type === 'player_prop') {
    const stat = getPlayerStat(playerStats, leg.player_name, leg.prop_type);
    current_value = stat;

    win_probability = stat !== null
      ? playerPropProb({ currentStat: stat, line: leg.line, direction: leg.direction, elapsedSeconds, completed, odds: leg.odds, propType: leg.prop_type })
      : oddsImpliedProb(leg.odds);

    if (completed && stat !== null) {
      const diff = stat - leg.line;
      const push = Math.abs(diff) < 0.5;
      status = push ? 'push' : (leg.direction === 'over') === (diff > 0) ? 'won' : 'lost';
    } else if (elapsedSeconds > 0 && stat !== null) {
      status = (win_probability ?? 0.5) >= 0.5 ? 'winning' : 'losing';
    }
  }

  return { status, current_value, win_probability };
}

function deriveParlayStatus(legs) {
  if (!legs.length) return 'pending';
  if (legs.some(l => l.status === 'lost')) return 'lost';
  if (legs.every(l => ['won', 'push'].includes(l.status))) {
    return legs.every(l => l.status === 'push') ? 'push' : 'won';
  }
  if (legs.some(l => ['winning', 'losing', 'won', 'push'].includes(l.status))) return 'active';
  return 'pending';
}
