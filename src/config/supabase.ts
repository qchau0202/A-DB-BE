import { createClient } from '@supabase/supabase-js';
import { env } from './env';

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  console.warn('Supabase configuration is incomplete. Check SUPABASE_URL/SUPABASE_API_URL and SUPABASE_ANON_KEY.');
}

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Admin client with service role key - bypasses RLS for server-side operations
export const supabaseAdmin = env.supabaseServiceRoleKey
  ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
