/**
 * Setup Test Data using Supabase Auth API
 * 
 * This creates test users through the Auth API, then creates their profiles.
 * Run with: npx ts-node src/test/setup-test-data-api.ts
 */

import { supabase, supabaseAdmin } from '../config/supabase';

interface TestUser {
  email: string;
  password: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
}

const TEST_USERS: TestUser[] = [
  {
    email: 'alice.test@example.com',
    password: 'TestPass123!',
    username: 'alice',
    displayName: 'Alice Smith',
    avatarUrl: 'https://i.pravatar.cc/150?u=alice',
    bio: 'Software Engineer'
  },
  {
    email: 'bob.test@example.com',
    password: 'TestPass123!',
    username: 'bob',
    displayName: 'Bob Johnson',
    avatarUrl: 'https://i.pravatar.cc/150?u=bob',
    bio: 'Product Manager'
  },
  {
    email: 'carol.test@example.com',
    password: 'TestPass123!',
    username: 'carol',
    displayName: 'Carol Williams',
    avatarUrl: 'https://i.pravatar.cc/150?u=carol',
    bio: 'Designer'
  },
  {
    email: 'dave.test@example.com',
    password: 'TestPass123!',
    username: 'dave',
    displayName: 'Dave Brown',
    avatarUrl: 'https://i.pravatar.cc/150?u=dave',
    bio: 'Data Scientist'
  },
  {
    email: 'eve.test@example.com',
    password: 'TestPass123!',
    username: 'eve',
    displayName: 'Eve Davis',
    avatarUrl: 'https://i.pravatar.cc/150?u=eve',
    bio: 'DevOps Engineer'
  }
];

const createdUserIds: string[] = [];

async function createUser(user: TestUser): Promise<string | null> {
  try {
    // Create user using admin API (bypasses email verification)
    const { data, error } = await supabaseAdmin?.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        username: user.username
      }
    }) ?? { data: null, error: new Error('Admin client not available') };

    if (error) {
      // Check if user already exists
      if (error.message?.includes('already been registered')) {
        console.log(`⚠️ ${user.username} already exists, fetching ID...`);
        const { data: existingUsers } = await supabaseAdmin?.auth.admin.listUsers() ?? { data: { users: [] } };
        const existingUser = existingUsers?.users.find(u => u.email === user.email);
        if (existingUser) {
          createdUserIds.push(existingUser.id);
          return existingUser.id;
        }
      }
      console.error(`❌ Failed to create ${user.username}:`, error.message);
      return null;
    }

    if (!data?.user) {
      console.error(`❌ No user returned for ${user.username}`);
      return null;
    }

    const userId = data.user.id;
    createdUserIds.push(userId);
    console.log(`✅ Created user: ${user.username} (${userId})`);

    // Create profile for the user
    const { error: profileError } = await supabaseAdmin
      ?.from('profiles')
      .upsert({
        id: userId,
        user_id: userId,
        username: user.username,
        display_name: user.displayName,
        avatar_url: user.avatarUrl,
        bio: user.bio,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' }) ?? { error: new Error('Admin client not available') };

    if (profileError) {
      console.error(`❌ Failed to create profile for ${user.username}:`, profileError.message);
    } else {
      console.log(`✅ Created profile for ${user.username}`);
    }

    return userId;
  } catch (err) {
    console.error(`❌ Unexpected error creating ${user.username}:`, err);
    return null;
  }
}

async function createFollowRelationships() {
  console.log('\n🔗 Creating follow relationships...\n');

  if (createdUserIds.length < 5) {
    console.error('❌ Not all users were created, cannot create follow relationships');
    return;
  }

  const [aliceId, bobId, carolId, daveId, eveId] = createdUserIds;

  const follows = [
    { follower: aliceId, following: bobId, desc: 'Alice -> Bob' },
    { follower: bobId, following: carolId, desc: 'Bob -> Carol' },
    { follower: carolId, following: daveId, desc: 'Carol -> Dave' },
    { follower: daveId, following: eveId, desc: 'Dave -> Eve' }
  ];

  for (const follow of follows) {
    try {
      const { error } = await supabaseAdmin
        ?.from('follows')
        .upsert({
          follower_id: follow.follower,
          following_id: follow.following,
          created_at: new Date().toISOString()
        }, { onConflict: 'follower_id,following_id' }) ?? { error: new Error('Admin client not available') };

      if (error) {
        console.error(`❌ Failed to create ${follow.desc}:`, error.message);
      } else {
        console.log(`✅ Created follow: ${follow.desc}`);
      }
    } catch (err) {
      console.error(`❌ Error creating ${follow.desc}:`, err);
    }
  }
}

