import { getPlayerPropOdds, PROP_MARKET_MAP } from '../../../../server/services/odds.js';

export default async function handler(req, res) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.json([]);
  const { eventId, prop_type } = req.query;
  const market = PROP_MARKET_MAP[prop_type];
  if (!market) return res.json([]);
  try {
    const data = await getPlayerPropOdds(apiKey, eventId, [market]);
    const bestBook = data?.bookmakers?.[0];
    const outcomes = bestBook?.markets?.find(m => m.key === market)?.outcomes ?? [];
    res.json(outcomes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
