import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { getProfileById, getProfileByUserId, updateProfileById } from '../../controller/profile/profile.controller';
import { followUser, unfollowUser, getFollowers, getFollowing, isFollowing } from '../../controller/profile/follow.controller';
import { callSupabaseAuth } from '../../controller/auth/auth.controller';
import { createFollowNotification } from '../../controller/notifications/notification.controller';

export const profileRouter = Router();

console.log('[Routes] Profile routes loading...');

profileRouter.get('/by-user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    const profile = await getProfileByUserId(userId);

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found for this user' });
    }

    res.status(200).json({ profile });
  } catch (err) {
    next(err);
  }
});

profileRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id) {
      return res.status(400).json({ message: 'Profile ID is required' });
    }
    const profile = await getProfileById(id);

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.status(200).json({ profile });
  } catch (err) {
    next(err);
  }
});

profileRouter.patch('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.header('authorization') ?? req.header('Authorization');
    if (!header) throw new Error('Authorization bearer token is required');

    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new Error('Invalid authorization header');

    let user: Record<string, unknown> | null = null;
    try {
      user = await callSupabaseAuth<Record<string, unknown>>('/user', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const userId = (user && typeof user === 'object' && 'id' in user) ? String((user as any).id) : null;
    if (!userId) return res.status(401).json({ message: 'Unable to resolve user from token' });

    // Find profile by user_id first
    const profile = await getProfileByUserId(userId);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found for this user' });
    }

    const payload = req.body as Record<string, unknown>;
    const updated = await updateProfileById(profile.id as string, payload);

    res.status(200).json({ profile: updated });
  } catch (err) {
    next(err);
  }
});

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

// Follow a user
profileRouter.post('/follow/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const followerId = await getAuthUserId(req);
    if (!followerId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const followingId = req.params.userId as string;
    if (!followingId) {
      return res.status(400).json({ message: 'User ID to follow is required' });
    }

    const result = await followUser(followerId, followingId);

    // Get follower's profile for notification
    const followerProfile = await getProfileByUserId(followerId);
    const followerName = followerProfile?.display_name || 'Someone';

    // Create follow notification
    try {
      await createFollowNotification(followerId, followingId, followerName);
    } catch (notifyErr) {
      console.error('Failed to create follow notification:', notifyErr);
      // Don't fail the follow action if notification fails
    }

    res.status(201).json({ message: 'User followed successfully', follow: result });
  } catch (err) {
    next(err);
  }
});

// Unfollow a user
profileRouter.post('/unfollow/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const followerId = await getAuthUserId(req);
    if (!followerId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const followingId = req.params.userId as string;
    if (!followingId) {
      return res.status(400).json({ message: 'User ID to unfollow is required' });
    }

    await unfollowUser(followerId, followingId);
    res.status(200).json({ message: 'User unfollowed successfully' });
  } catch (err) {
    next(err);
  }
});

// Get followers of a user
profileRouter.get('/:id/followers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id as string;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const followers = await getFollowers(userId);
    res.status(200).json({ followers, count: followers.length });
  } catch (err) {
    next(err);
  }
});

// Get who a user is following
profileRouter.get('/:id/following', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id as string;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const following = await getFollowing(userId);
    res.status(200).json({ following, count: following.length });
  } catch (err) {
    next(err);
  }
});

// Check if current user is following another user
profileRouter.get('/:id/is-following/:targetId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const followerId = req.params.id as string;
    const followingId = req.params.targetId as string;

    if (!followerId || !followingId) {
      return res.status(400).json({ message: 'Both user IDs are required' });
    }

    const following = await isFollowing(followerId, followingId);
    res.status(200).json({ isFollowing: following });
  } catch (err) {
    next(err);
  }
});

export default profileRouter;
