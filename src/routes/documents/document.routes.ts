import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import {
  createDocument,
  getDocumentById,
  getDocumentsByAuthor,
  getPublishedDocuments,
  getDocumentsByTags,
  getChildDocuments,
  updateDocument,
  deleteDocument,
  addReaction,
  incrementViewCount,
  searchDocuments,
} from '../../controller/documents/document.controller';
import { callSupabaseAuth } from '../../controller/auth/auth.controller';

export const documentRouter = Router();

console.log('[Routes] Documents routes loading...');

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

// Create document
// POST /api/documents
// Body: { title, body, parent_doc_id?, category_tags?, is_published? }
documentRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = await getAuthUserId(req);
    if (!authorId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const payload = req.body as {
      title: string;
      body: string;
      parent_doc_id?: string;
      category_tags?: string[];
      is_published?: boolean;
    };

    if (!payload.title || !payload.body) {
      return res.status(400).json({ message: 'title and body are required' });
    }

    const doc = await createDocument({
      author_id: authorId,
      title: payload.title,
      body: payload.body,
      parent_doc_id: payload.parent_doc_id,
      category_tags: payload.category_tags,
      is_published: payload.is_published,
    });

    res.status(201).json({ message: 'Document created', document: doc });
  } catch (err) {
    next(err);
  }
});

// Get published documents feed
// GET /api/documents/feed?limit=20&skip=0
documentRouter.get('/feed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const docs = await getPublishedDocuments(limit, skip);
    res.status(200).json({ documents: docs, count: docs.length });
  } catch (err) {
    next(err);
  }
});

// Get documents by author
// GET /api/documents/author/:authorId?includeDrafts=false&limit=20&skip=0
documentRouter.get('/author/:authorId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = req.params.authorId as string;
    const includeDrafts = req.query.includeDrafts === 'true';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const docs = await getDocumentsByAuthor(authorId, includeDrafts, limit, skip);
    res.status(200).json({ documents: docs, count: docs.length });
  } catch (err) {
    next(err);
  }
});

// Get documents by category tags
// GET /api/documents/tags?tags=tech,db&limit=20&skip=0
documentRouter.get('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = (req.query.tags as string)?.split(',').filter(Boolean);
    if (!tags || tags.length === 0) {
      return res.status(400).json({ message: 'tags query parameter is required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const docs = await getDocumentsByTags(tags, limit, skip);
    res.status(200).json({ documents: docs, count: docs.length });
  } catch (err) {
    next(err);
  }
});

// Get child documents (hierarchical)
// GET /api/documents/:id/children?limit=20&skip=0
documentRouter.get('/:id/children', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const docs = await getChildDocuments(id, limit, skip);
    res.status(200).json({ documents: docs, count: docs.length });
  } catch (err) {
    next(err);
  }
});

// Search documents
// GET /api/documents/search?q=query&limit=20
documentRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ message: 'q query parameter is required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const docs = await searchDocuments(query, limit);
    res.status(200).json({ documents: docs, count: docs.length });
  } catch (err) {
    next(err);
  }
});

// Get document by ID (increments view count)
// GET /api/documents/:id
documentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const doc = await getDocumentById(id);

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Increment view count for published documents
    if (doc.is_published) {
      await incrementViewCount(id);
    }

    res.status(200).json({ document: doc });
  } catch (err) {
    next(err);
  }
});

// Update document with optimistic locking
// PATCH /api/documents/:id
// Body: { title?, body?, parent_doc_id?, category_tags?, is_published?, expected_version }
documentRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const editorId = await getAuthUserId(req);
    if (!editorId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const updates = req.body as {
      title?: string;
      body?: string;
      parent_doc_id?: string | null;
      category_tags?: string[];
      is_published?: boolean;
      expected_version: number;
    };

    if (updates.expected_version === undefined) {
      return res.status(400).json({ message: 'expected_version is required for optimistic locking' });
    }

    const doc = await updateDocument(id, {
      ...updates,
      editor_id: editorId,
      expected_version: updates.expected_version,
    });

    if (!doc) {
      return res.status(409).json({
        message: 'Document update failed. Version mismatch or not authorized.',
      });
    }

    res.status(200).json({ message: 'Document updated', document: doc });
  } catch (err) {
    next(err);
  }
});

// Delete document
// DELETE /api/documents/:id
documentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const deleted = await deleteDocument(id, userId);

    if (!deleted) {
      return res.status(404).json({ message: 'Document not found or not authorized' });
    }

    res.status(200).json({ message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
});

// Add reaction to document
// POST /api/documents/:id/react
// Body: { reaction: 'like' | 'insightful' }
documentRouter.post('/:id/react', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { reaction } = req.body as { reaction: 'like' | 'insightful' };

    if (!reaction || !['like', 'insightful'].includes(reaction)) {
      return res.status(400).json({ message: 'Valid reaction type (like or insightful) is required' });
    }

    const doc = await addReaction(id, reaction);

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.status(200).json({ message: 'Reaction added', document: doc });
  } catch (err) {
    next(err);
  }
});

export default documentRouter;
