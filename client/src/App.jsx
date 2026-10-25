import React from 'react';
import Dashboard from './components/Dashboard.jsx';
import { useRealtime } from './hooks/useRealtime.js';

export default function App() {
  const { connected, parlays, setParlays, lastUpdated } = useRealtime();

  return (
    <Dashboard
      parlays={parlays}
      setParlays={setParlays}
      connected={connected}
      lastUpdated={lastUpdated}
    />
  );
}
