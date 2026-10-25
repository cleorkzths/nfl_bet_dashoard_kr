import { getPreGameOdds } from '../../../server/services/odds.js';

export default async function handler(req, res) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.json([]);
  try {
    res.json(await getPreGameOdds(apiKey));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
