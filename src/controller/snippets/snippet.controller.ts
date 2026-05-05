/**
 * NoSQL Document Store for Code Snippets
 * 
 * This controller uses MongoDB to store code snippets with:
 * - Document-based storage (flexible schema)
 * - Text indexes for full-text search on bios and tags
 * - Aggregation pipelines for complex queries
 */

import { ObjectId } from 'mongodb';
import { getMongoDb } from '../../config/mongodb';

// Snippet interface representing a flexible document structure
export interface CodeSnippet {
  _id?: ObjectId;
  userId: string;
  title: string;
  description?: string;
  code: string;
  language: string;
  tags: string[];
  isPublic: boolean;
  likes: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
  // Embedded metadata (denormalized for faster reads)
  author?: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  // Array of embedded comments (demonstrates document nesting)
  comments?: {
    _id: ObjectId;
    userId: string;
    username: string;
    content: string;
    createdAt: Date;
  }[];
  // Version history (embedded sub-documents)
  versions?: {
    version: number;
    code: string;
    createdAt: Date;
  }[];
}

const getSnippetsCollection = () => getMongoDb().collection<CodeSnippet>('snippets');

/**
 * Create text indexes for efficient search
 * 
 * This should be run once during database initialization:
 * 
 * db.snippets.createIndex({ title: "text", description: "text", tags: "text" })
 * db.snippets.createIndex({ tags: 1 })
 * db.snippets.createIndex({ language: 1, isPublic: 1 })
 * db.snippets.createIndex({ userId: 1, createdAt: -1 })
 */
export const initializeSnippetIndexes = async (): Promise<void> => {
  const collection = getSnippetsCollection();

  // Compound text index for full-text search
  await collection.createIndex(
    { title: 'text', description: 'text', tags: 'text' },
    { weights: { title: 10, tags: 5, description: 1 }, name: 'text_search_idx' }
  );

  // Index for tag filtering
  await collection.createIndex({ tags: 1 }, { name: 'tags_idx' });

  // Index for language + visibility filtering
  await collection.createIndex({ language: 1, isPublic: 1 }, { name: 'language_public_idx' });

  // Index for user's snippets sorted by date
  await collection.createIndex({ userId: 1, createdAt: -1 }, { name: 'user_date_idx' });

  // Index for popularity sorting
  await collection.createIndex({ likes: -1, views: -1 }, { name: 'popularity_idx' });

  console.log('[Snippets] Text and field indexes created successfully');
};

/**
 * Create a new code snippet
 * Demonstrates document insertion with nested sub-documents
 */
export const createSnippet = async (payload: Omit<CodeSnippet, '_id' | 'createdAt' | 'updatedAt' | 'likes' | 'views'>): Promise<CodeSnippet> => {
  const collection = getSnippetsCollection();

  const now = new Date();
  const snippet: Omit<CodeSnippet, '_id'> = {
    ...payload,
    likes: 0,
    views: 0,
    createdAt: now,
    updatedAt: now,
    versions: [{
      version: 1,
      code: payload.code,
      createdAt: now
    }]
  };

  const result = await collection.insertOne(snippet as CodeSnippet);
  return { _id: result.insertedId, ...snippet };
};

/**
 * Full-text search using text index
 * 
 * MongoDB Text Index Benefits:
 * - Searches across multiple fields simultaneously
 * - Supports stemming (finds "run" when searching "running")
 * - Relevance scoring with $meta: "textScore"
 * - Case-insensitive by default
 */
