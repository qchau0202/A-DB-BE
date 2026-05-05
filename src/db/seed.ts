/* eslint-disable no-console */
import { connectMongo, closeMongo } from '../config/mongodb';
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

// Supabase Auth API helper
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createSupabaseUser(email: string, password: string, userData: { id: string; name: string; username: string }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('Supabase not configured - skipping auth user creation');
    return null;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: userData.name,
          username: userData.username,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`⚠️  Failed to create Supabase user ${email}: ${error}`);
      return null;
    }

    const data = await response.json() as { id: string };
    return data.id;
  } catch (error) {
    console.log(`Error creating Supabase user ${email}:`, error);
    return null;
  }
}

// Seed data for DevConnect - 15 users with realistic profiles, posts, quickies, and comments

// Generate 50 users with password "123456" for easy testing
const FIRST_NAMES = ['Sarah', 'Alex', 'Maria', 'James', 'Priya', 'Tom', 'Emma', 'David', 'Lisa', 'Michael', 'Nina', 'Chris', 'Sofia', 'Ryan', 'Julia', 'John', 'Jane', 'Robert', 'Linda', 'William', 'Patricia', 'Jennifer', 'Daniel', 'Elizabeth', 'Matthew', 'Barbara', 'Joseph', 'Susan', 'Thomas', 'Jessica', 'Charles', 'Sarah', 'Christopher', 'Karen', 'Andrew', 'Nancy', 'Joshua', 'Betty', 'Kevin', 'Margaret', 'Brian', 'Sandra', 'George', 'Ashley', 'Edward', 'Kimberly', 'Ronald', 'Emily', 'Timothy', 'Donna'];
const LAST_NAMES = ['Chen', 'Kumar', 'Garcia', 'Wilson', 'Sharma', 'Anderson', 'Brown', 'Lee', 'Wong', 'Davis', 'Patel', 'Martin', 'Rodriguez', 'Taylor', 'Kim', 'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green'];
const DEPARTMENTS = ['eng', 'design', 'product', 'data', 'marketing', 'sales'];
const ROLES = ['Full-stack developer', 'Backend engineer', 'Frontend developer', 'DevOps specialist', 'AI/ML engineer', 'Mobile developer', 'Security researcher', 'Game developer', 'Data engineer', 'Blockchain developer', 'Product manager', 'Open source contributor', 'QA engineer', 'Systems architect', 'UI/UX designer'];

