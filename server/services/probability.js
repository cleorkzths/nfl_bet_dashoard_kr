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

export function playerPropProb({ currentStat, line, direction, elapsedSeconds, completed, odds, propType }) {
  if (currentStat === null || currentStat === undefined) return null;

  if (completed) {
    if (Math.abs(currentStat - line) < 0.5) return 0.5;
    return (direction === 'over') === (currentStat > line) ? 1 : 0;
  }

  if (elapsedSeconds < 120) return null;

  const timeLeft = TOTAL_SECS - elapsedSeconds;
  const paceProjected = (currentStat / elapsedSeconds) * TOTAL_SECS;
  const alpha = elapsedSeconds / TOTAL_SECS;
  // Use odds-derived prior so alt lines don't masquerade as the true expectation.
  // e.g. over 5 rec at +140 implies expected ~4.4, not 5.
  const prior = impliedExpected(line, odds, propType, direction);
  const projected = alpha * paceProjected + (1 - alpha) * prior;

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

const PROP_SIGMA = {
  receptions: 2.5, receiving_yards: 28, receiving_tds: 0.7,
  rushing_yards: 28, rushing_tds: 0.6,
  passing_yards: 55, passing_tds: 1.1, interceptions: 0.7,
};

function probit(p) {
  if (p <= 0.001) return -3.1;
  if (p >= 0.999) return 3.1;
  const pp = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(pp));
  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];
  const x = t - (c[0] + c[1] * t + c[2] * t * t) / (1 + d[0] * t + d[1] * t * t + d[2] * t * t * t);
  return p < 0.5 ? -x : x;
}

function impliedExpected(line, americanOdds, propType, direction = 'over') {
  if (!americanOdds || line == null) return line;
  const sigma = PROP_SIGMA[propType] ?? Math.max(1, line * 0.35);
  const rawProb = americanToProb(americanOdds);
  const pOver = direction === 'over' ? rawProb : 1 - rawProb;
  return line + sigma * probit(pOver);
}

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
