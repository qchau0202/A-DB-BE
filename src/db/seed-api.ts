/* eslint-disable no-console */
import * as dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

// Generate 50 users with password "123456" for easy testing
const FIRST_NAMES = ['Sarah', 'Alex', 'Maria', 'James', 'Priya', 'Tom', 'Emma', 'David', 'Lisa', 'Michael', 'Nina', 'Chris', 'Sofia', 'Ryan', 'Julia', 'John', 'Jane', 'Robert', 'Linda', 'William', 'Patricia', 'Jennifer', 'Daniel', 'Elizabeth', 'Matthew', 'Barbara', 'Joseph', 'Susan', 'Thomas', 'Jessica', 'Charles', 'Sarah', 'Christopher', 'Karen', 'Andrew', 'Nancy', 'Joshua', 'Betty', 'Kevin', 'Margaret', 'Brian', 'Sandra', 'George', 'Ashley', 'Edward', 'Kimberly', 'Ronald', 'Emily', 'Timothy', 'Donna'];
const LAST_NAMES = ['Chen', 'Kumar', 'Garcia', 'Wilson', 'Sharma', 'Anderson', 'Brown', 'Lee', 'Wong', 'Davis', 'Patel', 'Martin', 'Rodriguez', 'Taylor', 'Kim', 'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green'];
const DEPARTMENTS = ['eng', 'design', 'product', 'data', 'marketing', 'sales'];
const ROLES = ['Full-stack developer', 'Backend engineer', 'Frontend developer', 'DevOps specialist', 'AI/ML engineer', 'Mobile developer', 'Security researcher', 'Game developer', 'Data engineer', 'Blockchain developer', 'Product manager', 'Open source contributor', 'QA engineer', 'Systems architect', 'UI/UX designer'];

const USERS = Array.from({ length: 50 }, (_, i) => {
  const firstName = FIRST_NAMES[i % FIRST_NAMES.length]!;
  const lastName = LAST_NAMES[i % LAST_NAMES.length]!;
  const name = `${firstName} ${lastName}`;
  const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${i > 0 ? i : ''}`;
  const email = `${username}@example.com`;
  const role = ROLES[i % ROLES.length]!;
  const bio = `${role}${Math.random() > 0.5 ? ' | Building amazing things' : ''}${Math.random() > 0.7 ? ' | Coffee lover ☕' : ''}`;

  return {
    email,
    password: '123456',
    name,
    username,
    bio,
    department_id: DEPARTMENTS[i % DEPARTMENTS.length],
  };
});

const POST_CONTENTS = [
  {
    title: "What's the best way to handle state in React 2024?",
    content: "I've been using Redux for years, but with the rise of Zustand, Jotai, and the Context API improvements, I'm wondering what everyone is reaching for these days.\n\nFor context, I'm building a medium-sized SaaS application with real-time features.",
    tags: ['react', 'javascript', 'state-management'],
  },
  {
    title: "Just deployed my first Kubernetes cluster!",
    content: "After months of learning, I finally took the plunge and migrated our staging environment to K8s. The learning curve was steep, but the scalability benefits are already showing.\n\nKey takeaways:\n- Start with managed services (EKS/GKE)\n- Helm charts are your friend\n- Monitoring is non-negotiable",
    tags: ['kubernetes', 'devops', 'cloud'],
  },
  {
    title: "TypeScript 5.0 features you should know about",
    content: "The latest TypeScript release brings some game-changing features:\n\n1. **Decorators** - Finally stable!\n2. **const type parameters** - Better type inference\n3. **speed improvements** - 10-20% faster builds\n\nWhat's your favorite new feature?",
    tags: ['typescript', 'javascript', 'webdev'],
  },
  {
    title: "System design interview experience at Big Tech",
    content: "Just finished my onsite interviews and wanted to share my experience with the system design round.\n\nThe question was: Design a URL shortener like bit.ly\n\nKey areas they focused on:\n- Database schema design\n- Caching strategy\n- Rate limiting\n- Analytics tracking",
    tags: ['system-design', 'interview', 'career'],
  },
  {
    title: "My developer workspace setup 2024",
    content: "Hardware:\n- MacBook Pro M3 Max\n- 32GB RAM, 1TB SSD\n- 4K external monitor\n- Ergonomic keyboard (Keychron K8)\n\nSoftware:\n- VS Code with custom theme\n- iTerm2 + Oh My Zsh\n- Docker Desktop\n- Notion for notes\n\nWhat's your setup?",
    tags: ['setup', 'productivity', 'workspace'],
  },
];

const DOCUMENT_CONTENTS = [
  {
    title: "React Best Practices Guide",
    body: "## Component Structure\n\n1. Keep components small and focused\n2. Use composition over inheritance\n3. Lift state up when needed\n\n## State Management\n\n- Use useState for local state\n- useReducer for complex state logic\n- Context for global state (sparingly)\n\n## Performance\n\n- Memoization with useMemo and useCallback\n- Virtualization for long lists\n- Code splitting with lazy loading",
    category_tags: ['react', 'frontend', 'guide'],
  },
  {
    title: "Docker Cheat Sheet",
    body: "## Basic Commands\n\n```bash\n# Build image\ndocker build -t myapp .\n\n# Run container\ndocker run -p 3000:3000 myapp\n\n# List containers\ndocker ps -a\n\n# Remove all stopped containers\ndocker container prune\n```\n\n## Docker Compose\n\n```yaml\nversion: '3.8'\nservices:\n  app:\n    build: .\n    ports:\n      - '3000:3000'\n```",
    category_tags: ['docker', 'devops', 'cheatsheet'],
  },
  {
    title: "System Design Interview Prep",
    body: "## Key Concepts\n\n1. **Scalability** - Horizontal vs Vertical scaling\n2. **Load Balancing** - Round-robin, least connections\n3. **Caching** - Redis, CDN strategies\n4. **Database** - SQL vs NoSQL, sharding\n5. **Microservices** - Trade-offs and patterns\n\n## Common Patterns\n\n- Circuit Breaker\n- Bulkhead\n- Retry with Exponential Backoff\n- Event Sourcing",
    category_tags: ['system-design', 'interview', 'backend'],
  },
  {
    title: "TypeScript Advanced Types",
    body: "## Conditional Types\n\n```typescript\ntype IsString<T> = T extends string ? true : false;\n```\n\n## Mapped Types\n\n```typescript\ntype Readonly<T> = {\n  readonly [P in keyof T]: T[P];\n};\n```\n\n## Utility Types\n\n- `Partial<T>` - Makes all properties optional\n- `Required<T>` - Makes all properties required\n- `Pick<T, K>` - Selects subset of properties\n- `Omit<T, K>` - Removes subset of properties",
    category_tags: ['typescript', 'javascript', 'advanced'],
  },
  {
    title: "MongoDB Query Optimization",
    body: "## Indexing Strategies\n\n### Single Field Index\n```javascript\ndb.collection.createIndex({ field: 1 })\n```\n\n### Compound Index\n```javascript\ndb.collection.createIndex({ field1: 1, field2: -1 })\n```\n\n### Text Index\n```javascript\ndb.collection.createIndex({ content: 'text' })\n```\n\n## Query Patterns\n\n- Use covered queries when possible\n- Limit results with projection\n- Use aggregation for complex operations",
    category_tags: ['mongodb', 'database', 'performance'],
  },
];

