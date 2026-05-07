/* eslint-disable no-console */
import { connectMongo, closeMongo, getMongoDb } from '../config/mongodb';
import { supabaseAdmin } from '../config/supabase';
import { createMongoUser } from '../controller/users/user.controller';
import { randomUUID } from 'crypto';
import { ObjectId } from 'mongodb';

// API base URL for seeding (server must be running)
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

const PASSWORD = '123456';

// Sample data for generating realistic content
const TECH_TOPICS = [
  'javascript', 'typescript', 'react', 'vue', 'angular', 'nodejs', 'python', 'go', 'rust',
  'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'mongodb', 'postgresql', 'redis',
  'graphql', 'rest', 'microservices', 'serverless', 'ci/cd', 'git', 'github',
  'frontend', 'backend', 'fullstack', 'mobile', 'flutter', 'reactnative',
  'ai', 'machinelearning', 'datascience', 'blockchain', 'web3', 'security',
  'testing', 'jest', 'cypress', 'performance', 'optimization', 'architecture',
  'systemdesign', 'devops', 'agile', 'scrum', 'career', 'interview', 'tips'
];

const PROGRAMMING_LANGUAGES = ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'Ruby', 'PHP'];

const FRAMEWORKS = ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'Express', 'Fastify', 'Django', 'Spring'];

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800',
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
  'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800',
  'https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=800',
  'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800',
  'https://images.unsplash.com/photo-1550439062-609e1531270e?w=800',
  'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=800',
  'https://images.unsplash.com/photo-1607799275518-d58665d099db?w=800',
  'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=800',
];

const FAMOUS_WEB_URLS = [
  { url: 'https://github.com/microsoft/vscode', title: 'VS Code Repository' },
  { url: 'https://github.com/facebook/react', title: 'React Repository' },
  { url: 'https://docs.docker.com', title: 'Docker Documentation' },
  { url: 'https://kubernetes.io/docs', title: 'Kubernetes Docs' },
  { url: 'https://developer.mozilla.org', title: 'MDN Web Docs' },
  { url: 'https://stackoverflow.com', title: 'Stack Overflow' },
  { url: 'https://medium.com', title: 'Medium' },
  { url: 'https://dev.to', title: 'Dev.to' },
  { url: 'https://news.ycombinator.com', title: 'Hacker News' },
  { url: 'https://www.producthunt.com', title: 'Product Hunt' },
];

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Peyton', 'Dakota',
  'Sam', 'Charlie', 'Jamie', 'Reese', 'Skyler', 'Drew', 'Blake', 'Hayden', 'Cameron', 'Emerson',
  'Hiroshi', 'Wei', 'Raj', 'Priya', 'Sofia', 'Luca', 'Mateo', 'Zara', 'Kai', 'Nico',
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Joseph', 'Thomas', 'Daniel', 'Paul'];

const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Chen', 'Wang', 'Li', 'Zhang', 'Liu', 'Singh', 'Kumar', 'Patel', 'Shah', 'Gupta',
  'Suzuki', 'Tanaka', 'Watanabe', 'Kim', 'Park', 'Lee', 'Choi', 'Jung', 'Kang', 'Yoon',
  'Silva', 'Santos', 'Oliveira', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Lima', 'Souza'];

// Generate random integer
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Pick random items from array
const pickRandom = <T>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
};

// Generate random tags
const generateTags = (count: number): string[] => pickRandom(TECH_TOPICS, count);

// Generate post content
const generatePostContent = (title: string): Array<{ type: string; data: string }> => {
  const paragraphs = [
    `In this post, we'll explore ${title.toLowerCase()} and its impact on modern development.`,
    `Many developers are adopting ${title.toLowerCase()} for their projects due to its flexibility and performance.`,
    `Here are some key benefits of using ${title.toLowerCase()} in your workflow:`,
    `First, it provides excellent developer experience. Second, the community support is amazing.`,
    `Have you tried ${title.toLowerCase()} in your projects? Let me know your thoughts in the comments!`,
  ];

  return [
    { type: 'text', data: paragraphs[0]! },
    { type: 'image', data: SAMPLE_IMAGES[randomInt(0, SAMPLE_IMAGES.length - 1)]! },
    { type: 'text', data: paragraphs[1]! },
    { type: 'text', data: paragraphs[2]! },
    { type: 'code', data: `// Example code\nconst example = "${title.toLowerCase().replace(/\s+/g, '-')}";\nconsole.log(example);` },
    { type: 'text', data: paragraphs[3]! },
    { type: 'text', data: paragraphs[4]! },
  ];
};

