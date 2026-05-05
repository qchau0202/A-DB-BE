/**
 * Routes for Code Snippets (NoSQL Document Store)
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createSnippet,
  getSnippetById,
  searchSnippets,
  findSnippetsByTags,
  updateSnippet,
  deleteSnippet,
  addComment,
  getTrendingSnippets,
  getUserSnippetStats,
  likeSnippet,
  initializeSnippetIndexes
} from '../../controller/snippets/snippet.controller';
import { callSupabaseAuth } from '../../controller/auth/auth.controller';

export const snippetsRouter = Router();

console.log('[Routes] Snippets routes loading...');

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

/**
 * POST /api/snippets/init
 * Initialize text indexes (admin only)
 */
snippetsRouter.post('/init', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await initializeSnippetIndexes();
    res.status(200).json({ message: 'Snippet indexes created successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/snippets
 * Create a new code snippet
 */
snippetsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const { title, description, code, language, tags, isPublic, author } = req.body;

    if (!title || !code || !language) {
      return res.status(400).json({ message: 'title, code, and language are required' });
    }

    const snippet = await createSnippet({
      userId,
      title,
      description,
      code,
      language: language.toLowerCase(),
      tags: tags || [],
      isPublic: isPublic !== false,
      author
    });

    res.status(201).json({ snippet });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/snippets/search
 * Full-text search using MongoDB text index
 */
snippetsRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      q: query,
      language,
      tags,
      userId,
      limit = '20',
      skip = '0'
    } = req.query;

    const options: { language?: string; tags?: string[]; userId?: string; isPublic?: boolean; limit?: number; skip?: number } = {};
    if (language) options.language = language as string;
    if (tags) options.tags = (tags as string).split(',');
    if (userId) options.userId = userId as string;
    options.isPublic = true;
    options.limit = parseInt(limit as string) || 20;
    options.skip = parseInt(skip as string) || 0;

    const result = await searchSnippets((query as string) || '', options);

    res.status(200).json({
      snippets: result.snippets,
      total: result.total,
      query: query || '',
      filters: {
        language: options.language,
        tags: options.tags
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/snippets/by-tags
 * Find snippets by tags (array containment)
 */
snippetsRouter.get('/by-tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tags, matchAll = 'false', limit = '20', skip = '0' } = req.query;

    if (!tags) {
      return res.status(400).json({ message: 'tags query parameter is required' });
    }

    const tagArray = (tags as string).split(',') as string[];
    const result = await findSnippetsByTags(
      tagArray,
      matchAll === 'true',
      {
        limit: parseInt(limit as string) || 20,
        skip: parseInt(skip as string) || 0,
        isPublic: true
      }
    );

    res.status(200).json({
      snippets: result.snippets,
      total: result.total,
      tags: tagArray,
      matchAll: matchAll === 'true'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/snippets/trending
 * Get trending snippets using aggregation pipeline
 */
snippetsRouter.get('/trending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const limit = parseInt(req.query.limit as string) || 10;

    const snippets = await getTrendingSnippets(days, limit);

    res.status(200).json({
      snippets,
      period: { days },
      generatedAt: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/snippets/my-stats
 * Get current user's snippet statistics
 */
snippetsRouter.get('/my-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const stats = await getUserSnippetStats(userId);

    res.status(200).json({ stats });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/snippets/:id
 * Get snippet by ID (single document read)
 */
snippetsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const snippet = await getSnippetById(id);

    if (!snippet) {
      return res.status(404).json({ message: 'Snippet not found' });
    }

    // Increment view count
    res.status(200).json({ snippet });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/snippets/:id
 * Update snippet
 */
snippetsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const updates = req.body;

    const snippet = await updateSnippet(id, userId, updates);

    if (!snippet) {
      return res.status(404).json({ message: 'Snippet not found or not authorized' });
    }

    res.status(200).json({ snippet });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/snippets/:id
 * Delete snippet
 */
snippetsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const deleted = await deleteSnippet(id, userId);

    if (!deleted) {
      return res.status(404).json({ message: 'Snippet not found or not authorized' });
    }

    res.status(200).json({ message: 'Snippet deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/snippets/:id/comments
 * Add comment to snippet (embedded sub-document)
 */
snippetsRouter.post('/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const { content, username } = req.body;

    if (!content || !username) {
      return res.status(400).json({ message: 'content and username are required' });
    }

    const snippet = await addComment(id, userId, username, content);

    if (!snippet) {
      return res.status(404).json({ message: 'Snippet not found' });
    }

    res.status(201).json({ snippet });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/snippets/:id/like
 * Like/unlike snippet
 */
snippetsRouter.post('/:id/like', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const { like = true } = req.body;

    const success = await likeSnippet(id, userId, like);

    if (!success) {
      return res.status(404).json({ message: 'Snippet not found' });
    }

    res.status(200).json({ message: like ? 'Snippet liked' : 'Snippet unliked' });
  } catch (error) {
    next(error);
  }
});
