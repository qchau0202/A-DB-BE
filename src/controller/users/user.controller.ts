import { getMongoDb } from '../../config/mongodb';
import { ObjectId } from 'mongodb';

export interface MongoUser {
  _id?: string;
  supabase_id: string;
  email: string;
  username: string;
  name: string;
  bio?: string;
  avatar_url?: string;
  role?: string;
  created_at: Date;
  updated_at: Date;
}

const getUsersCollection = () => {
  const db = getMongoDb();
  return db.collection<MongoUser>('users');
};

/**
 * Create a new user in MongoDB when user signs up via Supabase
 */
export const createMongoUser = async (userData: {
  supabase_id: string;
  email: string;
  username: string;
  name: string;
  bio?: string;
  avatar_url?: string;
  role?: string;
}): Promise<MongoUser> => {
  const collection = getUsersCollection();

  const now = new Date();
  const newUser: MongoUser = {
    _id: userData.supabase_id, // Use Supabase UUID as MongoDB _id for consistency
    supabase_id: userData.supabase_id,
    email: userData.email,
    username: userData.username,
    name: userData.name,
    bio: userData.bio || '',
    avatar_url: userData.avatar_url || '',
    role: userData.role || 'user',
    created_at: now,
    updated_at: now,
  };

  const result = await collection.insertOne(newUser);

  if (!result.acknowledged) {
    throw new Error('Failed to create user in MongoDB');
  }

  return newUser;
};

/**
 * Get user by Supabase ID
 */
export const getMongoUserBySupabaseId = async (supabaseId: string): Promise<MongoUser | null> => {
  const collection = getUsersCollection();
  return await collection.findOne({ supabase_id: supabaseId });
};

/**
 * Get user by ID (MongoDB _id which equals supabase_id)
 */
export const getMongoUserById = async (id: string): Promise<MongoUser | null> => {
  const collection = getUsersCollection();
  return await collection.findOne({ _id: id });
};

/**
 * Get user by email
 */
export const getMongoUserByEmail = async (email: string): Promise<MongoUser | null> => {
  const collection = getUsersCollection();
  return await collection.findOne({ email });
};

/**
 * Get user by username
 */
export const getMongoUserByUsername = async (username: string): Promise<MongoUser | null> => {
  const collection = getUsersCollection();
  return await collection.findOne({ username });
};

/**
 * Update MongoDB user
 */
export const updateMongoUser = async (
  supabaseId: string,
  updates: Partial<Omit<MongoUser, '_id' | 'supabase_id' | 'created_at'>>
): Promise<MongoUser | null> => {
  const collection = getUsersCollection();

  const updateData = {
    ...updates,
    updated_at: new Date(),
  };

  const result = await collection.findOneAndUpdate(
    { supabase_id: supabaseId },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  return result;
};

/**
 * Delete MongoDB user (when user is deleted from Supabase)
 */
export const deleteMongoUser = async (supabaseId: string): Promise<boolean> => {
  const collection = getUsersCollection();
  const result = await collection.deleteOne({ supabase_id: supabaseId });
  return result.deletedCount === 1;
};

/**
 * Get all users with optional pagination
 */
export const getAllMongoUsers = async (
  limit: number = 50,
  skip: number = 0
): Promise<{ users: MongoUser[]; total: number }> => {
  const collection = getUsersCollection();

  const [users, total] = await Promise.all([
    collection.find().sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(),
  ]);

  return { users, total };
};

/**
 * Sync user from Supabase to MongoDB
 * This creates the user if they don't exist, or updates if they do
 */
export const syncUserToMongo = async (userData: {
  supabase_id: string;
  email: string;
  username?: string;
  name?: string;
  bio?: string;
  avatar_url?: string;
}): Promise<MongoUser> => {
  const collection = getUsersCollection();

  // Check if user already exists
  const existingUser = await getMongoUserBySupabaseId(userData.supabase_id);

  if (existingUser) {
    // Update existing user
    const updateData: Partial<MongoUser> = {
      updated_at: new Date(),
    };

    if (userData.email) updateData.email = userData.email;
    if (userData.username) updateData.username = userData.username;
    if (userData.name) updateData.name = userData.name;
    if (userData.bio !== undefined) updateData.bio = userData.bio;
    if (userData.avatar_url !== undefined) updateData.avatar_url = userData.avatar_url;

    await collection.updateOne(
      { supabase_id: userData.supabase_id },
      { $set: updateData }
    );

    return { ...existingUser, ...updateData };
  }

  // Create new user
  const username = userData.username || userData.email.split('@')[0] || 'user';
  const name = userData.name || userData.email.split('@')[0] || 'User';

  return await createMongoUser({
    supabase_id: userData.supabase_id,
    email: userData.email,
    username,
    name,
    ...(userData.bio && { bio: userData.bio }),
    ...(userData.avatar_url && { avatar_url: userData.avatar_url }),
  });
};

export default {
  createMongoUser,
  getMongoUserBySupabaseId,
  getMongoUserById,
  getMongoUserByEmail,
  getMongoUserByUsername,
  updateMongoUser,
  deleteMongoUser,
  getAllMongoUsers,
  syncUserToMongo,
};
