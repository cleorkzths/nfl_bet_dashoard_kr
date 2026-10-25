import { getParlayById, updateParlay, replaceLegs, deleteParlay } from '../../lib/queries.js';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const parlay = await getParlayById(id);
    if (!parlay) return res.status(404).json({ error: 'Not found' });
    return res.json(parlay);
  }

  if (req.method === 'PUT') {
    const parlay = await getParlayById(id);
    if (!parlay) return res.status(404).json({ error: 'Not found' });

    const { name, stake, odds: rawOdds, payout: rawPayout, game_date, legs = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    let odds = rawOdds ?? null;
    let payout = rawPayout ?? null;
    if (stake && odds && !payout) {
      payout = odds > 0 ? stake * (odds / 100) + stake : stake * (100 / Math.abs(odds)) + stake;
    } else if (stake && payout && !odds) {
      const ratio = (payout - stake) / stake;
      odds = ratio >= 1 ? Math.round(ratio * 100) : -Math.round(100 / ratio);
    }

    await updateParlay(id, { name, stake, odds, payout, game_date });
    const newLegs = legs.map(l => ({
      id: uuidv4(), parlay_id: id,
      type: l.type, description: l.description,
      team: l.team ?? null, opponent: l.opponent ?? null,
      line: l.line ?? null, direction: l.direction ?? null,
      odds: l.odds ?? null, player_name: l.player_name ?? null,
      prop_type: l.prop_type ?? null, game_id: l.game_id ?? null,
      game_date: l.game_date ?? game_date ?? null,
      status: 'pending', current_value: null, win_probability: null,
      created_at: new Date().toISOString(),
    }));
    await replaceLegs(id, newLegs);
    return res.json(await getParlayById(id));
  }

  if (req.method === 'DELETE') {
    const parlay = await getParlayById(id);
    if (!parlay) return res.status(404).json({ error: 'Not found' });
    await deleteParlay(id);
    return res.json({ success: true });
  }

  res.status(405).end();
}
