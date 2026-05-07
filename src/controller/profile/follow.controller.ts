import { supabase, supabaseAdmin } from '../../config/supabase';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateUUID = (id: string): boolean => UUID_REGEX.test(id);

export const followUser = async (followerId: string, followingId: string) => {
  if (followerId === followingId) {
    throw new Error('Cannot follow yourself');
  }

  const insert = {
    follower_id: followerId,
    following_id: followingId,
  };

  const client = supabaseAdmin ?? supabase;
  const { data, error } = await client
    .from('follows')
    .insert([insert])
    .select()
    .maybeSingle();

  if (error) {
    if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
      throw new Error('Already following this user');
    }
    throw new Error(`Failed to follow user: ${error.message}`);
  }

  return data ?? null;
};

export const unfollowUser = async (followerId: string, followingId: string) => {
  const client = supabaseAdmin ?? supabase;
  const { data, error } = await client
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to unfollow user: ${error.message}`);
  }

  return data ?? null;
};

export const getFollowers = async (userId: string) => {
  if (!validateUUID(userId)) {
    return [];
  }
  
  const client = supabaseAdmin ?? supabase;
  const { data, error } = await client
    .from('follows')
    .select('*')
    .eq('following_id', userId);

  if (error) {
    throw new Error(`Failed to get followers: ${error.message}`);
  }

  return data ?? [];
};

export const getFollowing = async (userId: string) => {
  if (!validateUUID(userId)) {
    return [];
  }
  
  const client = supabaseAdmin ?? supabase;
  const { data, error } = await client
    .from('follows')
    .select('*')
    .eq('follower_id', userId);

  if (error) {
    throw new Error(`Failed to get following: ${error.message}`);
  }

  return data ?? [];
};

export const isFollowing = async (followerId: string, followingId: string) => {
  if (!validateUUID(followerId) || !validateUUID(followingId)) {
    return false;
  }
  
  const client = supabaseAdmin ?? supabase;
  const { data, error } = await client
    .from('follows')
    .select('*')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check follow status: ${error.message}`);
  }

  return !!data;
};

export default {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  isFollowing,
};
