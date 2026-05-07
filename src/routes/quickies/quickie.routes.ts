import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import {
  createQuickie,
  getQuickieById,
  getQuickiesByAuthor,
  getFeedQuickies,
  getLatestQuickies,
  updateQuickie,
  deleteQuickie,
  addViewerToQuickie,
  addReactionToQuickie,
} from '../../controller/quickies/quickie.controller';
import { callSupabaseAuth } from '../../controller/auth/auth.controller';
import { getProfileByUserId } from '../../controller/profile/profile.controller';

export const quickieRouter = Router();

console.log('[Routes] Quickies routes loading...');

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

// Create quickie (story)
quickieRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = await getAuthUserId(req);
    if (!authorId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const payload = req.body as {
      media_url: string;
      media_type: 'image' | 'video';
      caption?: string;
      notify?: boolean;
    };

    if (!payload.media_url) {
      return res.status(400).json({ message: 'media_url is required' });
    }

    if (!payload.media_type || !['image', 'video'].includes(payload.media_type)) {
      return res.status(400).json({ message: 'media_type must be image or video' });
    }

    const quickie = await createQuickie({
      author_id: authorId,
      media_url: payload.media_url,
      media_type: payload.media_type,
      caption: payload.caption,
      notify: payload.notify ?? false,
    });

    res.status(201).json({ message: 'Quickie created', quickie });
  } catch (err) {
    next(err);
  }
});

// Get latest quickies (public feed - all recent) - MUST be before /:id
quickieRouter.get('/feed/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const quickies = await getLatestQuickies(limit, skip);
    res.status(200).json({ quickies, count: quickies.length });
  } catch (err) {
    next(err);
  }
});

// Get feed quickies (from users you follow) - MUST be before /:id
quickieRouter.get('/feed/following', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    // Get following list from profile
    const profile = await getProfileByUserId(userId);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const following = (profile.following as string[]) || [];
    if (following.length === 0) {
      return res.status(200).json({ quickies: [], count: 0, message: 'Follow users to see their quickies' });
    }

    // Include own quickies in feed
    const authorIds = [userId, ...following];

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const quickies = await getFeedQuickies(authorIds, limit, skip);
    res.status(200).json({ quickies, count: quickies.length });
  } catch (err) {
    next(err);
  }
});

// Get quickies by author - MUST be before /:id
quickieRouter.get('/author/:authorId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = req.params.authorId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = parseInt(req.query.skip as string) || 0;

    const quickies = await getQuickiesByAuthor(authorId, limit, skip);
    res.status(200).json({ quickies, count: quickies.length });
  } catch (err) {
    next(err);
  }
});

// Get quickie by ID - MUST be AFTER specific routes like /feed/*, /author/*
quickieRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const viewerId = await getAuthUserId(req);

    const quickie = await getQuickieById(id);

    if (!quickie) {
      return res.status(404).json({ message: 'Quickie not found or expired' });
    }

    // Track viewer if authenticated and not the author
    if (viewerId && viewerId !== quickie.author_id) {
      await addViewerToQuickie(id, viewerId);
    }

    res.status(200).json({ quickie });
  } catch (err) {
    next(err);
  }
});

// Mark quickie as viewed (explicit view tracking)
quickieRouter.post('/:id/view', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const viewerId = await getAuthUserId(req);
    if (!viewerId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const quickie = await getQuickieById(id);

    if (!quickie) {
      return res.status(404).json({ message: 'Quickie not found or expired' });
    }

    // Don't add author as viewer of their own quickie
    if (viewerId === quickie.author_id) {
      return res.status(200).json({ message: 'Cannot view own quickie', quickie });
    }

    const updated = await addViewerToQuickie(id, viewerId);
    res.status(200).json({ message: 'Quickie viewed', quickie: updated });
  } catch (err) {
    next(err);
  }
});

// React to quickie
quickieRouter.post('/:id/react', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const quickie = await addReactionToQuickie(id, userId);

    if (!quickie) {
      return res.status(404).json({ message: 'Quickie not found or expired' });
    }

    res.status(200).json({ message: 'Reaction added', quickie });
  } catch (err) {
    next(err);
  }
});

// Update quickie
quickieRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = await getAuthUserId(req);
    if (!authorId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const updates = req.body as {
      media_url?: string;
      media_type?: 'image' | 'video';
      caption?: string;
    };

    const quickie = await updateQuickie(id, authorId, updates);

    if (!quickie) {
      return res.status(404).json({ message: 'Quickie not found or not authorized' });
    }

    res.status(200).json({ message: 'Quickie updated', quickie });
  } catch (err) {
    next(err);
  }
});

// Delete quickie
quickieRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorId = await getAuthUserId(req);
    if (!authorId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const id = req.params.id as string;
    const deleted = await deleteQuickie(id, authorId);

    if (!deleted) {
      return res.status(404).json({ message: 'Quickie not found or not authorized' });
    }

    res.status(200).json({ message: 'Quickie deleted' });
  } catch (err) {
    next(err);
  }
});

export default quickieRouter;