const QUICKIE_IMAGES = [
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1550439062-609e1531270e?w=400&h=600&fit=crop',
];

const COMMENTS = [
  "Great post! Thanks for sharing.",
  "This is exactly what I needed. Bookmarked!",
  "Have you tried X approach? Would love to hear your thoughts.",
  "Totally agree with point #3. Learned that the hard way.",
  "Thanks for the detailed explanation. Very helpful!",
  "What about edge cases? Would be great to see coverage on that.",
  "Just implemented this in my project. Working great so far!",
  "This deserves more upvotes. Quality content!",
  "Question: how does this scale with larger datasets?",
  "Saved this for later. Really comprehensive guide.",
];

// API helper functions
async function apiCall(path: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API call failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

async function signUp(email: string, password: string, name: string, username: string) {
  return apiCall('/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      data: { name, username },
    }),
  });
}

async function signIn(email: string, password: string) {
  return apiCall('/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function updateProfile(token: string, profile: Record<string, unknown>) {
  return apiCall('/profile/me', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(profile),
  });
}

async function createPost(token: string, post: Record<string, unknown>) {
  return apiCall('/posts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(post),
  });
}

async function createDocument(token: string, doc: Record<string, unknown>) {
  return apiCall('/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(doc),
  });
}

async function createQuickie(token: string, quickie: Record<string, unknown>) {
  return apiCall('/quickies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(quickie),
  });
}

async function createComment(token: string, postId: string, content: string) {
  return apiCall(`/posts/${postId}/comments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content }),
  });
}

async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/posts/feed/latest?limit=1`, { method: 'GET' });
    return response.status === 200; // Should return posts array
  } catch {
    return false;
  }
}

