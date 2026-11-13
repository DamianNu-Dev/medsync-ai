import { createClient } from '@supabase/supabase-js';

let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return _supabase;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

export async function supabaseQuery(fn) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase no está configurado');
  return fn(client);
}

export { getSupabase as supabase };