export const searchSnippets = async (
  query: string,
  options: {
    language?: string;
    tags?: string[];
    userId?: string;
    isPublic?: boolean;
    limit?: number;
    skip?: number;
  } = {}
): Promise<{ snippets: CodeSnippet[]; total: number }> => {
  const collection = getSnippetsCollection();
  const { language, tags, userId, isPublic = true, limit = 20, skip = 0 } = options;

  // Build search pipeline
  const pipeline: any[] = [];

  // Text search stage using $text operator
  if (query && query.trim()) {
    pipeline.push({
      $match: {
        $text: { $search: query },
        ...(isPublic !== undefined && { isPublic })
      }
    });

    // Add relevance score
    pipeline.push({
      $addFields: {
        searchScore: { $meta: 'textScore' }
      }
    });
  } else {
    // No text query - just filter by visibility
    pipeline.push({
      $match: { isPublic }
    });
  }

  // Additional filters
  const filterStage: any = {};
  if (language) filterStage.language = language;
  if (tags && tags.length > 0) filterStage.tags = { $in: tags };
  if (userId) filterStage.userId = userId;

  if (Object.keys(filterStage).length > 0) {
    pipeline.push({ $match: filterStage });
  }

  // Count total before pagination
  const countPipeline = [...pipeline, { $count: 'total' }];
  const countResult = await collection.aggregate(countPipeline).toArray();
  const total = countResult[0]?.total || 0;

  // Sort by relevance (if text search) or by date
  if (query && query.trim()) {
    pipeline.push({ $sort: { searchScore: -1, createdAt: -1 } });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  // Pagination
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  const snippets = await collection.aggregate<CodeSnippet>(pipeline).toArray();

  return { snippets, total };
};

/**
 * Find snippets by tags (array containment query)
 * Demonstrates NoSQL array operations
 */
export const findSnippetsByTags = async (
  tags: string[],
  matchAll: boolean = false,
  options: { limit?: number; skip?: number; isPublic?: boolean } = {}
): Promise<{ snippets: CodeSnippet[]; total: number }> => {
  const collection = getSnippetsCollection();
  const { limit = 20, skip = 0, isPublic = true } = options;

  // Build tag query
  const tagQuery = matchAll
    ? { $all: tags }  // Must contain ALL tags
    : { $in: tags };  // Must contain ANY tag

  const query = {
    tags: tagQuery,
    isPublic
  };

  const [snippets, total] = await Promise.all([
    collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(query)
  ]);

  return { snippets, total };
};

/**
 * Get snippet by ID with embedded comments
 * Demonstrates single document read (vs SQL JOINs)
 */
export const getSnippetById = async (id: string): Promise<CodeSnippet | null> => {
  if (!ObjectId.isValid(id)) return null;

  const collection = getSnippetsCollection();

  // Single document read - no JOINs needed!
  // All related data is embedded in the document
  const snippet = await collection.findOne({ _id: new ObjectId(id) });

  if (snippet) {
    // Increment view count atomically
    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { views: 1 } }
    );
  }

  return snippet;
};

/**
 * Add comment to snippet (embedded sub-document)
 * Demonstrates nested array operations in NoSQL
 */
export const addComment = async (
  snippetId: string,
  userId: string,
  username: string,
  content: string
): Promise<CodeSnippet | null> => {
  if (!ObjectId.isValid(snippetId)) return null;

  const collection = getSnippetsCollection();

  const comment = {
    _id: new ObjectId(),
    userId,
    username,
    content,
    createdAt: new Date()
  };

  // $push operator adds to embedded array
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(snippetId) },
    {
      $push: { comments: comment },
      $set: { updatedAt: new Date() }
    },
    { returnDocument: 'after' }
  );

  return result;
};

/**
 * Update snippet with version history tracking
 * Demonstrates embedded version arrays
 */
export const updateSnippet = async (
  id: string,
  userId: string,
  updates: Partial<Pick<CodeSnippet, 'title' | 'description' | 'code' | 'tags' | 'isPublic'>>
): Promise<CodeSnippet | null> => {
  if (!ObjectId.isValid(id)) return null;

  const collection = getSnippetsCollection();

  const updateDoc: any = {
    $set: {
      updatedAt: new Date()
    }
  };

  // If code changed, add to version history
  if (updates.code) {
    const snippet = await collection.findOne({ _id: new ObjectId(id), userId });
    if (snippet) {
      const newVersion = (snippet.versions?.length || 0) + 1;
      updateDoc.$push = {
        versions: {
          version: newVersion,
          code: updates.code,
          createdAt: new Date()
        }
      };
    }
  }

  // Apply other updates
  Object.keys(updates).forEach(key => {
    if (updates[key as keyof typeof updates] !== undefined) {
      updateDoc.$set[key] = updates[key as keyof typeof updates];
    }
  });

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id), userId },
    updateDoc,
    { returnDocument: 'after' }
  );

  return result;
};

