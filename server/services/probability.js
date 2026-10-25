/**
 * Live leg win probability estimators.
 * All return a value [0, 1].
 */

import { americanToProb } from './odds.js';

// Seconds per quarter
const Q = 900;
const TOTAL_SECS = 3600;

/**
 * Moneyline: use ESPN win probability directly.
 */
export function moneylineProb({ team, homeTeam, homeWinPct, awayWinPct, completed, wonTeam }) {
  if (completed) {
    return wonTeam === team ? 1 : 0;
  }
  if (homeWinPct === null) return null;
  const isHome = team?.toLowerCase() === homeTeam?.toLowerCase();
  return isHome ? homeWinPct : awayWinPct;
}

/**
 * Spread: estimate probability of covering given current score diff and time.
 * Uses a simple linear regression approach with normal distribution.
 */
export function spreadProb({ teamScore, oppScore, line, elapsedSeconds, completed, teamIsHome, homeWinPct }) {
  if (completed) {
    const diff = teamScore - oppScore;
    if (Math.abs(diff + line) < 0.5) return 0.5; // push
    return (diff + line) > 0 ? 1 : 0;
  }

  const currentDiff = teamScore - oppScore; // positive = team leading
  const currentVsLine = currentDiff + line;  // positive = covering

  const timeLeft = TOTAL_SECS - elapsedSeconds;
  if (timeLeft <= 0) {
    return currentVsLine > 0 ? 1 : currentVsLine < 0 ? 0 : 0.5;
  }

  // Points per second in NFL ≈ 45pts / 3600s = 0.0125 pts/sec per team
  // Combined scoring std dev grows with sqrt(timeLeft)
  const pointsPerSec = 0.0125;
  const expectedPtsRemaining = timeLeft * pointsPerSec * 2; // both teams
  const stddev = Math.sqrt(timeLeft / 60) * 1.4; // rough empirical

  // z-score: how many std devs is current cover margin from 0
  const z = currentVsLine / stddev;
  return normalCDF(z);
}

/**
 * Total (over/under): use current scoring pace to estimate final total.
 */
export function totalProb({ homeScore, awayScore, line, direction, elapsedSeconds, completed }) {
  const combined = homeScore + awayScore;

  if (completed) {
    if (Math.abs(combined - line) < 0.5) return 0.5;
    const over = combined > line;
    return (direction === 'over') === over ? 1 : 0;
  }

  const timeLeft = TOTAL_SECS - elapsedSeconds;
  if (elapsedSeconds < 60) return null; // too early

  // Projected total based on current pace
  const pace = (combined / elapsedSeconds) * TOTAL_SECS;
  const stddev = Math.sqrt(timeLeft / 60) * 1.4;

  const gap = direction === 'over' ? pace - line : line - pace;
  const z = gap / stddev;
  return normalCDF(z);
}

/**
 * Player prop: use current stat vs. line with time-based projection.
 */
export function playerPropProb({ currentStat, line, direction, elapsedSeconds, completed }) {
  if (currentStat === null || currentStat === undefined) return null;

  if (completed) {
    if (Math.abs(currentStat - line) < 0.5) return 0.5;
    const over = currentStat > line;
    return (direction === 'over') === over ? 1 : 0;
  }

  if (elapsedSeconds < 120) return null; // need some sample

  const timeLeft = TOTAL_SECS - elapsedSeconds;
  const pace = (currentStat / elapsedSeconds) * TOTAL_SECS;
  const stddev = Math.sqrt(timeLeft / 60) * 2.5; // props have more variance

  const gap = direction === 'over' ? pace - line : line - pace;
  const z = gap / stddev;
  return normalCDF(z);
}

/**
 * Fallback: use locked-in odds implied probability.
 */
export function oddsImpliedProb(americanOdds) {
  if (!americanOdds) return 0.5;
  return americanToProb(americanOdds);
}

/**
 * Parlay combined probability.
 */
export function parlayProb(legs) {
  if (!legs.length) return 0;
  return legs.reduce((acc, leg) => {
    const p = leg.win_probability ?? oddsImpliedProb(leg.odds);
    return acc * p;
  }, 1);
}

// ── Math helpers ─────────────────────────────────────────────────────────────

function normalCDF(z) {
  // Abramowitz & Stegun approximation
  const a = 0.2316419;
  const b = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const t = 1 / (1 + a * Math.abs(z));
  const poly = t * (b[0] + t * (b[1] + t * (b[2] + t * (b[3] + t * b[4]))));
  const phi = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z);
  const cdf = 1 - phi * poly;
  return z >= 0 ? cdf : 1 - cdf;
}
