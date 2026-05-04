import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import {
  createComment,
  getCommentById,
  getCommentsByTarget,
  getReplies,
  updateComment,
  deleteComment,
} from '../../controller/comments/comment.controller';
import { callSupabaseAuth } from '../../controller/auth/auth.controller';

export const commentRouter = Router();

console.log('[Routes] Comments routes loading...');

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

// Create comment on a post
commentRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = await getAuthUserId(req);
    if (!authorId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const payload = req.body as {
      target_id: string;
      parent_comment_id?: string;
      content: string;
    };

    if (!payload.target_id || !payload.content) {
      return res.status(400).json({ message: 'target_id and content are required' });
    }

    const comment = await createComment({
      target_id: payload.target_id,
      parent_comment_id: payload.parent_comment_id || null,
      author_id: authorId,
      content: payload.content,
    });

    res.status(201).json({ message: 'Comment created', comment });
  } catch (err) {
    next(err);
  }
});

// Get comments for a post (top-level only)
commentRouter.get('/post/:postId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const postId = req.params.postId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const comments = await getCommentsByTarget(postId, null, limit, skip);
    res.status(200).json({ comments, count: comments.length });
  } catch (err) {
    next(err);
  }
});

// Get all comments for a post (including replies, or filter by parent)
commentRouter.get('/target/:targetId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetId = req.params.targetId as string;
    const parentId = req.query.parent_id as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const comments = await getCommentsByTarget(targetId, parentId ?? null, limit, skip);
    res.status(200).json({ comments, count: comments.length });
  } catch (err) {
    next(err);
  }
});

// Get replies to a comment
commentRouter.get('/:commentId/replies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commentId = req.params.commentId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const replies = await getReplies(commentId, limit, skip);
    res.status(200).json({ replies, count: replies.length });
  } catch (err) {
    next(err);
  }
});

// Get comment by ID
commentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const comment = await getCommentById(id);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.status(200).json({ comment });
  } catch (err) {
    next(err);
  }
});

// Update comment
commentRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = await getAuthUserId(req);
    if (!authorId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const { content } = req.body as { content: string };

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'content is required' });
    }

    const comment = await updateComment(id, authorId, content);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found or not authorized' });
    }

    res.status(200).json({ message: 'Comment updated', comment });
  } catch (err) {
    next(err);
  }
});

// Delete comment (soft delete)
commentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = await getAuthUserId(req);
    if (!authorId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const deleted = await deleteComment(id, authorId);

    if (!deleted) {
      return res.status(404).json({ message: 'Comment not found or not authorized' });
    }

    res.status(200).json({ message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
});

export default commentRouter;
