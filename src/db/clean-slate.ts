/* eslint-disable no-console */
import { connectMongo, closeMongo, getMongoDb } from '../config/mongodb';
import { supabase, supabaseAdmin } from '../config/supabase';

/**
 * COMPLETE CLEAN SLATE - Delete everything including auth users
 * WARNING: This deletes ALL data including auth.users!
 * Use with extreme caution - only for complete reset.
 */
async function cleanSlate() {
  console.log('⚠️  === COMPLETE CLEAN SLATE === ⚠️\n');
  console.log('This will DELETE ALL DATA including auth users!\n');

  // Check for confirmation argument
  const confirmed = process.argv.includes('--confirm');
  if (!confirmed) {
    console.log('To proceed, run with --confirm flag:');
    console.log('  npx ts-node src/db/clean-slate.ts --confirm\n');
    process.exit(1);
  }

  try {
    // 1. Connect to MongoDB
    console.log('[1/5] Connecting to MongoDB...');
    await connectMongo();
    const mongoDb = getMongoDb();
    console.log('✓ MongoDB connected\n');

    // 2. Delete all auth users from Supabase
    console.log('[2/5] Deleting all auth users from Supabase...');
    if (!supabaseAdmin) {
      console.log('✗ Supabase admin client not available, skipping auth user deletion');
    } else {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

      if (listError) {
        console.error('✗ Failed to list auth users:', listError.message);
      } else if (users && users.length > 0) {
        console.log(`Found ${users.length} auth users to delete...`);
        let deleted = 0;
        let failed = 0;

        for (const user of users) {
          try {
            const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
            if (error) {
              console.error(`  ✗ Failed to delete ${user.email}:`, error.message);
              failed++;
            } else {
              console.log(`  ✓ Deleted: ${user.email}`);
              deleted++;
            }
          } catch (err) {
            console.error(`  ✗ Error deleting ${user.email}:`, err);
            failed++;
          }
        }
        console.log(`\n✓ Auth users: ${deleted} deleted, ${failed} failed`);
      } else {
        console.log('No auth users found');
      }
    }
    console.log('');

    // 3. Clear Supabase tables
    console.log('[3/5] Clearing Supabase tables...');
    const client = supabaseAdmin ?? supabase;

    const tables = ['follows', 'profiles'];
    for (const table of tables) {
      try {
        let query = client.from(table).delete();

        // Keep a harmless filter to avoid accidental full-table delete restrictions in some setups.
        if (table === 'follows') {
          query = query.neq('follower_id', '00000000-0000-0000-0000-000000000000');
        } else {
          query = query.neq('id', '00000000-0000-0000-0000-000000000000');
        }

        const { error } = await query;
        if (error) {
          console.log(`- ${table}: ${error.message}`);
        } else {
          console.log(`✓ ${table}: all records deleted`);
        }
      } catch (err) {
        console.log(`- ${table}: Error (may not exist)`);
      }
    }
    console.log('');

    // 4. Drop MongoDB collections entirely
    console.log('[4/5] Dropping MongoDB collections...');
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
      'profiles',
    ];

    for (const collectionName of collections) {
      try {
        await mongoDb.collection(collectionName).drop();
        console.log(`✓ ${collectionName}: dropped`);
      } catch (err) {
        console.log(`- ${collectionName}: may not exist (skipped)`);
      }
    }
    console.log('');

    // 5. Disconnect
    console.log('[5/5] Disconnecting...');
    await closeMongo();
    console.log('✓ MongoDB disconnected\n');

    console.log('=== COMPLETE CLEAN SLATE FINISHED ===');
    console.log('\n🎉 All data has been deleted!');
    console.log('You can now start fresh with new users and content.');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Clean slate failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  cleanSlate();
}

export default cleanSlate;
