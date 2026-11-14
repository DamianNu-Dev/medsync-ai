import { createClient } from '@supabase/supabase-js';

let _supabase = null;

/** Limpia valores vacíos o placeholders de ejemplo (`TU_...`, `<...>`). */
function clean(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^(tu_|your_|copia_|<)/i.test(text)) return '';
  return text;
}

function projectUrl() {
  return clean(process.env.SUPABASE_URL).replace(/\/+$/, '');
}

/**
 * El backend es el único que habla con Supabase, así que usa la clave de
 * servicio (service_role) si está disponible: evita que las políticas RLS
 * bloqueen las consultas del servidor. Si no existe, cae a la clave anónima.
 */
function serverKey() {
  return clean(process.env.SUPABASE_SERVICE_ROLE_KEY) || clean(process.env.SUPABASE_ANON_KEY);
}

function getSupabase() {
  if (_supabase) return _supabase;
  const url = projectUrl();
  const key = serverKey();
  if (!url || !key) return null;
  _supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-application-name': 'medsync-ai-backend' },
    },
  });
  return _supabase;
}

export function isSupabaseConfigured() {
  return Boolean(projectUrl() && serverKey());
}

/** true si el servidor está usando la clave de servicio. */
export function usingServiceRole() {
  return Boolean(clean(process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export async function supabaseQuery(fn) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase no está configurado');
  return fn(client);
}

export { getSupabase as supabase };
