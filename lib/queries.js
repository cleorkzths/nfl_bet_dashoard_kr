import { supabase } from './supabase.js';

function sortLegs(parlay) {
  return { ...parlay, legs: (parlay.legs ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)) };
}

export async function getAllParlays() {
  const { data, error } = await supabase
    .from('parlays')
    .select('*, legs(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(sortLegs);
}

export async function getParlayById(id) {
  const { data, error } = await supabase
    .from('parlays')
    .select('*, legs(*)')
    .eq('id', id)
    .single();
  if (error) return null;
  return sortLegs(data);
}

export async function createParlay({ id, name, stake, odds, payout, status, game_date }) {
  const { error } = await supabase.from('parlays').insert({
    id, name,
    stake: stake ?? null,
    odds: odds ?? null,
    payout: payout ?? null,
    status: status ?? 'pending',
    game_date: game_date ?? null,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  return getParlayById(id);
}

export async function updateParlay(id, { name, stake, odds, payout, game_date }) {
  const { error } = await supabase
    .from('parlays')
    .update({ name, stake: stake ?? null, odds: odds ?? null, payout: payout ?? null, game_date: game_date ?? null })
    .eq('id', id);
  if (error) throw error;
}

export async function updateParlayStatus(id, status) {
  const { error } = await supabase.from('parlays').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteParlay(id) {
  const { error } = await supabase.from('parlays').delete().eq('id', id);
  if (error) throw error;
}

export async function createLeg({ id, parlay_id, type, description, team, opponent, line, direction, odds, player_name, prop_type, game_id, game_date }) {
  const { error } = await supabase.from('legs').insert({
    id, parlay_id, type, description,
    team: team ?? null, opponent: opponent ?? null, line: line ?? null,
    direction: direction ?? null, odds: odds ?? null,
    player_name: player_name ?? null, prop_type: prop_type ?? null,
    game_id: game_id ?? null, game_date: game_date ?? null,
    status: 'pending', current_value: null, win_probability: null,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function replaceLegs(parlay_id, newLegs) {
  const { error: delError } = await supabase.from('legs').delete().eq('parlay_id', parlay_id);
  if (delError) throw delError;
  if (newLegs.length) {
    const { error } = await supabase.from('legs').insert(newLegs);
    if (error) throw error;
  }
}

export async function updateLeg(id, { status, current_value, win_probability }) {
  const { error } = await supabase
    .from('legs')
    .update({ status, current_value: current_value ?? null, win_probability: win_probability ?? null })
    .eq('id', id);
  if (error) throw error;
}

export async function getActiveLegs() {
  const { data: activeParlays } = await supabase
    .from('parlays')
    .select('id')
    .in('status', ['pending', 'active']);
  if (!activeParlays?.length) return [];
  const ids = activeParlays.map(p => p.id);
  const { data: legs } = await supabase
    .from('legs')
    .select('*')
    .in('parlay_id', ids)
    .not('game_id', 'is', null);
  return legs ?? [];
}
