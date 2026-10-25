import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function useRealtime() {
  const [parlays, setParlays] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchParlays = useCallback(async () => {
    const res = await fetch('/api/parlays');
    if (!res.ok) return;
    setParlays(await res.json());
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    fetchParlays();

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parlays' }, fetchParlays)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'legs' }, fetchParlays)
      .subscribe(status => setConnected(status === 'SUBSCRIBED'));

    return () => supabase.removeChannel(channel);
  }, [fetchParlays]);

  return { parlays, setParlays, connected, lastUpdated };
}
