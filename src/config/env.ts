import dotenv from 'dotenv';

dotenv.config();

const normalizeSupabaseUrl = (value: string | undefined): string => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();

  // Accept both project URL and PostgREST URL forms.
  return trimmed.replace(/\/rest\/v1\/?$/, '');
};

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toNumber(process.env.PORT, 3000),
  supabaseUrl: normalizeSupabaseUrl(process.env.SUPABASE_URL ?? process.env.SUPABASE_API_URL),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  mongodbUri: process.env.MONGODB_URI ?? '',
  mongodbDbName: process.env.MONGODB_DB_NAME ?? 'devconnect',
};