/**
 * Aggregation pipeline for trending snippets
 * Demonstrates NoSQL aggregation capabilities
 */
export const getTrendingSnippets = async (
  days: number = 7,
  limit: number = 10
): Promise<CodeSnippet[]> => {
  const collection = getSnippetsCollection();

  const since = new Date();
  since.setDate(since.getDate() - days);

  const pipeline = [
    // Match public snippets from recent days
    {
      $match: {
        isPublic: true,
        createdAt: { $gte: since }
      }
    },
    // Calculate trending score: (likes * 2 + views) / hours_since_creation
    {
      $addFields: {
        hoursSinceCreation: {
          $divide: [
            { $subtract: [new Date(), '$createdAt'] },
            1000 * 60 * 60 // Convert ms to hours
          ]
        }
      }
    },
    {
      $addFields: {
        trendingScore: {
          $cond: {
            if: { $eq: ['$hoursSinceCreation', 0] },
            then: { $add: [{ $multiply: ['$likes', 2] }, '$views'] },
            else: {
              $divide: [
                { $add: [{ $multiply: ['$likes', 2] }, '$views'] },
                { $max: ['$hoursSinceCreation', 1] }
              ]
            }
          }
        }
      }
    },
    // Sort by trending score
    { $sort: { trendingScore: -1 } },
    { $limit: limit }
  ];

  return collection.aggregate<CodeSnippet>(pipeline).toArray();
};

/**
 * Get user's snippet statistics
 * Demonstrates NoSQL aggregation for analytics
 */
export const getUserSnippetStats = async (userId: string): Promise<{
  totalSnippets: number;
  publicSnippets: number;
  totalViews: number;
  totalLikes: number;
  topLanguages: { language: string; count: number }[];
  topTags: { tag: string; count: number }[];
}> => {
  const collection = getSnippetsCollection();

  const [totalStats] = await collection
    .aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalSnippets: { $sum: 1 },
          publicSnippets: {
            $sum: { $cond: ['$isPublic', 1, 0] }
          },
          totalViews: { $sum: '$views' },
          totalLikes: { $sum: '$likes' }
        }
      }
    ])
    .toArray();

  // Get top languages
  const topLanguages = await collection
    .aggregate([
      { $match: { userId } },
      { $group: { _id: '$language', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, language: '$_id', count: 1 } }
    ])
    .toArray();

  // Get top tags using $unwind
  const topTags = await collection
    .aggregate([
      { $match: { userId } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, tag: '$_id', count: 1 } }
    ])
    .toArray();

  return {
    totalSnippets: totalStats?.totalSnippets || 0,
    publicSnippets: totalStats?.publicSnippets || 0,
    totalViews: totalStats?.totalViews || 0,
    totalLikes: totalStats?.totalLikes || 0,
    topLanguages: topLanguages as any,
    topTags: topTags as any
  };
};

/**
 * Delete snippet
 */
export const deleteSnippet = async (id: string, userId: string): Promise<boolean> => {
  if (!ObjectId.isValid(id)) return false;

  const collection = getSnippetsCollection();
  const result = await collection.deleteOne({
    _id: new ObjectId(id),
    userId
  });

  return result.deletedCount > 0;
};

/**
 * Like/unlike snippet (atomic operation)
 */
export const likeSnippet = async (
  snippetId: string,
  userId: string,
  like: boolean = true
): Promise<boolean> => {
  if (!ObjectId.isValid(snippetId)) return false;

  const collection = getSnippetsCollection();

  const result = await collection.updateOne(
    { _id: new ObjectId(snippetId) },
    {
      $inc: { likes: like ? 1 : -1 }
    }
  );

  return result.modifiedCount > 0;
};