async function seedDatabase() {
  console.log('Starting API-based database seed...');
  console.log(`API URL: ${API_URL}`);

  // Check if server is running
  console.log('\nChecking server connection...');
  const isServerRunning = await checkServerHealth();
  if (!isServerRunning) {
    console.error('ERROR: Cannot connect to server!');
    console.error('   Please make sure the server is running with: npm run dev');
    console.error(`   Expected API at: ${API_URL}`);
    process.exit(1);
  }
  console.log('Server is running\n');

  const createdUsers: Array<{ email: string; token: string; userId: string }> = [];

  // Create 50 users
  console.log('Creating 50 users...');
  for (let i = 0; i < USERS.length; i++) {
    const user = USERS[i]!;
    try {
      // Sign up
      await signUp(user.email, user.password, user.name, user.username);
      console.log(`  ✓ Created user ${i + 1}/50: ${user.email}`);

      // Sign in to get token
      const signInResult = await signIn(user.email, user.password) as { session?: { access_token?: string }; user?: { id?: string } };
      const token = signInResult.session?.access_token;

      if (!token) {
        console.log(` No token for ${user.email}, skipping content creation`);
        continue;
      }

      createdUsers.push({
        email: user.email,
        token,
        userId: signInResult.user?.id || '',
      });

      // Update profile with bio and department
      await updateProfile(token, {
        bio: user.bio,
        department_id: user.department_id,
      });
    } catch (error) {
      console.log(`  ✗ Failed to create user ${user.email}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\nCreated ${createdUsers.length} users successfully`);

  // Create posts (each user creates 2 posts)
  console.log('Creating posts...');
  let postCount = 0;
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i]!;
    const numPosts = 2;

    for (let p = 0; p < numPosts; p++) {
      const content = POST_CONTENTS[(i * numPosts + p) % POST_CONTENTS.length]!;
      try {
        await createPost(user.token, {
          title: content.title,
          content_blocks: [{ type: 'text', data: content.content }],
          tags: content.tags,
          visibility: 'public',
        });
        postCount++;
      } catch (error) {
        console.log(`  ✗ Failed to create post for ${user.email}:`, error instanceof Error ? error.message : error);
      }
    }
  }
  console.log(`Created ${postCount} posts`);

  // Create documents (25% of users create documents)
  console.log('Creating documents...');
  let docCount = 0;
  const docUsers = createdUsers.filter((_, i) => i % 4 === 0);
  for (let i = 0; i < docUsers.length; i++) {
    const user = docUsers[i]!;
    const content = DOCUMENT_CONTENTS[i % DOCUMENT_CONTENTS.length]!;
    try {
      await createDocument(user.token, {
        title: content.title,
        body: content.body,
        category_tags: content.category_tags,
        is_published: true,
      });
      docCount++;
    } catch (error) {
      console.log(`  ✗ Failed to create document for ${user.email}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log(`Created ${docCount} documents`);

  // Create quickies (each user creates 1-2 quickies)
  console.log('Creating quickies...');
  let quickieCount = 0;
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i]!;
    const numQuickies = Math.random() > 0.5 ? 2 : 1;

    for (let q = 0; q < numQuickies; q++) {
      try {
        await createQuickie(user.token, {
          media_url: QUICKIE_IMAGES[(i * 2 + q) % QUICKIE_IMAGES.length],
          media_type: 'image',
          caption: Math.random() > 0.5 ? `Quick update from ${user.email.split('@')[0]}!` : undefined,
        });
        quickieCount++;
      } catch (error) {
        console.log(`  ✗ Failed to create quickie for ${user.email}:`, error instanceof Error ? error.message : error);
      }
    }
  }
  console.log(`Created ${quickieCount} quickies`);

  // Fetch all posts and add comments
  console.log('Creating comments...');
  let commentCount = 0;
  try {
    const postsResponse = await apiCall('/posts?limit=100') as { posts?: Array<{ _id: string }> };
    const posts = postsResponse.posts || [];

    for (const post of posts) {
      const numComments = Math.floor(Math.random() * 4);
      for (let c = 0; c < numComments; c++) {
        const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)]!;
        const commentText = COMMENTS[Math.floor(Math.random() * COMMENTS.length)]!;
        try {
          await createComment(randomUser.token, post._id, commentText);
          commentCount++;
        } catch (error) {
          // Ignore comment errors
        }
      }
    }
  } catch (error) {
    console.log('Failed to fetch posts for commenting:', error instanceof Error ? error.message : error);
  }
  console.log(`Created ${commentCount} comments`);

  console.log('\nDatabase seed completed!');
  console.log(`   - ${createdUsers.length} users (password: 123456)`);
  console.log(`   - ${postCount} posts`);
  console.log(`   - ${docCount} documents`);
  console.log(`   - ${quickieCount} quickies`);
  console.log(`   - ${commentCount} comments`);

  // Print sample credentials
  console.log('\nSample login credentials:');
  console.log(`   Email: ${USERS[0]!.email}`);
  console.log(`   Password: ${USERS[0]!.password}`);
}

// Run the seed
seedDatabase().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
