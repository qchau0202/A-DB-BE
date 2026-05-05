import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import {
  createPost,
  getPostById,
  updatePost,
  deletePost,
  getLatestPosts,
  getPopularPosts,
  getActivePosts,
  getPostsByAuthor,
  getPostsByTags,
  getAnnouncements,
  addReaction,
  searchPosts,
} from '../../controller/posts/post.controller';
import { callSupabaseAuth } from '../../controller/auth/auth.controller';

export const postRouter = Router();

console.log('[Routes] Posts routes loading...');

const getAuthUserId = async (req: Request): Promise<string | null> => {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  try {
    const user = await callSupabaseAuth<Record<string, unknown>>('/user', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    return (user && typeof user === 'object' && 'id' in user) ? String((user as any).id) : null;
  } catch {
    return null;
  }
};

// Create post
postRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = await getAuthUserId(req);
    if (!authorId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const payload = req.body as {
      title?: string;
      content_blocks: Array<{ type: 'text' | 'image' | 'code' | 'poll'; data: unknown }>;
      image_urls?: string[];
      tags?: string[];
      is_announcement?: boolean;
      visibility?: 'public' | 'department' | 'private';
      department_id?: number;
    };

    if (!payload.content_blocks || !Array.isArray(payload.content_blocks)) {
      return res.status(400).json({ message: 'content_blocks is required' });
    }

    const post = await createPost({
      author_id: authorId,
      ...payload,
    });

    res.status(201).json({ message: 'Post created', post });
  } catch (err) {
    next(err);
  }
});

// Get latest posts (public feed)
postRouter.get('/feed/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const posts = await getLatestPosts(limit, skip);
    res.status(200).json({ posts, count: posts.length });
  } catch (err) {
    next(err);
  }
});

// Get popular posts (sorted by engagement)
postRouter.get('/feed/popular', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const posts = await getPopularPosts(limit, skip);
    res.status(200).json({ posts, count: posts.length });
  } catch (err) {
    next(err);
  }
});

// Get active posts (recently updated or high activity)
postRouter.get('/feed/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const posts = await getActivePosts(limit, skip);
    res.status(200).json({ posts, count: posts.length });
  } catch (err) {
    next(err);
  }
});

// Get announcements
postRouter.get('/feed/announcements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

    const posts = await getAnnouncements(limit);
    res.status(200).json({ posts, count: posts.length });
  } catch (err) {
    next(err);
  }
});

// Get posts by author
postRouter.get('/author/:authorId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = req.params.authorId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const posts = await getPostsByAuthor(authorId, limit, skip);
    res.status(200).json({ posts, count: posts.length });
  } catch (err) {
    next(err);
  }
});

// Get posts by tags
postRouter.get('/feed/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = (req.query.tags as string)?.split(',').filter(Boolean);
    if (!tags || tags.length === 0) {
      return res.status(400).json({ message: 'tags query parameter is required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const posts = await getPostsByTags(tags, limit, skip);
    res.status(200).json({ posts, count: posts.length });
  } catch (err) {
    next(err);
  }
});

// Search posts
postRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ message: 'q query parameter is required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const posts = await searchPosts(query, limit);
    res.status(200).json({ posts, count: posts.length });
  } catch (err) {
    next(err);
  }
});

// Get post by ID
postRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const post = await getPostById(id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.status(200).json({ post });
  } catch (err) {
    next(err);
  }
});

// Update post
postRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = await getAuthUserId(req);
    if (!authorId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const updates = req.body as {
      title?: string;
      content_blocks?: Array<{ type: 'text' | 'image' | 'code' | 'poll'; data: unknown }>;
      image_urls?: string[];
      tags?: string[];
      is_announcement?: boolean;
      visibility?: 'public' | 'department' | 'private';
      department_id?: number;
    };

    const post = await updatePost(id, authorId, updates);

    if (!post) {
      return res.status(404).json({ message: 'Post not found or not authorized' });
    }

    res.status(200).json({ message: 'Post updated', post });
  } catch (err) {
    next(err);
  }
});

// Delete post
postRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = await getAuthUserId(req);
    if (!authorId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const deleted = await deletePost(id, authorId);

    if (!deleted) {
      return res.status(404).json({ message: 'Post not found or not authorized' });
    }

    res.status(200).json({ message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
});

// Add reaction to post
postRouter.post('/:id/react', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { reaction } = req.body as { reaction: 'like' | 'insightful' | 'celebrate' | 'curious' };

    if (!reaction || !['like', 'insightful', 'celebrate', 'curious'].includes(reaction)) {
      return res.status(400).json({ message: 'Valid reaction type is required' });
    }

    const post = await addReaction(id, reaction);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.status(200).json({ message: 'Reaction added', post });
  } catch (err) {
    next(err);
  }
});

export default postRouter;