async function createTestPosts() {
  console.log('\n📝 Creating test posts...\n');

  if (createdUserIds.length < 5) {
    console.error('❌ Not all users were created, cannot create posts');
    return;
  }

  const [aliceId, bobId, carolId, daveId, eveId] = createdUserIds;

  const posts = [
    {
      title: 'Getting Started with PostgreSQL',
      content: 'A comprehensive guide to PostgreSQL basics and advanced features...',
      author_id: aliceId,
      views: 150,
      comment_count: 12,
      reactions: { like: 45, love: 8 },
      tags: ['postgresql', 'database', 'tutorial']
    },
    {
      title: 'Advanced SQL Window Functions',
      content: 'Learn about ROW_NUMBER, RANK, DENSE_RANK, and more window functions...',
      author_id: bobId,
      views: 89,
      comment_count: 5,
      reactions: { like: 23, celebrate: 3 },
      tags: ['sql', 'advanced', 'database']
    },
    {
      title: 'MongoDB vs PostgreSQL: When to Use Which',
      content: 'Comparing document and relational databases for different use cases...',
      author_id: carolId,
      views: 234,
      comment_count: 18,
      reactions: { like: 67, insightful: 12 },
      tags: ['mongodb', 'postgresql', 'comparison']
    },
    {
      title: 'Recursive CTEs Explained with Examples',
      content: 'Understanding recursive common table expressions for hierarchical data...',
      author_id: daveId,
      views: 67,
      comment_count: 8,
      reactions: { like: 19 },
      tags: ['sql', 'cte', 'recursive']
    },
    {
      title: 'Database Indexing Strategies for Performance',
      content: 'How to optimize queries with proper indexing strategies...',
      author_id: eveId,
      views: 45,
      comment_count: 3,
      reactions: { like: 12 },
      tags: ['performance', 'indexing', 'optimization']
    }
  ];

  for (const post of posts) {
    try {
      const { error } = await supabaseAdmin
        ?.from('posts')
        .insert({
          id: crypto.randomUUID(),
          title: post.title,
          content: post.content,
          author_id: post.author_id,
          created_at: new Date(Date.now() - Math.random() * 86400000 * 2).toISOString(), // Random time in last 2 days
          views: post.views,
          comment_count: post.comment_count,
          reactions: post.reactions,
          tags: post.tags,
          is_public: true
        }) ?? { error: new Error('Admin client not available') };

      if (error) {
        console.error(`❌ Failed to create post "${post.title}":`, error.message);
      } else {
        console.log(`✅ Created post: ${post.title}`);
      }
    } catch (err) {
      console.error(`❌ Error creating post "${post.title}":`, err);
    }
  }
}

async function testRPCFunction() {
  console.log('\n🧪 Testing RPC function...\n');

  if (createdUserIds.length === 0) {
    console.error('❌ No users created, cannot test RPC');
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      ?.rpc('find_mutual_connections', {
        p_user_id: createdUserIds[0], // Alice
        p_max_degree: 3
      }) ?? { data: null, error: new Error('Admin client not available') };

    if (error) {
      console.error('❌ RPC test failed:', error.message);
      console.log('💡 Make sure you ran the SQL migration first!');
      return;
    }

    if (!data || data.length === 0) {
      console.log('ℹ️ RPC returned no connections (follow relationships may not be created yet)');
      return;
    }

    console.log('✅ RPC function working!');
    console.log(`📊 Found ${data.length} connections:\n`);

    data.forEach((conn: any, i: number) => {
      console.log(`  ${i + 1}. ${conn.display_name || conn.username} (Degree ${conn.degree}, ${conn.mutual_count} mutuals)`);
    });
  } catch (err) {
    console.error('❌ Error testing RPC:', err);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Setting up Test Data via Supabase Auth API             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check admin client
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available. Set SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  // Step 1: Create users and profiles
  console.log('👥 Creating test users...\n');
  for (const user of TEST_USERS) {
    await createUser(user);
  }

  // Step 2: Create follow relationships
  await createFollowRelationships();

  // Step 3: Create test posts
  await createTestPosts();

  // Step 4: Test RPC function
  await testRPCFunction();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 Setup Complete');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\nCreated ${createdUserIds.length} users:`);
  TEST_USERS.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.username} - ${u.email}`);
  });
  console.log('\n🎉 Test data ready! You can now test the RPC functions.');
  console.log(`\nTest user credentials:`);
  console.log(`  Email: alice.test@example.com`);
  console.log(`  Password: TestPass123!`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
