import { getAllParlays, getParlayById, createParlay, createLeg } from '../../lib/queries.js';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json(await getAllParlays());
  }

  if (req.method === 'POST') {
    const { name, stake, odds: rawOdds, payout: rawPayout, game_date, legs = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const parlayId = uuidv4();
    let odds = rawOdds ?? null;
    let payout = rawPayout ?? null;
    if (stake && odds && !payout) {
      payout = odds > 0 ? stake * (odds / 100) + stake : stake * (100 / Math.abs(odds)) + stake;
    } else if (stake && payout && !odds) {
      const ratio = (payout - stake) / stake;
      odds = ratio >= 1 ? Math.round(ratio * 100) : -Math.round(100 / ratio);
    }

    await createParlay({ id: parlayId, name, stake, odds, payout, status: 'pending', game_date });
    for (const leg of legs) {
      await createLeg({ ...leg, id: uuidv4(), parlay_id: parlayId });
    }
    return res.status(201).json(await getParlayById(parlayId));
  }

  res.status(405).end();
}
