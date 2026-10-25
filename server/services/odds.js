import fetch from 'node-fetch';

const BASE = 'https://api.the-odds-api.com/v4';

export async function getPreGameOdds(apiKey, sport = 'americanfootball_nfl') {
  if (!apiKey) return [];
  const url = `${BASE}/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`Odds API error: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data.map(normalizeOddsEvent);
}

export async function getPlayerPropOdds(apiKey, eventId, markets) {
  if (!apiKey || !eventId) return null;
  const marketStr = markets.join(',');
  const url = `${BASE}/sports/americanfootball_nfl/events/${eventId}/odds?apiKey=${apiKey}&regions=us&markets=${marketStr}&oddsFormat=american`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

// Map our prop_type values to Odds API market keys
export const PROP_MARKET_MAP = {
  passing_yards:    'player_pass_yds',
  passing_tds:      'player_pass_tds',
  interceptions:    'player_pass_interceptions',
  rushing_yards:    'player_rush_yds',
  rushing_tds:      'player_rush_tds',
  receiving_yards:  'player_reception_yds',
  receptions:       'player_receptions',
  receiving_tds:    'player_reception_tds',
  receiving_targets:'player_reception_tds', // closest available
};

function dedupeByNamePoint(outcomes) {
  const seen = new Set();
  return outcomes.filter(o => {
    const key = `${o.name}-${o.point}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeOddsEvent(event) {
  const bestBook = event.bookmakers?.[0];
  const get = key => bestBook?.markets?.find(m => m.key === key)?.outcomes ?? [];

  return {
    id: event.id,
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    commenceTime: event.commence_time,
    h2h: get('h2h'),
    spreads: get('spreads'),
    totals:  get('totals'),
  };
}

export function americanToProb(odds) {
  if (odds === null || odds === undefined) return 0.5;
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

export function probToAmerican(prob) {
  if (prob >= 1) return -99999;
  if (prob <= 0) return 99999;
  if (prob >= 0.5) return -Math.round((prob / (1 - prob)) * 100);
  return Math.round(((1 - prob) / prob) * 100);
}
