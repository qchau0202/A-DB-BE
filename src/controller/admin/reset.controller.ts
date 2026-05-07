import { Request, Response, NextFunction } from 'express';
import { getMongoDb } from '../../config/mongodb';
import { supabase, supabaseAdmin } from '../../config/supabase';

/**
 * Reset all application data
 * Clears profiles, follows from Supabase and all collections from MongoDB
 * Auth users are preserved
 */
export const resetData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('[Admin] Data reset initiated');

    const results = {
      supabase: {
        profiles: 0,
        follows: 0,
      },
      mongodb: {} as Record<string, number>,
    };

    // 1. Clear Supabase tables
    const client = supabaseAdmin ?? supabase;

    // Delete follows
    const { data: followsData, error: followsError } = await client
      .from('follows')
      .delete()
      .select('id');

    if (followsError) {
      console.error('[Admin] Failed to delete follows:', followsError.message);
    } else {
      results.supabase.follows = followsData?.length || 0;
      console.log(`[Admin] Deleted ${results.supabase.follows} follows`);
    }

    // Delete profiles
    const { data: profilesData, error: profilesError } = await client
      .from('profiles')
      .delete()
      .select('id');

    if (profilesError) {
      console.error('[Admin] Failed to delete profiles:', profilesError.message);
    } else {
      results.supabase.profiles = profilesData?.length || 0;
      console.log(`[Admin] Deleted ${results.supabase.profiles} profiles`);
    }

    // 2. Clear MongoDB collections
    const db = getMongoDb();
    const collections = [
      'users',
      'posts',
      'quickies',
      'documents',
      'snippets',
      'comments',
      'likes',
      'bookmarks',
      'notifications',
      'connections',
    ];

    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({});
        results.mongodb[collectionName] = result.deletedCount || 0;
        console.log(`[Admin] ${collectionName}: ${result.deletedCount} deleted`);
      } catch (err) {
        console.log(`[Admin] ${collectionName}: collection may not exist`);
        results.mongodb[collectionName] = 0;
      }
    }

    console.log('[Admin] Data reset completed');

    res.status(200).json({
      success: true,
      message: 'All data has been reset successfully',
      results,
      note: 'Auth users were NOT deleted. Use Supabase Dashboard to manage auth users.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current data statistics
 */
export const getDataStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = supabaseAdmin ?? supabase;
    const db = getMongoDb();

    // Supabase counts
    const { count: profilesCount } = await client.from('profiles').select('*', { count: 'exact', head: true });
    const { count: followsCount } = await client.from('follows').select('*', { count: 'exact', head: true });

    // MongoDB counts
    const mongoStats: Record<string, number> = {};
    const collections = ['users', 'posts', 'quickies', 'documents', 'snippets', 'comments'];

    for (const name of collections) {
      try {
        mongoStats[name] = await db.collection(name).countDocuments();
      } catch {
        mongoStats[name] = 0;
      }
    }

    res.status(200).json({
      supabase: {
        profiles: profilesCount || 0,
        follows: followsCount || 0,
      },
      mongodb: mongoStats,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  resetData,
  getDataStats,
};
