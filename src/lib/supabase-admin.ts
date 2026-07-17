import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase com service-role — SOMENTE no servidor.
 * A service-role key contorna o RLS, permitindo gravar diagnósticos sem login.
 * Nunca importar este arquivo em código client-side.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function hasSupabaseAdmin(): boolean {
  return Boolean(url && serviceKey);
}

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!hasSupabaseAdmin()) return null;
  if (!cached) {
    cached = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
