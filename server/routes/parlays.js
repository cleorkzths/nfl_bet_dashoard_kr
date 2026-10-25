import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAllParlays, getParlayById, createParlay, updateParlay, replaceLegs, deleteParlay, createLeg } from '../db/queries.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await getAllParlays());
});

router.get('/:id', async (req, res) => {
  const parlay = await getParlayById(req.params.id);
  if (!parlay) return res.status(404).json({ error: 'Not found' });
  res.json(parlay);
});

router.post('/', async (req, res) => {
  const { name, stake, odds: rawOdds, payout: rawPayout, game_date, legs = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const parlayId = uuidv4();
  // Use whatever the client sends; derive the missing one if possible
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

  res.status(201).json(await getParlayById(parlayId));
});

router.put('/:id', async (req, res) => {
  const parlay = await getParlayById(req.params.id);
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

  await updateParlay(req.params.id, { name, stake, odds, payout, game_date });
  const newLegs = legs.map(l => ({
    id: uuidv4(), parlay_id: req.params.id,
    type: l.type, description: l.description, team: l.team ?? null,
    opponent: l.opponent ?? null, line: l.line ?? null, direction: l.direction ?? null,
    odds: l.odds ?? null, player_name: l.player_name ?? null, prop_type: l.prop_type ?? null,
    game_id: l.game_id ?? null, game_date: l.game_date ?? game_date ?? null,
    status: 'pending', current_value: null, win_probability: null,
    created_at: new Date().toISOString(),
  }));
  await replaceLegs(req.params.id, newLegs);

  res.json(await getParlayById(req.params.id));
});

router.delete('/:id', async (req, res) => {
  const parlay = await getParlayById(req.params.id);
  if (!parlay) return res.status(404).json({ error: 'Not found' });
  await deleteParlay(req.params.id);
  res.json({ success: true });
});

export default router;
