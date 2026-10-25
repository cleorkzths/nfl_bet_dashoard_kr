import fetch from 'node-fetch';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

const STAT_KEYS = {
  passing: ['completions/passingAttempts', 'passingYards', 'yardsPerPassAttempt', 'passingTouchdowns', 'interceptions', 'sacks/sackYardsLost', 'adjQBR', 'QBRating'],
  rushing: ['rushingAttempts', 'rushingYards', 'yardsPerRushAttempt', 'rushingTouchdowns', 'longRushing'],
  receiving: ['receptions', 'receivingYards', 'yardsPerReception', 'receivingTouchdowns', 'longReception', 'receivingTargets'],
  kicking: ['fieldGoalsMade/fieldGoalAttempts', 'longFieldGoalMade', 'extraPointsMade/extraPointAttempts', 'totalKickingPoints'],
  defense: ['totalTackles', 'sacks', 'tacklesForLoss', 'interceptions', 'passDeflections', 'QBHurries', 'fumbles', 'defensiveTouchdowns'],
};

const PROP_TO_STAT = {
  passing_yards: { cat: 'passing', key: 'passingYards' },
  passing_tds: { cat: 'passing', key: 'passingTouchdowns' },
  interceptions: { cat: 'passing', key: 'interceptions' },
  rushing_yards: { cat: 'rushing', key: 'rushingYards' },
  rushing_tds: { cat: 'rushing', key: 'rushingTouchdowns' },
  receiving_yards: { cat: 'receiving', key: 'receivingYards' },
  receptions: { cat: 'receiving', key: 'receptions' },
  receiving_tds: { cat: 'receiving', key: 'receivingTouchdowns' },
  receiving_targets: { cat: 'receiving', key: 'receivingTargets' },
};

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status} ${url}`);
  return res.json();
}

export async function getScoreboard() {
  const data = await fetchJson(`${BASE}/scoreboard`);
  return (data.events ?? []).map(normalizeEvent).filter(Boolean);
}

export async function getGameSummary(gameId) {
  const data = await fetchJson(`${BASE}/summary?event=${gameId}`);
  return parseGameSummary(data);
}

function normalizeEvent(event) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find(c => c.homeAway === 'home');
  const away = comp.competitors?.find(c => c.homeAway === 'away');
  const status = comp.status;

  return {
    id: event.id,
    name: event.name,
    shortName: event.shortName,
    date: event.date,
    state: status?.type?.state ?? 'pre',
    statusText: status?.type?.shortDetail ?? '',
    period: status?.period ?? 0,
    clock: status?.displayClock ?? '',
    completed: status?.type?.completed ?? false,
    home: {
      id: home?.id,
      abbr: home?.team?.abbreviation,
      name: home?.team?.displayName,
      score: parseInt(home?.score ?? '0', 10),
    },
    away: {
      id: away?.id,
      abbr: away?.team?.abbreviation,
      name: away?.team?.displayName,
      score: parseInt(away?.score ?? '0', 10),
    },
  };
}

function parseGameSummary(data) {
  const comp = data.header?.competitions?.[0];
  const home = comp?.competitors?.find(c => c.homeAway === 'home');
  const away = comp?.competitors?.find(c => c.homeAway === 'away');

  const homeScore = parseInt(home?.score ?? '0', 10);
  const awayScore = parseInt(away?.score ?? '0', 10);
  const homeAbbr = home?.team?.abbreviation ?? '';
  const awayAbbr = away?.team?.abbreviation ?? '';

  // Win probability — last entry is most recent
  const wpArr = data.winProbability ?? [];
  const latestWP = wpArr.length ? wpArr[wpArr.length - 1] : null;
  const homeWinPct = latestWP?.homeWinPercentage ?? null;

  // Player stats
  const playerStats = {};
  for (const teamBlock of (data.boxscore?.players ?? [])) {
    const teamAbbr = teamBlock.team?.abbreviation;
    for (const statGroup of (teamBlock.statistics ?? [])) {
      const catName = statGroup.name;
      const keys = STAT_KEYS[catName] ?? [];
      for (const row of (statGroup.athletes ?? [])) {
        const name = row.athlete?.displayName;
        if (!name) continue;
        if (!playerStats[name]) playerStats[name] = { team: teamAbbr };
        (row.stats ?? []).forEach((val, i) => {
          if (keys[i]) playerStats[name][keys[i]] = val;
        });
      }
    }
  }

  const status = comp?.status;
  const period = status?.period ?? 0;
  const clock = status?.displayClock ?? '15:00';
  const elapsedSeconds = calcElapsedSeconds(period, clock);

  return {
    homeScore,
    awayScore,
    homeAbbr,
    awayAbbr,
    homeWinPct,
    awayWinPct: homeWinPct !== null ? 1 - homeWinPct : null,
    elapsedSeconds,
    playerStats,
    completed: status?.type?.completed ?? false,
    period,
    clock,
  };
}

function calcElapsedSeconds(period, clock) {
  if (period === 0) return 0;
  const parts = clock.split(':').map(Number);
  const secsLeft = (parts[0] ?? 15) * 60 + (parts[1] ?? 0);
  return (period - 1) * 900 + (900 - secsLeft);
}

export function getPlayerStat(playerStats, playerName, propType) {
  if (!playerName || !propType) return null;
  const mapping = PROP_TO_STAT[propType];
  if (!mapping) return null;

  const nameLower = playerName.toLowerCase().trim();
  const lastName = nameLower.split(' ').pop();

  const match = Object.entries(playerStats).find(([name]) => {
    const n = name.toLowerCase();
    return n === nameLower || n.includes(nameLower) || n.endsWith(lastName);
  });

  if (!match) return null;
  const raw = match[1][mapping.key];
  return raw !== undefined ? parseFloat(raw) : null;
}

export { PROP_TO_STAT };
