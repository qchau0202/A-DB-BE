/* eslint-disable no-console */
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config();

const mongodbUri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DB_NAME || 'devconnect';

if (!mongodbUri) {
  throw new Error('Missing MONGODB_URI in environment variables.');
}

const collectionSpecs = [
  {
    name: 'posts',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['author_id', 'content_blocks', 'is_announcement', 'engagement_score', 'visibility', 'createdAt'],
        properties: {
          author_id: { bsonType: 'string' },
          title: { bsonType: 'string' },
          content_blocks: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['type', 'data'],
              properties: {
                type: { enum: ['text', 'image', 'code', 'poll'] },
                data: {},
              },
            },
          },
          tags: { bsonType: ['array', 'null'], items: { bsonType: 'string' } },
          is_announcement: { bsonType: 'bool' },
          engagement_score: { bsonType: ['double', 'int', 'long', 'decimal'] },
          visibility: { enum: ['public', 'department', 'private'] },
          reactions_total: { bsonType: ['int', 'long', 'double', 'decimal', 'null'] },
          comment_count: { bsonType: ['int', 'long', 'double', 'decimal', 'null'] },
          view_count: { bsonType: ['int', 'long', 'double', 'decimal', 'null'] },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: ['date', 'null'] },
        },
      },
    },
    indexes: [
      { key: { createdAt: -1 }, options: { name: 'createdAt_idx' } },
      { key: { author_id: 1, createdAt: -1 }, options: { name: 'following_idx' } },
      { key: { tags: 1, engagement_score: -1 }, options: { name: 'tags_engagement_idx' } },
      { key: { is_announcement: 1 }, options: { name: 'announcement_sparse_idx', sparse: true } },
      {
        key: { title: 'text', 'content_blocks.data': 'text', tags: 'text' },
        options: {
          name: 'posts_search',
          weights: {
            title: 10,
            'content_blocks.data': 5,
            tags: 2,
          },
        },
      },
    ],
    notes: [
      'Atlas Search index definitions must still be created in Atlas UI if you want native search analyzers; the text index above is the driver-managed fallback.',
    ],
  },
  {
    name: 'documents',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['author_id', 'title', 'body', 'version', 'is_published', 'createdAt'],
        properties: {
          author_id: { bsonType: 'string' },
          editors: {
            bsonType: ['array', 'null'],
            items: { bsonType: 'string' },
          },
          title: { bsonType: 'string' },
          body: { bsonType: 'string' },
          parent_doc_id: { bsonType: ['objectId', 'null'] },
          category_tags: {
            bsonType: ['array', 'null'],
            items: { bsonType: 'string' },
          },
          version: { bsonType: 'int', minimum: 0 },
          is_published: { bsonType: 'bool' },
          view_count: { bsonType: ['int', 'long'], minimum: 0 },
          reactions: {
            bsonType: 'object',
            properties: {
              like: { bsonType: ['int', 'long'], minimum: 0 },
              insightful: { bsonType: ['int', 'long'], minimum: 0 },
            },
          },
          comment_count: { bsonType: ['int', 'long'], minimum: 0 },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: ['date', 'null'] },
        },
      },
    },
    indexes: [
      { key: { author_id: 1, createdAt: -1 }, options: { name: 'author_createdAt_idx' } },
      { key: { parent_doc_id: 1 }, options: { name: 'parent_doc_idx' } },
      { key: { category_tags: 1 }, options: { name: 'category_tags_idx' } },
      { key: { is_published: 1, createdAt: -1 }, options: { name: 'published_feed_idx' } },
      {
        key: { title: 'text', body: 'text' },
        options: {
          name: 'documents_search',
          weights: { title: 10, body: 5 },
        },
      },
    ],
    notes: [
      'Atlas Search index for title and body should be created in Atlas UI.',
      'version field is for optimistic locking - reject writes if version mismatches.',
      'parent_doc_id enables hierarchical document structure.',
      'editors array tracks users who have edited this document.',
      'view_count is batch-updated via Redis + $inc.',
    ],
  },
  {
    name: 'quickies',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['author_id', 'media_url', 'media_type', 'notify', 'createdAt'],
        properties: {
          author_id: { bsonType: 'string' },
          media_url: { bsonType: 'string' },
          media_type: { enum: ['image', 'video'] },
          caption: { bsonType: ['string', 'null'] },
          viewers: {
            bsonType: ['array', 'null'],
            items: { bsonType: 'string' },
          },
          reactions: {
            bsonType: 'object',
            properties: {
              like: { bsonType: ['int', 'long'], minimum: 0 },
            },
          },
          notify: { bsonType: 'bool' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: ['date', 'null'] },
        },
      },
    },
    indexes: [
      { key: { author_id: 1, createdAt: -1 }, options: { name: 'author_createdAt_idx' } },
      { key: { createdAt: 1 }, options: { name: 'ttl_idx', expireAfterSeconds: 86400 } },
    ],
    notes: [
      'Ephemeral stories expire automatically after 24 hours.',
      'media_type guides frontend renderer (image|video).',
      'viewers array tracks UUIDs who have seen this quickie.',
      'reactions.like is a lightweight single reaction type.',
      'notify is always false to suppress push notifications.',
    ],
  },
  {
    name: 'comments',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['target_id', 'content', 'is_deleted', 'createdAt'],
        properties: {
          target_id: { bsonType: 'objectId' },
          parent_comment_id: { bsonType: ['objectId', 'null'] },
          author_id: { bsonType: ['string', 'null'] },
          content: { bsonType: 'string' },
          is_deleted: { bsonType: 'bool' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: ['date', 'null'] },
        },
      },
    },
    indexes: [
      { key: { target_id: 1, createdAt: 1 }, options: { name: 'target_createdAt_idx' } },
      { key: { parent_comment_id: 1 }, options: { name: 'parent_comment_idx' } },
    ],
    notes: [
      'Soft deletes should replace the comment body with [removed] in application logic.',
    ],
  },
  {
    name: 'notifications',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['recipient_id', 'sender_id', 'type', 'title', 'is_read', 'createdAt'],
        properties: {
          recipient_id: { bsonType: 'string' },
          sender_id: { bsonType: 'string' },
          type: { enum: ['follow', 'post_like', 'post_comment', 'quickie_view', 'quickie_react', 'document_like', 'mention'] },
          title: { bsonType: 'string' },
          body: { bsonType: ['string', 'null'] },
          target_id: { bsonType: ['string', 'null'] },
          target_type: { enum: ['post', 'comment', 'quickie', 'document', null] },
          is_read: { bsonType: 'bool' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: ['date', 'null'] },
        },
      },
    },
    indexes: [
      { key: { recipient_id: 1, is_read: 1, createdAt: -1 }, options: { name: 'recipient_unread_idx' } },
      { key: { recipient_id: 1, createdAt: -1 }, options: { name: 'recipient_feed_idx' } },
      { key: { sender_id: 1, createdAt: -1 }, options: { name: 'sender_idx' } },
      { key: { target_id: 1, type: 1 }, options: { name: 'target_type_idx' } },
    ],
    notes: [
      'recipient_id: UUID of the user receiving the notification',
      'sender_id: UUID of the user who triggered the notification',
      'target_id: Optional ID of the related entity (post, comment, etc.)',
      'target_type: Type of the related entity for context',
      'is_read: Boolean flag to track read status',
    ],
  },
];

async function ensureCollection(db, spec) {
  const existing = await db.listCollections({ name: spec.name }).toArray();

  if (!existing.length) {
    await db.createCollection(spec.name, {
      validator: spec.validator,
      validationLevel: 'moderate',
    });
    console.log(`Created collection: ${spec.name}`);
  } else {
    await db.command({
      collMod: spec.name,
      validator: spec.validator,
      validationLevel: 'moderate',
    });
    console.log(`Updated validator: ${spec.name}`);
  }

  for (const index of spec.indexes) {
    await db.collection(spec.name).createIndex(index.key, index.options);
  }

  for (const note of spec.notes || []) {
    console.log(`${spec.name}: ${note}`);
  }

  console.log(`Ensured indexes: ${spec.name}`);
}

async function run() {
  const client = new MongoClient(mongodbUri);

  try {
    await client.connect();
    const db = client.db(dbName);

    for (const spec of collectionSpecs) {
      await ensureCollection(db, spec);
    }

    console.log(`MongoDB setup complete for database: ${dbName}`);
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error('MongoDB setup failed:', error.message);
  process.exit(1);
});
