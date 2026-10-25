export function americanToProb(odds) {
  if (!odds) return 0.5;
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

export function formatOdds(odds) {
  if (!odds) return '-';
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function parlayProb(legs) {
  if (!legs?.length) return 0;
  return legs.reduce((acc, leg) => {
    const p = leg.win_probability ?? americanToProb(leg.odds);
    return acc * p;
  }, 1);
}

export function impliedPayout(stake, americanOdds) {
  if (!stake || !americanOdds) return null;
  if (americanOdds > 0) return stake * (americanOdds / 100) + stake;
  return stake * (100 / Math.abs(americanOdds)) + stake;
}

// Convert stake + total payout → American odds
export function payoutToAmerican(stake, payout) {
  if (!stake || !payout || payout <= stake) return null;
  const ratio = (payout - stake) / stake;
  return ratio >= 1 ? Math.round(ratio * 100) : -Math.round(100 / ratio);
}

// Book's implied win probability: stake / payout
export function bookImpliedProb(stake, payout) {
  if (!stake || !payout || payout <= 0) return null;
  return stake / payout;
}

// Typical standard deviations for player prop stat types
const PROP_SIGMA = {
  receptions: 2.5,
  receiving_yards: 28,
  receiving_tds: 0.7,
  rushing_yards: 28,
  rushing_tds: 0.6,
  passing_yards: 55,
  passing_tds: 1.1,
  interceptions: 0.7,
};

// Inverse normal CDF approximation (Beasley-Springer-Moro)
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

/**
 * Derive the market's implied expected stat value from the line + odds.
 * e.g. over 5 rec at +140 → market expects ~4.4 catches, not 5.
 *
 * Formula: mu = line + sigma * Φ⁻¹(P(stat > line))
 */
export function impliedExpected(line, americanOdds, propType, direction = 'over') {
  if (!americanOdds || line == null) return line;
  const sigma = PROP_SIGMA[propType] ?? Math.max(1, line * 0.35);
  const rawProb = americanToProb(americanOdds);
  // rawProb is P(this side wins); convert to P(stat > line)
  const pOver = direction === 'over' ? rawProb : 1 - rawProb;
  return line + sigma * probit(pOver);
}