// Generate comment content
const COMMENT_TEMPLATES = [
  'Great post! Thanks for sharing.',
  'This is really helpful, learned a lot.',
  'I have been using this approach and it works well.',
  'Could you elaborate more on the implementation details?',
  'What about performance considerations?',
  'Thanks for the detailed explanation!',
  'I disagree with point #2, here is why...',
  'This saved me hours of debugging!',
  'How does this compare to other alternatives?',
  'Bookmarked for later reference.',
  'The code example really helped clarify things.',
  'Is this production-ready?',
  'What version are you using?',
  'Have you considered edge cases?',
  'This is exactly what I was looking for!',
];

// Create user via API (alternative to admin client - bypasses triggers)
async function createUserViaAPI(email: string, username: string, name: string): Promise<{ id: string } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: PASSWORD,
        data: {
          username,
          display_name: name,
        },
      }),
    });

    const data = await response.json() as { message?: string; user?: { id: string; email: string }; user_id?: string };

    if (!response.ok) {
      // If user already exists, treat as success
      if (data.message?.includes('already exists') || data.message?.includes('already registered')) {
        console.log(`  User ${email} already exists (via API)`);
        return { id: 'existing' };
      }
      console.error(`API registration failed for ${email}:`, data.message);
      return null;
    }

    console.log(`  Created user ${email} via API`);
    return data.user || { id: data.user_id || randomUUID() };
  } catch (err) {
    console.error(`API error for ${email}:`, err);
    return null;
  }
}

// Create user via Supabase Admin API
async function createAuthUser(email: string, username: string, name: string) {
  try {
    const { data, error } = await supabaseAdmin!.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        username,
        name,
      },
    });

    if (error) {
      // If user already exists, try to fetch and return them
      if (error.message?.includes('already been registered') || error.code === 'user_already_exists') {
        const { data: { users } } = await supabaseAdmin!.auth.admin.listUsers();
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
          console.log(`  User ${email} already exists, skipping`);
          return existingUser;
        }
      }

      // Check for Supabase internal errors (500/unexpected_failure)
      if (error.status === 500 || error.code === 'unexpected_failure') {
        console.error(`\n⚠️  Supabase internal error (HTTP 500) when creating user ${email}`);
        console.error('  → Will try API registration instead...\n');
        return null;
      }

      console.error(`Failed to create user ${email}:`, error);
      return null;
    }

    return data.user;
  } catch (err) {
    console.error(`Error creating user ${email}:`, err);
    return null;
  }
}

// Valid department IDs (user has departments 1=Backend, 2=Frontend, 3=DevOps)
const VALID_DEPARTMENTS = [1, 2, 3];

async function createProfile(userId: string, username: string, displayName: string) {
  const { createProfile } = await import('../controller/profile/profile.controller');

  try {
    const profile = await createProfile({
      user_id: userId,
      username,
      display_name: displayName,
      bio: `Developer passionate about ${pickRandom(TECH_TOPICS, 3).join(', ')}`,
      department_id: VALID_DEPARTMENTS[randomInt(0, 2)]!,
    });
    return profile;
  } catch (err: any) {
    // Silently ignore duplicate profile errors
    const errMsg = err?.message || String(err);
    if (errMsg.includes('duplicate key') || errMsg.includes('unique constraint')) {
      return null;
    }
    console.error(`Failed to create profile for ${username}:`, err);
    return null;
  }
}

async function createPosts(authorId: string, authorName: string, count: number) {
  const db = getMongoDb();
  const posts = [];

  for (let i = 0; i < count; i++) {
    const topic = TECH_TOPICS[randomInt(0, TECH_TOPICS.length - 1)];
    const title = `${pickRandom(PROGRAMMING_LANGUAGES, 1)[0]} ${topic} ${['Guide', 'Tutorial', 'Best Practices', 'Tips', 'Deep Dive'][randomInt(0, 4)]}`;

    const post = {
      _id: new ObjectId(),
      author_id: authorId,
      title,
      content_blocks: generatePostContent(title),
      tags: generateTags(randomInt(2, 5)),
      is_announcement: false,
      engagement_score: randomInt(0, 100),
      visibility: ['public', 'department', 'private'][randomInt(0, 2)],
      reactions_total: randomInt(0, 50),
      comment_count: randomInt(0, 20),
      view_count: randomInt(10, 500),
      createdAt: new Date(Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000)),
      updatedAt: new Date(),
    };

    posts.push(post);
  }

  if (posts.length > 0) {
    await db.collection('posts').insertMany(posts as unknown as any[]);
  }

  return posts;
}