const USERS = Array.from({ length: 50 }, (_, i) => {
  const id = `user-${String(i + 1).padStart(3, '0')}`;
  const firstName = FIRST_NAMES[i % FIRST_NAMES.length]!;
  const lastName = LAST_NAMES[i % LAST_NAMES.length]!;
  const name = `${firstName} ${lastName}`;
  const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${i > 0 ? i : ''}`;
  const email = `${username}@example.com`;
  const role = ROLES[i % ROLES.length]!;
  const bio = `${role}${Math.random() > 0.5 ? ' | Building amazing things' : ''}${Math.random() > 0.7 ? ' | Coffee lover ☕' : ''}`;

  return {
    id,
    email,
    name,
    username,
    bio,
    password: '123456', // All users have same password for easy testing
  };
});

const POST_CONTENTS = [
  {
    title: "What's the best way to handle state in React 2024?",
    content: "I've been using Redux for years, but with the rise of Zustand, Jotai, and the Context API improvements, I'm wondering what everyone is reaching for these days. \n\nFor context, I'm building a medium-sized SaaS application with real-time features.",
    tags: ['react', 'javascript', 'state-management'],
  },
  {
    title: "Just deployed my first Kubernetes cluster!",
    content: "After months of learning, I finally took the plunge and migrated our staging environment to K8s. The learning curve was steep, but the scalability benefits are already showing.\n\nKey takeaways:\n- Start with managed services (EKS/GKE)\n- Helm charts are your friend\n- Monitoring is non-negotiable",
    tags: ['kubernetes', 'devops', 'cloud'],
  },
  {
    title: "Building a design system from scratch - lessons learned",
    content: "Our team just shipped v1.0 of our internal design system. Here's what we learned:\n\n1. Start with tokens (colors, spacing, typography)\n2. Document as you build\n3. Get feedback early and often\n4. Automation saves sanity\n\nHappy to share more details if anyone is interested!",
    tags: ['design-system', 'frontend', 'ui-ux'],
  },
  {
    title: "The hidden costs of microservices",
    content: "Everyone talks about the benefits of microservices, but let's discuss the trade-offs:\n\n- Operational complexity\n- Distributed debugging nightmares\n- Data consistency challenges\n- Team communication overhead\n\nSometimes a well-architected monolith is the right choice. Thoughts?",
    tags: ['architecture', 'microservices', 'backend'],
  },
  {
    title: "Getting started with WebAssembly - my weekend project",
    content: "Spent the weekend building a image processing tool with Rust + WASM. The performance gains are incredible - 10x faster than the JavaScript equivalent!\n\nHas anyone else experimented with WASM in production?",
    tags: ['webassembly', 'rust', 'performance'],
  },
  {
    title: "CSS Grid vs Flexbox - when to use what?",
    content: "I see a lot of confusion about when to use Grid vs Flexbox. Here's my mental model:\n\n- Grid: 2D layouts, page structure, complex alignments\n- Flexbox: 1D layouts, component level, content distribution\n\nThey're complementary, not competing!",
    tags: ['css', 'frontend', 'web-dev'],
  },
  {
    title: "Database indexing strategies that saved our app",
    content: "We were seeing 5-second query times at scale. Here's how we fixed it:\n\n1. Added composite indexes for multi-column queries\n2. Used partial indexes for filtered data\n3. Implemented query result caching\n4. Analyzed with EXPLAIN ANALYZE\n\nQuery times dropped to <100ms. Profiling is everything!",
    tags: ['database', 'performance', 'sql'],
  },
  {
    title: "TypeScript tips: 5 patterns I wish I knew earlier",
    content: "1. Use `satisfies` instead of type annotations\n2. Leverage discriminated unions for better type narrowing\n3. `infer` keyword for conditional types\n4. Branded types for better type safety\n5. Template literal types for string patterns\n\nWhat are your favorite TypeScript tricks?",
    tags: ['typescript', 'javascript', 'tips'],
  },
  {
    title: "The future of AI-assisted coding",
    content: "Been using Copilot for a year now. It's changed how I work:\n\nPros:\n- Boilerplate code generation\n- Documentation lookup\n- Test case suggestions\n\nCons:\n- Over-reliance on suggestions\n- Sometimes produces subtle bugs\n- Privacy concerns\n\nWhat's your experience with AI coding assistants?",
    tags: ['ai', 'productivity', 'tools'],
  },
  {
    title: "Building accessible forms - a comprehensive guide",
    content: "Accessibility isn't optional. Here's my checklist for forms:\n\n✓ Proper label associations\n✓ Error messages linked with aria-describedby\n✓ Focus management\n✓ Keyboard navigation\n✓ Screen reader testing\n✓ Color contrast compliance\n\nWhat accessibility practices do you follow?",
    tags: ['accessibility', 'a11y', 'frontend'],
  },
  {
    title: "From zero to CI/CD pipeline in one day",
    content: "Set up a complete CI/CD pipeline with GitHub Actions, testing, and deployment. Here's the stack:\n\n- GitHub Actions for automation\n- Jest for unit tests\n- Playwright for E2E\n- Docker for containerization\n- AWS ECS for deployment\n\nDeployment time: 45s 🚀",
    tags: ['cicd', 'devops', 'github-actions'],
  },
  {
    title: "Why I switched from VS Code to Neovim",
    content: "After 5 years with VS Code, I made the switch. Here's why:\n\n1. Speed - everything is keyboard-driven\n2. Customization - Lua configuration\n3. Terminal integration\n4. Resource efficiency\n\nThe learning curve is real, but the payoff is worth it. Anyone else on the Neovim train?",
    tags: ['editors', 'neovim', 'productivity'],
  },
  {
    title: "GraphQL vs REST - making the right choice",
    content: "Both have their place. My decision framework:\n\nChoose GraphQL when:\n- Multiple clients need different data shapes\n- You want to reduce over-fetching\n- Real-time features with subscriptions\n\nChoose REST when:\n- Simple CRUD operations\n- Caching is critical\n- Team is already familiar",
    tags: ['graphql', 'rest', 'api'],
  },
  {
    title: "Learning Go as a JavaScript developer",
    content: "30 days of Go - here's what surprised me:\n\n- Compilation speed is blazing fast\n- Type inference feels like magic\n- Error handling is explicit (no try/catch)\n- Goroutines make concurrency approachable\n- Standard library is comprehensive\n\nHighly recommend for backend work!",
    tags: ['go', 'golang', 'backend'],
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

async function seedDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI || '');
  
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'devconnect');
    
    console.log('Starting database seed...');
    
    // Clear existing data
    console.log('Clearing existing data...');
    await db.collection('posts').deleteMany({});
    await db.collection('documents').deleteMany({});
    await db.collection('quickies').deleteMany({});
    await db.collection('comments').deleteMany({});
    await db.collection('profiles').deleteMany({});
    
    // Seed users in Supabase Auth and MongoDB
    console.log('Seeding users...');
    await db.collection('users').deleteMany({});

    // Create users in Supabase Auth (if configured) and get their UUIDs
    const userIdMap = new Map<string, string>(); // oldId -> newId (Supabase UUID or oldId)

    for (const user of USERS) {
      // Try to create in Supabase Auth
      const supabaseId = await createSupabaseUser(user.email, user.password, {
        id: user.id,
        name: user.name,
        username: user.username,
      });

      // Use Supabase UUID if created, otherwise use the original ID
      const finalId = supabaseId || user.id;
      userIdMap.set(user.id, finalId);

      // Insert into MongoDB with the correct ID
      await db.collection('users').insertOne({
        ...user,
        _id: finalId as any,
        supabase_id: supabaseId || null,
        created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      });
    }

    console.log(`Created ${USERS.length} users${SUPABASE_URL ? ' in Supabase Auth' : ''}`);

    // Seed profiles
    console.log('Seeding profiles...');
    const profiles = USERS.map((user, i) => {
      const finalId = userIdMap.get(user.id)!;
      return {
        user_id: finalId,
        username: user.username,
        display_name: user.name,
        bio: user.bio,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
        department_id: DEPARTMENTS[i % DEPARTMENTS.length],
        follower_count: Math.floor(Math.random() * 500),
        following: USERS.filter(u => u.id !== user.id)
          .slice(0, Math.floor(Math.random() * 5) + 1)
          .map(u => userIdMap.get(u.id)!),
        created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        updated_at: new Date(),
      };
    });
    await db.collection('profiles').insertMany(profiles);
    
    // Seed posts - create more posts for 50 users
    console.log('Seeding posts...');
    const posts = [];
    const NUM_POSTS = 100; // More posts for 50 users
    for (let i = 0; i < NUM_POSTS; i++) {
      const content = POST_CONTENTS[i % POST_CONTENTS.length]!;
      const author = USERS[i % USERS.length]!;
      const authorId = userIdMap.get(author.id)!;

      posts.push({
        author_id: authorId,
        title: content.title,
        content_blocks: [
          { type: 'text', data: content.content }
        ],
        tags: content.tags || ['general'],
        is_announcement: i === 0,
        engagement_score: Math.random() * 100,
        visibility: 'public',
        reactions_total: Math.floor(Math.random() * 50),
        comment_count: Math.floor(Math.random() * 20),
        view_count: Math.floor(Math.random() * 500),
        image_urls: i % 3 === 0 ? [QUICKIE_IMAGES[i % QUICKIE_IMAGES.length]] : [],
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      });
    }
    await db.collection('posts').insertMany(posts);
    
    // Seed documents - more documents for variety
    console.log('Seeding documents...');
    const documents = [];
    const NUM_DOCS = 25;
    for (let i = 0; i < NUM_DOCS; i++) {
      const doc = DOCUMENT_CONTENTS[i % DOCUMENT_CONTENTS.length]!;
      const author = USERS[i % USERS.length]!;
      const authorId = userIdMap.get(author.id)!;

      documents.push({
        author_id: authorId,
        title: doc.title,
        body: doc.body,
        editors: [authorId],
        category_tags: doc.category_tags,
        version: 1,
        is_published: true,
        view_count: Math.floor(Math.random() * 1000),
        reactions: {
          like: Math.floor(Math.random() * 50),
          insightful: Math.floor(Math.random() * 20),
        },
        comment_count: Math.floor(Math.random() * 15),
        createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      });
    }
    await db.collection('documents').insertMany(documents);
    
    // Seed quickies - more quickies for 50 users
    console.log('Seeding quickies...');
    const quickies = [];
    const NUM_QUICKIES = 60;
    for (let i = 0; i < NUM_QUICKIES; i++) {
      const author = USERS[i % USERS.length]!;
      const authorId = userIdMap.get(author.id)!;

      quickies.push({
        author_id: authorId,
        media_url: QUICKIE_IMAGES[i % QUICKIE_IMAGES.length],
        media_type: 'image',
        caption: Math.random() > 0.5 ? `Quick update from ${author.name}!` : null,
        viewers: USERS.filter(() => Math.random() > 0.7).map(u => userIdMap.get(u.id)!),
        reactions: {
          like: Math.floor(Math.random() * 30),
        },
        notify: true,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      });
    }
    await db.collection('quickies').insertMany(quickies);
    
    // Seed comments on posts
    console.log('Seeding comments...');
    const postDocs = await db.collection('posts').find({}).toArray();
    const comments = [];

    for (const post of postDocs) {
      const numComments = Math.floor(Math.random() * 5);
      for (let i = 0; i < numComments; i++) {
        const commenter = USERS[Math.floor(Math.random() * USERS.length)]!;
        const commenterId = userIdMap.get(commenter.id)!;
        comments.push({
          post_id: post._id.toString(),
          author_id: commenterId,
          content: COMMENTS[Math.floor(Math.random() * COMMENTS.length)],
          parent_id: null,
          reactions: {
            like: Math.floor(Math.random() * 10),
          },
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        });
      }
    }
    if (comments.length > 0) {
      await db.collection('comments').insertMany(comments);
    }
    
    console.log('Database seed completed successfully!');
    console.log(`   - ${USERS.length} users (password: 123456)`);
    console.log(`   - ${profiles.length} profiles`);
    console.log(`   - ${posts.length} posts`);
    console.log(`   - ${documents.length} documents`);
    console.log(`   - ${quickies.length} quickies`);
    console.log(`   - ${comments.length} comments`);
    
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedDatabase();
