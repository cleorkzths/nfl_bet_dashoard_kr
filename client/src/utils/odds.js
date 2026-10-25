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
