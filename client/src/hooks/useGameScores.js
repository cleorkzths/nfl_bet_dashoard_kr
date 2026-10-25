import { useEffect, useState } from 'react';

export function useGameScores() {
  const [games, setGames] = useState({});

  useEffect(() => {
    async function fetchScores() {
      try {
        const res = await fetch('/api/games/scoreboard');
        if (!res.ok) return;
        const list = await res.json();
        const map = {};
        for (const g of list) map[g.id] = g;
        setGames(map);
      } catch { /* ignore */ }
    }

    fetchScores();
    const id = setInterval(fetchScores, 30_000);
    return () => clearInterval(id);
  }, []);

  return games;
}

// Shared helper: seconds elapsed from period + clock string
export function calcElapsed(period, clock) {
  if (!period) return 0;
  const parts = (clock ?? '15:00').split(':').map(Number);
  const secsLeft = (parts[0] ?? 15) * 60 + (parts[1] ?? 0);
  return (period - 1) * 900 + (900 - secsLeft);
}

// Bayesian projected total (mirrors server logic for display purposes)
export function projectedTotal(combined, elapsedSeconds, line) {
  if (!elapsedSeconds || elapsedSeconds < 60) return null;
  const paceProjected = (combined / elapsedSeconds) * 3600;
  const alpha = elapsedSeconds / 3600;
  return alpha * paceProjected + (1 - alpha) * line;
}
