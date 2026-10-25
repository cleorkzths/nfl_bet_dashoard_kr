/**
 * Live leg win probability estimators.
 * All return a value [0, 1].
 *
 * Key design: Bayesian blend between current pace and market prior (the line).
 * Early in the game the pace estimate is noisy, so we weight toward the prior.
 * As elapsed time increases we trust the observed pace more.
 */

import { americanToProb } from './odds.js';

const Q = 900; // seconds per quarter
const TOTAL_SECS = 3600;

export function moneylineProb({ team, homeTeam, homeWinPct, awayWinPct, completed, wonTeam }) {
  if (completed) return wonTeam === team ? 1 : 0;
  if (homeWinPct === null) return null;
  const isHome = team?.toLowerCase() === homeTeam?.toLowerCase();
  return isHome ? homeWinPct : awayWinPct;
}

export function spreadProb({ teamScore, oppScore, line, elapsedSeconds, completed }) {
  if (completed) {
    const diff = teamScore - oppScore;
    if (Math.abs(diff + line) < 0.5) return 0.5;
    return (diff + line) > 0 ? 1 : 0;
  }

  const currentDiff = teamScore - oppScore;
  const timeLeft = TOTAL_SECS - elapsedSeconds;
  if (elapsedSeconds < 60) return null;
  if (timeLeft <= 0) {
    const cv = currentDiff + line;
    return cv > 0 ? 1 : cv < 0 ? 0 : 0.5;
  }

  // Current cover margin vs expected (0 = at the line)
  const currentVsLine = currentDiff + line;

  // Bayesian blend: early → trust the prior (0 margin), late → trust observed
  const alpha = elapsedSeconds / TOTAL_SECS;
  const blendedMargin = alpha * currentVsLine; // prior is 0 (equal chance)

  const stddev = Math.sqrt(timeLeft / 60) * 1.4;
  const z = blendedMargin / stddev;
  return clamp(normalCDF(z));
}

export function totalProb({ homeScore, awayScore, line, direction, elapsedSeconds, completed }) {
  const combined = homeScore + awayScore;

  if (completed) {
    if (Math.abs(combined - line) < 0.5) return 0.5;
    return (direction === 'over') === (combined > line) ? 1 : 0;
  }

  const timeLeft = TOTAL_SECS - elapsedSeconds;
  if (elapsedSeconds < 60) return null;
  if (timeLeft <= 0) {
    if (Math.abs(combined - line) < 0.5) return 0.5;
    return (direction === 'over') === (combined > line) ? 1 : 0;
  }

  // Bayesian projection: blend observed pace with market prior (the line)
  const paceProjected = (combined / elapsedSeconds) * TOTAL_SECS;
  const alpha = elapsedSeconds / TOTAL_SECS;
  const projected = alpha * paceProjected + (1 - alpha) * line;

  const stddev = Math.sqrt(timeLeft / 60) * 1.4;
  const gap = direction === 'over' ? projected - line : line - projected;
  const z = gap / stddev;
  return clamp(normalCDF(z));
}

export function playerPropProb({ currentStat, line, direction, elapsedSeconds, completed }) {
  if (currentStat === null || currentStat === undefined) return null;

  if (completed) {
    if (Math.abs(currentStat - line) < 0.5) return 0.5;
    return (direction === 'over') === (currentStat > line) ? 1 : 0;
  }

  if (elapsedSeconds < 120) return null;

  const timeLeft = TOTAL_SECS - elapsedSeconds;
  const paceProjected = (currentStat / elapsedSeconds) * TOTAL_SECS;
  const alpha = elapsedSeconds / TOTAL_SECS;
  // Prior for player props: the line itself (market is the best unbiased estimate)
  const projected = alpha * paceProjected + (1 - alpha) * line;

  const stddev = Math.sqrt(timeLeft / 60) * 2.5;
  const gap = direction === 'over' ? projected - line : line - projected;
  const z = gap / stddev;
  return clamp(normalCDF(z));
}

export function oddsImpliedProb(americanOdds) {
  if (!americanOdds) return 0.5;
  return americanToProb(americanOdds);
}

export function parlayProb(legs) {
  if (!legs.length) return 0;
  return legs.reduce((acc, leg) => {
    const p = leg.win_probability ?? oddsImpliedProb(leg.odds);
    return acc * p;
  }, 1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(p) {
  return Math.min(0.97, Math.max(0.03, p));
}

function normalCDF(z) {
  const a = 0.2316419;
  const b = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const t = 1 / (1 + a * Math.abs(z));
  const poly = t * (b[0] + t * (b[1] + t * (b[2] + t * (b[3] + t * b[4]))));
  const phi = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z);
  const cdf = 1 - phi * poly;
  return z >= 0 ? cdf : 1 - cdf;
}
