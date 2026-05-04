import { supabase, supabaseAdmin } from '../../config/supabase';
import { randomUUID } from 'crypto';

type ProfilePayload = {
  username?: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  department_id?: number | null;
  user_id?: string | null;
};

export const createProfile = async (payload: ProfilePayload) => {
  const insert = {
    id: randomUUID(), // Generate unique profile ID
    user_id: payload.user_id, // FK to auth.users
    username: payload.username ?? null,
    display_name: payload.display_name ?? null,
    bio: payload.bio ?? null,
    avatar_url: payload.avatar_url ?? null,
    department_id: payload.department_id ?? null,
  } as Record<string, unknown>;

  // Use admin client to bypass RLS for server-side profile creation
  const client = supabaseAdmin ?? supabase;
  const { data, error } = await client.from('profiles').insert([insert]).select().maybeSingle();

  if (error) {
    throw new Error(`Failed to create profile: ${error.message}`);
  }

  return data ?? null;
};

export const getProfileById = async (id: string) => {
  const client = supabaseAdmin ?? supabase;
  const { data, error } = await client.from('profiles').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data ?? null;
};

export const getProfileByUserId = async (userId: string) => {
  const client = supabaseAdmin ?? supabase;
  const { data, error } = await client.from('profiles').select('*').eq('user_id', userId).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch profile by user_id: ${error.message}`);
  }

  return data ?? null;
};

export const updateProfileById = async (id: string, payload: ProfilePayload) => {
  const update = {
    ...payload,
    updated_at: new Date().toISOString(),
  } as Record<string, unknown>;

  // Use admin client to bypass RLS for server-side profile updates
  const client = supabaseAdmin ?? supabase;
  const { data, error } = await client.from('profiles').update(update).eq('id', id).select().maybeSingle();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return data ?? null;
};

export default {
  createProfile,
  getProfileById,
  getProfileByUserId,
  updateProfileById,
};
