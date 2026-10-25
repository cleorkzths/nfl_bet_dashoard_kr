import React, { useState } from 'react';
import ParlayCard from './ParlayCard.jsx';
import AddParlayModal from './AddParlayModal.jsx';
import { useGameScores } from '../hooks/useGameScores.js';

const FILTER_OPTIONS = ['all', 'active', 'pending', 'won', 'lost'];

export default function Dashboard({ parlays, setParlays, connected, lastUpdated }) {
  const [showModal, setShowModal] = useState(false);
  const [editingParlay, setEditingParlay] = useState(null);
  const [filter, setFilter] = useState('all');
  const gameScores = useGameScores();

  const filtered = parlays.filter(p =>
    filter === 'all' ? true : p.status === filter || (filter === 'active' && p.status === 'pending')
  );

  async function handleDelete(id) {
    if (!confirm('Delete this parlay?')) return;
    await fetch(`/api/parlays/${id}`, { method: 'DELETE' });
    setParlays(prev => prev.filter(p => p.id !== id));
  }

  function handleSave(parlay) {
    setParlays(prev => [parlay, ...prev]);
    setShowModal(false);
  }

  function handleUpdate(parlay) {
    setParlays(prev => prev.map(p => p.id === parlay.id ? parlay : p));
    setEditingParlay(null);
  }

  const activeParlays = parlays.filter(p => ['active', 'winning', 'losing'].includes(p.status));
  const wonCount = parlays.filter(p => p.status === 'won').length;
  const lostCount = parlays.filter(p => p.status === 'lost').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xl">🏈</span>
            <h1 className="text-base font-bold tracking-tight">NFL Parlay Tracker</h1>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1"
          >
            <span className="text-base leading-none">+</span> New Parlay
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {parlays.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <StatBox label="Active" value={activeParlays.length} color="text-emerald-400" />
            <StatBox label="Won" value={wonCount} color="text-green-400" />
            <StatBox label="Lost" value={lostCount} color="text-red-400" />
          </div>
        )}

        {parlays.length > 0 && (
          <div className="flex gap-1 bg-gray-900 p-1 rounded-lg">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-xs py-1.5 rounded-md font-medium capitalize transition-colors ${
                  filter === f ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {lastUpdated && (
          <p className="text-xs text-gray-600 text-right -mt-2">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-5xl">🏈</p>
            <p className="text-gray-400 text-lg font-medium">
              {parlays.length === 0 ? "No parlays yet" : `No ${filter} parlays`}
            </p>
            {parlays.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 text-sm text-emerald-400 hover:text-emerald-300 underline"
              >
                Add your first parlay
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(parlay => (
              <ParlayCard
                key={parlay.id}
                parlay={parlay}
                gameScores={gameScores}
                onDelete={handleDelete}
                onEdit={setEditingParlay}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <AddParlayModal onClose={() => setShowModal(false)} onSave={handleSave} />
      )}
      {editingParlay && (
        <AddParlayModal onClose={() => setEditingParlay(null)} onSave={handleUpdate} initialParlay={editingParlay} />
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}
