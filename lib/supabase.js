import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getSupabase() {
  if (!_client) {
    if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL not set');
    _client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return _client;
}

// Convenience alias — only call after dotenv has loaded
export const supabase = new Proxy({}, {
  get(_, prop) { return getSupabase()[prop]; },
});
