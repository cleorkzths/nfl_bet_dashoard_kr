import { Router } from 'express';
import { getScoreboard, getGameSummary } from '../services/espn.js';
import { getPreGameOdds, getPlayerPropOdds, PROP_MARKET_MAP } from '../services/odds.js';

const router = Router();

router.get('/scoreboard', async (req, res) => {
  try {
    const games = await getScoreboard();
    res.json(games.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/summary', async (req, res) => {
  try {
    const summary = await getGameSummary(req.params.id);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/odds/pregame', async (req, res) => {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.json([]);
  try {
    const odds = await getPreGameOdds(apiKey);
    res.json(odds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch player prop odds for a specific Odds API event ID
// Returns flat array of outcomes: { name, description, price, point }
router.get('/odds/player-props/:eventId', async (req, res) => {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.json([]);
  const market = PROP_MARKET_MAP[req.query.prop_type];
  if (!market) return res.json([]);
  try {
    const data = await getPlayerPropOdds(apiKey, req.params.eventId, [market]);
    const bestBook = data?.bookmakers?.[0];
    const outcomes = bestBook?.markets?.find(m => m.key === market)?.outcomes ?? [];
    res.json(outcomes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
