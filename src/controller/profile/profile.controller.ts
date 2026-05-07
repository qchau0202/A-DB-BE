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

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getProfileByUserId = async (userId: string) => {
  // Validate UUID format to prevent database errors
  if (!UUID_REGEX.test(userId)) {
    return null;
  }
  
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

  // Also sync to MongoDB for polyglot persistence
  if (data && data.user_id) {
    try {
      const { updateMongoUser } = await import('../users/user.controller');
      await updateMongoUser(data.user_id as string, {
        ...(payload.username && { username: payload.username }),
        ...(payload.display_name && { name: payload.display_name }),
        ...(payload.bio && { bio: payload.bio }),
        ...(payload.avatar_url && { avatar_url: payload.avatar_url }),
      });
      console.log(`[Profile] MongoDB user synced for user_id: ${data.user_id}`);
    } catch (mongoErr) {
      // Log but don't fail - profile update should still work even if MongoDB is down
      console.error('[Profile] MongoDB sync failed:', mongoErr);
    }
  }

  return data ?? null;
};

export default {
  createProfile,
  getProfileById,
  getProfileByUserId,
  updateProfileById,
};
