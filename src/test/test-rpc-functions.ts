/**
 * Test script for Supabase RPC Functions
 * 
 * Run this to verify the RPC functions are working:
 * npx ts-node src/test/test-rpc-functions.ts
 */

import { supabase, supabaseAdmin } from '../config/supabase';

const TEST_USER_ID = process.env.TEST_USER_ID || '00000000-0000-0000-0000-000000000000';

interface MutualConnection {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  degree: number;
  path: string[];
  mutual_count: number;
}

interface TrendingPost {
  id: string;
  title: string;
  author_id: string;
  score: number;
  overall_rank: number;
  percentile: number;
  decile: number;
}

async function testMutualConnectionsRPC() {
  console.log('\n🧪 Testing find_mutual_connections RPC...\n');

  try {
    // Test the RPC function
    const { data, error } = await supabase
      .rpc('find_mutual_connections', {
        p_user_id: TEST_USER_ID,
        p_max_degree: 3
      });

    if (error) {
      console.error('❌ RPC Error:', error.message);
      console.log('💡 Make sure you ran the SQL migration first!');
      return false;
    }

    const connections = data as MutualConnection[];
    
    if (!connections || connections.length === 0) {
      console.log('ℹ️ No connections found (expected if no follows exist)');
      return true;
    }

    console.log('✅ RPC Function working!');
    console.log(`📊 Found ${connections.length} connections:\n`);

    // Group by degree
    const byDegree = {
      first: connections.filter(c => c.degree === 1),
      second: connections.filter(c => c.degree === 2),
      third: connections.filter(c => c.degree === 3)
    };

    console.log(`  1st degree (direct): ${byDegree.first.length}`);
    console.log(`  2nd degree (friends of friends): ${byDegree.second.length}`);
    console.log(`  3rd degree (extended): ${byDegree.third.length}`);

    // Show sample connections
    console.log('\n📋 Sample connections:');
    connections.slice(0, 5).forEach((conn, i) => {
      console.log(`  ${i + 1}. ${conn.display_name || conn.username} (Degree ${conn.degree}, ${conn.mutual_count} mutuals)`);
    });

    return true;
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    return false;
  }
}

async function testTrendingView() {
  console.log('\n🧪 Testing trending_posts_view...\n');

  try {
    // Query the view
    const { data, error } = await supabase
      .from('trending_posts_view')
      .select('*')
      .limit(10);

    if (error) {
      console.error('❌ View Error:', error.message);
      console.log('💡 Make sure you ran the SQL migration first!');
      return false;
    }

    const posts = data as TrendingPost[];
    
    if (!posts || posts.length === 0) {
      console.log('ℹ️ No trending posts found (expected if no posts exist)');
      return true;
    }

    console.log('✅ Trending View working!');
    console.log(`📊 Top ${posts.length} posts:\n`);

    posts.forEach((post, i) => {
      console.log(`  ${post.overall_rank}. ${post.title}`);
      console.log(`     Score: ${Math.round(post.score * 100) / 100} | Percentile: ${post.percentile}% | Decile: ${post.decile}`);
    });

    return true;
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    return false;
  }
}

async function testDirectSQL() {
  console.log('\n🧪 Testing direct SQL execution...\n');

  try {
    // Test if we can execute raw SQL (admin only)
    const { data, error } = await supabaseAdmin
      ?.rpc('find_mutual_connections', {
        p_user_id: TEST_USER_ID,
        p_max_degree: 2
      }) || { data: null, error: new Error('Admin client not available') };

    if (error) {
      console.error('❌ Direct SQL Error:', error.message);
      return false;
    }

    console.log('✅ Direct SQL access working with admin client!');
    return true;
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    return false;
  }
}

async function checkFunctionExists() {
  console.log('\n🔍 Checking if RPC functions exist...\n');

  try {
    // Query pg_proc to check for function existence
    const { data, error } = await supabase
      .from('pg_proc')
      .select('proname, prosrc')
      .eq('proname', 'find_mutual_connections');

    if (error) {
      console.error('❌ Cannot query pg_proc:', error.message);
      return false;
    }

    if (data && data.length > 0) {
      console.log('✅ find_mutual_connections function exists in database');
      return true;
    } else {
      console.log('❌ find_mutual_connections function NOT found');
      console.log('💡 Run the migration: npx ts-node supabase/migrations/001_create_mutual_connections_rpc.sql');
      return false;
    }
  } catch (err) {
    console.error('❌ Error checking functions:', err);
    return false;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Supabase RPC Functions Test Suite                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = {
    functionExists: await checkFunctionExists(),
    mutualConnections: await testMutualConnectionsRPC(),
    trendingView: await testTrendingView(),
    directSQL: await testDirectSQL()
  };

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 Test Results Summary');
  console.log('═══════════════════════════════════════════════════════════');
  
  Object.entries(results).forEach(([name, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${name}`);
  });

  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! RPC functions are working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export { testMutualConnectionsRPC, testTrendingView, runAllTests };
