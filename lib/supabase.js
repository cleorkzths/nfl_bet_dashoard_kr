import { createClient } from '@supabase/supabase-js';

// Server-side client — uses service role key (never exposed to browser)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
