import { getScoreboard } from '../../server/services/espn.js';

export default async function handler(req, res) {
  try {
    const games = await getScoreboard();
    res.json(games.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