async function createComments(posts: any[], users: any[], count: number) {
  const db = getMongoDb();
  const comments = [];

  for (let i = 0; i < count; i++) {
    const parentPost = posts[randomInt(0, posts.length - 1)];
    const author = users[randomInt(0, users.length - 1)];
    const commentContent = COMMENT_TEMPLATES[randomInt(0, COMMENT_TEMPLATES.length - 1)];

    if (!parentPost || !author || !commentContent) continue;

    const comment = {
      _id: new ObjectId(),
      target_id: parentPost._id,
      author_id: author.supabase_id,
      content: commentContent,
      parent_comment_id: null,
      is_deleted: false,
      createdAt: new Date(Date.now() - randomInt(0, 20 * 24 * 60 * 60 * 1000)),
      updatedAt: new Date(),
    };

    comments.push(comment);
  }

  // Create some replies (30% of comments are replies)
  const parentComments = [...comments];
  for (let i = 0; i < Math.floor(count * 0.3); i++) {
    const parentComment = parentComments[randomInt(0, parentComments.length - 1)];
    const author = users[randomInt(0, users.length - 1)];
    const replyContent = COMMENT_TEMPLATES[randomInt(0, COMMENT_TEMPLATES.length - 1)];

    if (!parentComment || !author || !replyContent) continue;

    const reply = {
      _id: new ObjectId(),
      target_id: parentComment.target_id,
      author_id: author.supabase_id,
      content: `Reply: ${replyContent}`,
      parent_comment_id: parentComment._id,
      is_deleted: false,
      createdAt: new Date(Date.now() - randomInt(0, 10 * 24 * 60 * 60 * 1000)),
      updatedAt: new Date(),
    };

    comments.push(reply);
  }

  if (comments.length > 0) {
    await db.collection('comments').insertMany(comments as unknown as any[]);
  }

  return comments;
}

async function createDocuments(authorId: string, count: number) {
  const db = getMongoDb();
  const docs = [];

  for (let i = 0; i < count; i++) {
    const webRef = FAMOUS_WEB_URLS[randomInt(0, FAMOUS_WEB_URLS.length - 1)];
    const docImage = SAMPLE_IMAGES[randomInt(0, SAMPLE_IMAGES.length - 1)];
    const docTopic = pickRandom(TECH_TOPICS, 1)[0];
    const docType = ['Documentation', 'Reference', 'Handbook', 'Guide'][randomInt(0, 3)];

    if (!webRef || !docTopic || !docType) continue;

    const doc = {
      _id: randomUUID(),
      author_id: authorId,
      title: `${docTopic} ${docType}`,
      body: `This document provides detailed information about the subject matter.\n\n## Key Points\n- Point 1\n- Point 2\n- Point 3\n\n## Conclusion\nSummary of important takeaways.`,
      category_tags: generateTags(randomInt(2, 4)),
      version: 1,
      is_published: true,
      view_count: randomInt(10, 300),
      reactions: { like: randomInt(0, 50), insightful: randomInt(0, 30) },
      comment_count: randomInt(0, 20),
      createdAt: new Date(Date.now() - randomInt(0, 60 * 24 * 60 * 60 * 1000)),
      updatedAt: new Date(),
    };

    docs.push(doc);
  }

  if (docs.length > 0) {
    await db.collection('documents').insertMany(docs as unknown as any[]);
  }

  return docs;
}

