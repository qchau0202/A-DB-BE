import { ObjectId } from 'mongodb';
import { getMongoDb } from '../../config/mongodb';

type ContentBlock = {
  type: 'text' | 'image' | 'code' | 'poll';
  data: unknown;
};

type PostPayload = {
  author_id: string;
  title?: string;
  content_blocks: ContentBlock[];
  image_urls?: string[];
  tags?: string[];
  is_announcement?: boolean;
  visibility?: 'public' | 'department' | 'private';
  department_id?: number;
};

const getPostsCollection = () => getMongoDb().collection('posts');

export const createPost = async (payload: PostPayload) => {
  const now = new Date();
  const post = {
    author_id: payload.author_id,
    title: payload.title ?? '',
    content_blocks: payload.content_blocks,
    image_urls: payload.image_urls ?? [],
    tags: payload.tags ?? [],
    is_announcement: payload.is_announcement ?? false,
    visibility: payload.visibility ?? 'public',
    department_id: payload.department_id ?? null,
    reactions: { like: 0, insightful: 0, celebrate: 0, curious: 0 },
    reactions_total: 0,
    view_count: 0,
    comment_count: 0,
    engagement_score: 0,
    createdAt: now,
    updatedAt: now,
  };

  const result = await getPostsCollection().insertOne(post);
  return { _id: result.insertedId, ...post };
};

export const getPostById = async (id: string) => {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid post ID');
  }

  const post = await getPostsCollection().findOne({ _id: new ObjectId(id) });
  return post ?? null;
};

export const updatePost = async (id: string, authorId: string, updates: Partial<PostPayload>) => {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid post ID');
  }

  const allowedUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) allowedUpdates.title = updates.title;
  if (updates.content_blocks !== undefined) allowedUpdates.content_blocks = updates.content_blocks;
  if (updates.image_urls !== undefined) allowedUpdates.image_urls = updates.image_urls;
  if (updates.tags !== undefined) allowedUpdates.tags = updates.tags;
  if (updates.is_announcement !== undefined) allowedUpdates.is_announcement = updates.is_announcement;
  if (updates.visibility !== undefined) allowedUpdates.visibility = updates.visibility;
  if (updates.department_id !== undefined) allowedUpdates.department_id = updates.department_id;

  if (Object.keys(allowedUpdates).length === 0) {
    throw new Error('No valid fields to update');
  }

  allowedUpdates.updatedAt = new Date();

  const result = await getPostsCollection().findOneAndUpdate(
    { _id: new ObjectId(id), author_id: authorId },
    { $set: allowedUpdates },
    { returnDocument: 'after' }
  );

  return result ?? null;
};

export const deletePost = async (id: string, authorId: string) => {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid post ID');
  }

  const result = await getPostsCollection().deleteOne({
    _id: new ObjectId(id),
    author_id: authorId,
  });

  return result.deletedCount === 1;
};

// Feeds
export const getLatestPosts = async (limit = 20, skip = 0) => {
  const posts = await getPostsCollection()
    .find({ visibility: 'public' })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return posts;
};

export const getPostsByAuthor = async (authorId: string, limit = 20, skip = 0) => {
  const posts = await getPostsCollection()
    .find({ author_id: authorId, visibility: { $in: ['public', 'department'] } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return posts;
};

export const getPostsByTags = async (tags: string[], limit = 20, skip = 0) => {
  const posts = await getPostsCollection()
    .find({ tags: { $in: tags }, visibility: 'public' })
    .sort({ engagement_score: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return posts;
};

export const getAnnouncements = async (limit = 10) => {
  const posts = await getPostsCollection()
    .find({ is_announcement: true, visibility: 'public' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return posts;
};

// Reactions
export const addReaction = async (postId: string, reactionType: 'like' | 'insightful' | 'celebrate' | 'curious') => {
  if (!ObjectId.isValid(postId)) {
    throw new Error('Invalid post ID');
  }

  const updateField = `reactions.${reactionType}`;

  const result = await getPostsCollection().findOneAndUpdate(
    { _id: new ObjectId(postId) },
    {
      $inc: {
        [updateField]: 1,
        reactions_total: 1,
      },
    },
    { returnDocument: 'after' }
  );

  return result ?? null;
};

// Search
export const searchPosts = async (query: string, limit = 20) => {
  const posts = await getPostsCollection()
    .find(
      { $text: { $search: query }, visibility: 'public' },
      { projection: { score: { $meta: 'textScore' } } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .toArray();

  return posts;
};

export default {
  createPost,
  getPostById,
  updatePost,
  deletePost,
  getLatestPosts,
  getPostsByAuthor,
  getPostsByTags,
  getAnnouncements,
  addReaction,
  searchPosts,
};
