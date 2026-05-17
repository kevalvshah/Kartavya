/**
 * supabase.js — single shared Supabase client for the frontend.
 *
 * Uses the PUBLIC anon key only — safe to ship in browser bundles.
 * The anon key gives read access gated by Supabase RLS policies.
 *
 * Env vars (add to Vercel dashboard):
 *   REACT_APP_SUPABASE_URL
 *   REACT_APP_SUPABASE_ANON_KEY
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnon = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.warn(
    '[Kartavya] Supabase env vars missing. '
    + 'Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in Vercel.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnon || '', {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