async function createQuickies(authorId: string, count: number) {
  const db = getMongoDb();
  const quickies = [];

  const quickieTemplates = [
    { caption: 'Just shipped a new feature! 🚀', media_url: SAMPLE_IMAGES[randomInt(0, SAMPLE_IMAGES.length - 1)] },
    { caption: 'Debugging be like... 😅', media_url: SAMPLE_IMAGES[randomInt(0, SAMPLE_IMAGES.length - 1)] },
    { caption: `Learning ${pickRandom(PROGRAMMING_LANGUAGES, 1)[0]} today!`, media_url: SAMPLE_IMAGES[randomInt(0, SAMPLE_IMAGES.length - 1)] },
    { caption: 'Code review complete ✅', media_url: SAMPLE_IMAGES[randomInt(0, SAMPLE_IMAGES.length - 1)] },
    { caption: 'Deploying to production... 🚢', media_url: SAMPLE_IMAGES[randomInt(0, SAMPLE_IMAGES.length - 1)] },
    { caption: 'Anyone else love refactoring? 🧹', media_url: SAMPLE_IMAGES[randomInt(0, SAMPLE_IMAGES.length - 1)] },
    { caption: 'Morning standup vibes ☕', media_url: SAMPLE_IMAGES[randomInt(0, SAMPLE_IMAGES.length - 1)] },
    { caption: 'That moment when tests pass 🎉', media_url: SAMPLE_IMAGES[randomInt(0, SAMPLE_IMAGES.length - 1)] },
  ];

  for (let i = 0; i < count; i++) {
    const template = quickieTemplates[randomInt(0, quickieTemplates.length - 1)];

    if (!template) continue;

    const quickie = {
      _id: randomUUID(),
      author_id: authorId,
      media_url: template.media_url,
      media_type: 'image',
      caption: template.caption,
      viewers: [],
      reactions: { like: randomInt(0, 20) },
      notify: false,
      createdAt: new Date(Date.now() - randomInt(0, 14 * 24 * 60 * 60 * 1000)),
      updatedAt: new Date(),
    };

    quickies.push(quickie);
  }

  if (quickies.length > 0) {
    await db.collection('quickies').insertMany(quickies as unknown as any[]);
  }

  return quickies;
}

