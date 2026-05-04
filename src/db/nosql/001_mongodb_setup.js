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
        required: ['version', 'is_published', 'createdAt'],
        properties: {
          parent_doc_id: { bsonType: ['objectId', 'null'] },
          title: { bsonType: 'string' },
          slug: { bsonType: ['string', 'null'] },
          body_blocks: {
            bsonType: ['array', 'null'],
            items: {
              bsonType: 'object',
            },
          },
          version: { bsonType: 'int', minimum: 0 },
          is_published: { bsonType: 'bool' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: ['date', 'null'] },
        },
      },
    },
    indexes: [
      { key: { parent_doc_id: 1, version: -1 }, options: { name: 'parent_version_idx' } },
      { key: { is_published: 1, createdAt: -1 }, options: { name: 'published_feed_idx' } },
    ],
    notes: [
      'Recursive traversal is handled at query time with $graphLookup up to 5 levels deep.',
    ],
  },
  {
    name: 'quickies',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['media_url', 'createdAt'],
        properties: {
          author_id: { bsonType: ['string', 'null'] },
          media_url: { bsonType: 'string' },
          caption: { bsonType: ['string', 'null'] },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: ['date', 'null'] },
        },
      },
    },
    indexes: [
      { key: { createdAt: 1 }, options: { name: 'ttl_idx', expireAfterSeconds: 86400 } },
    ],
    notes: [
      'Ephemeral stories expire automatically after 24 hours.',
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
    name: 'userReactions',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['user_id', 'target_id', 'target_type', 'createdAt'],
        properties: {
          user_id: { bsonType: 'string' },
          target_id: { bsonType: 'objectId' },
          target_type: { enum: ['post', 'document', 'comment', 'quickie'] },
          reaction_type: { bsonType: ['string', 'null'] },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: ['date', 'null'] },
        },
      },
    },
    indexes: [
      { key: { user_id: 1, target_id: 1, target_type: 1 }, options: { name: 'unique_rxn', unique: true } },
      { key: { target_id: 1, createdAt: -1 }, options: { name: 'reaction_target_idx' } },
    ],
    notes: [
      'Use the toggle pattern: insert reaction, increment the target counter, and on duplicate delete the reaction and decrement the counter.',
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
