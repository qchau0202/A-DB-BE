/* eslint-disable no-console */
import { connectMongo, closeMongo, getMongoDb } from '../config/mongodb';
import { supabase, supabaseAdmin } from '../config/supabase';

/**
 * Reset all application data while keeping auth.users intact
 * This clears:
 * - Supabase: profiles, follows tables
 * - MongoDB: all collections (users, posts, quickies, documents, snippets, comments, etc.)
 */
async function resetData() {
  console.log('=== Starting Data Reset ===\n');

  try {
    // 1. Connect to MongoDB
    console.log('[1/4] Connecting to MongoDB...');
    await connectMongo();
    const mongoDb = getMongoDb();
    console.log('✓ MongoDB connected\n');

    // 2. Clear Supabase tables (profiles, follows)
    console.log('[2/4] Clearing Supabase tables...');
    const client = supabaseAdmin ?? supabase;

    // Delete all follows first (to avoid FK constraints if any)
    const { error: followsError } = await client.from('follows').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (followsError) {
      console.error('✗ Failed to delete follows:', followsError.message);
    } else {
      console.log('✓ All follows deleted');
    }

    // Delete all profiles
    const { error: profilesError } = await client.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (profilesError) {
      console.error('✗ Failed to delete profiles:', profilesError.message);
    } else {
      console.log('✓ All profiles deleted');
    }

    console.log('');

    // 3. Clear MongoDB collections
    console.log('[3/4] Clearing MongoDB collections...');

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
        const collection = mongoDb.collection(collectionName);
        const result = await collection.deleteMany({});
        console.log(`✓ ${collectionName}: ${result.deletedCount} documents deleted`);
      } catch (err) {
        console.log(`- ${collectionName}: Collection may not exist (skipped)`);
      }
    }

    console.log('');

    // 4. Disconnect
    console.log('[4/4] Disconnecting from MongoDB...');
    await closeMongo();
    console.log('✓ MongoDB disconnected\n');

    console.log('=== Data Reset Complete ===');
    console.log('\nNote: Auth users (auth.users table) were NOT deleted.');
    console.log('To delete auth users, use Supabase Dashboard or the Admin API.');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Reset failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  resetData();
}

export default resetData;