async function seedUsers() {
  console.log('=== Starting User Seeding ===\n');

  if (!supabaseAdmin) {
    console.error('Supabase admin client not configured. Check SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  try {
    // Test Supabase connection first
    console.log('[0/6] Testing Supabase connection...');
    const { data: authData, error: authError } = await supabaseAdmin!.auth.admin.listUsers({ perPage: 1 });
    if (authError) {
      console.error('✗ Supabase auth connection failed:', authError.message);
      console.error('Check your SUPABASE_SERVICE_ROLE_KEY and project URL');
      process.exit(1);
    }
    console.log(`✓ Supabase connected (found ${authData.users.length} existing users)\n`);

    // Connect to MongoDB
    console.log('[1/6] Connecting to MongoDB...');
    await connectMongo();
    console.log('✓ MongoDB connected\n');

    const db = getMongoDb();
    const createdUsers = [];
    let successCount = 0;
    let failCount = 0;

    // Create 50 users (or stop early if Supabase is failing)
    console.log('[2/6] Creating 50 auth users...');
    const MAX_FAILS = 5; // Stop after 5 failures to avoid spamming
    for (let i = 0; i < 50 && failCount < MAX_FAILS; i++) {
      const firstName = FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)];
      const lastName = LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)];
      const uniqueId = randomUUID().slice(0, 8);
      const username = `${firstName!.toLowerCase()}${lastName!.toLowerCase()}${uniqueId}`;
      const email = `user.${uniqueId}@devconnect.test`;
      const name = `${firstName} ${lastName}`;

      // Try to create auth user - first with admin client, then with API
      let authUser: { id: string; email?: string } | null = await createAuthUser(email, username, name);

      // If admin fails, try API registration (server must be running)
      if (!authUser && failCount >= 2) {
        console.log(`  Trying API registration for ${email}...`);
        authUser = await createUserViaAPI(email, username, name);
      }

      // Add delay to avoid rate limiting (Supabase has strict limits)
      await delay(300);

      if (!authUser) {
        failCount++;
        if (failCount >= MAX_FAILS) {
          console.log(`  Stopping after ${MAX_FAILS} failures - will use existing users instead`);
          break;
        }
        continue;
      }

      // Create MongoDB user (ignore if already exists)
      try {
        await createMongoUser({
          supabase_id: authUser.id,
          email,
          username,
          name,
          bio: `Developer passionate about ${pickRandom(TECH_TOPICS, 3).join(', ')}`,
        });
      } catch (err) {
        // Ignore MongoDB duplicate errors
      }

      // Create profile in Supabase
      const profile = await createProfile(authUser.id, username, name);
      if (!profile) {
        console.log(`  Profile creation skipped for ${username} (may already exist)`);
      }

      createdUsers.push({
        supabase_id: authUser.id,
        email,
        username,
        name,
        mongo_id: authUser.id,
      });

      successCount++;

      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/50 users created (${successCount} successful)`);
      }
    }
    if (successCount === 0 && failCount > 0) {
      console.log(`✗ Could not create new users (${failCount} failed)\n`);
    } else {
      console.log(`✓ Created ${successCount} users (${failCount} failed)\n`);
    }

    // FALLBACK: If we couldn't create users, try to use existing ones from Supabase
    if (createdUsers.length === 0) {
      console.log('[2b/6] Trying to use existing Supabase users as fallback...');
      try {
        const { data: { users: existingUsers } } = await supabaseAdmin!.auth.admin.listUsers({ perPage: 50 });
        if (existingUsers && existingUsers.length > 0) {
          for (const user of existingUsers.slice(0, 50)) {
            const metadata = user.user_metadata || {};
            const name = metadata.name || metadata.display_name || user.email?.split('@')[0] || 'User';
            const username = metadata.username || name.toLowerCase().replace(/\s/g, '');
            createdUsers.push({
              supabase_id: user.id,
              email: user.email || 'unknown@example.com',
              username,
              name,
              mongo_id: user.id,
            });

            // Ensure MongoDB user exists
            try {
              await createMongoUser({
                supabase_id: user.id,
                email: user.email || 'unknown@example.com',
                username,
                name,
                bio: `Developer`,
              });
            } catch (err) {
              // Ignore duplicates
            }

            // Ensure Supabase profile exists
            try {
              const profile = await createProfile(user.id, username, name);
              if (profile) {
                console.log(`  Created profile for ${username}`);
              }
            } catch (err) {
              // Ignore duplicate profile errors
            }

            // Reset password to ensure user can log in
            try {
              const { error: updateError } = await supabaseAdmin!.auth.admin.updateUserById(user.id, {
                password: PASSWORD,
              });
              if (!updateError) {
                console.log(`  Reset password for ${username}`);
              }
            } catch (err) {
              // Ignore password reset errors (some users may have been created with OAuth)
            }
          }
          console.log(`✓ Using ${createdUsers.length} existing users from Supabase\n`);
        } else {
          console.error('✗ No existing users found in Supabase. Cannot seed content.');
          console.error('Please create at least one user manually in Supabase dashboard first.\n');
        }
      } catch (err) {
        console.error('✗ Failed to fetch existing users:', err);
      }
    }

    // Create posts for each user (2-5 posts per user)
    console.log('[3/6] Creating posts...');
    let totalPosts = 0;
    for (const user of createdUsers) {
      const postCount = randomInt(2, 5);
      await createPosts(user.supabase_id, user.name, postCount);
      totalPosts += postCount;
    }
    console.log(`✓ Created ${totalPosts} posts\n`);

    // Get all posts for comments
    const allPosts = await db.collection('posts').find({}).toArray() as unknown as Array<{ _id: string }>;

    // Create comments (10-30 comments per user)
    console.log('[4/6] Creating comments...');
    let totalComments = 0;
    for (const user of createdUsers) {
      const commentCount = randomInt(10, 30);
      await createComments(allPosts, createdUsers, commentCount);
      totalComments += commentCount;
    }
    console.log(`✓ Created ${totalComments} comments\n`);

    // Create documents (1-3 documents per user)
    console.log('[5/6] Creating documents...');
    let totalDocs = 0;
    for (const user of createdUsers) {
      const docCount = randomInt(1, 3);
      await createDocuments(user.supabase_id, docCount);
      totalDocs += docCount;
    }
    console.log(`✓ Created ${totalDocs} documents\n`);

    // Create quickies (3-8 quickies per user)
    console.log('[6/6] Creating quickies...');
    let totalQuickies = 0;
    for (const user of createdUsers) {
      const quickieCount = randomInt(3, 8);
      await createQuickies(user.supabase_id, quickieCount);
      totalQuickies += quickieCount;
    }
    console.log(`✓ Created ${totalQuickies} quickies\n`);

    // Disconnect
    await closeMongo();

    console.log('=== Seeding Complete ===\n');
    console.log('Summary:');
    console.log(`  Users: ${createdUsers.length} (${successCount} new, ${createdUsers.length - successCount} existing)`);
    console.log(`  Posts: ${totalPosts}`);
    console.log(`  Comments: ${totalComments}`);
    console.log(`  Documents: ${totalDocs}`);
    console.log(`  Quickies: ${totalQuickies}`);
    if (createdUsers.length > 0) {
      console.log('\nSample logins (all use password: 123456):');
      for (let i = 0; i < Math.min(3, createdUsers.length); i++) {
        const user = createdUsers[i];
        if (user) {
          console.log(`  ${user.email} / ${PASSWORD}`);
        }
      }
      if (createdUsers.length > 3) {
        console.log(`  ... and ${createdUsers.length - 3} more users`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    await closeMongo();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedUsers();
}

export default seedUsers;
