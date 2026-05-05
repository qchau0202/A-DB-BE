/**
 * Routes for Post Ranking with Window Functions
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getTrendingPosts,
  getPostsWithRankChange,
  getUserLeaderboard,
  getEngagementMovingAverages,
  getPostsByCategory
} from '../../controller/posts/post-ranking.controller';
import { callSupabaseAuth } from '../../controller/auth/auth.controller';

export const rankingRouter = Router();

console.log('[Routes] Ranking routes loading...');

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
 * GET /api/ranking/trending
 * Get trending posts using window function-based ranking
 */
rankingRouter.get('/trending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await getTrendingPosts(days, limit);

    res.status(200).json({
      posts: result.posts,
      window: {
        start: result.windowStart,
        end: result.windowEnd,
        days
      },
      generatedAt: result.generatedAt
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ranking/trending-with-change
 * Get trending posts with day-over-day rank changes (demonstrates LAG window function)
 */
rankingRouter.get('/trending-with-change', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;

    const posts = await getPostsWithRankChange(days);

    res.status(200).json({
      posts,
      days,
      generatedAt: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ranking/leaderboard
 * Get user leaderboard with NTILE bucketing
 */
rankingRouter.get('/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const buckets = parseInt(req.query.buckets as string) || 10;

    const users = await getUserLeaderboard(days, buckets);

    res.status(200).json({
      users,
      period: { days },
      buckets,
      generatedAt: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ranking/engagement-averages
 * Get moving averages for engagement metrics (demonstrates AVG() OVER)
 */
rankingRouter.get('/engagement-averages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const windowSize = parseInt(req.query.window as string) || 7;

    const averages = await getEngagementMovingAverages(days, windowSize);

    res.status(200).json({
      data: averages,
      windowSize,
      generatedAt: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ranking/by-category
 * Get posts ranked within categories (demonstrates PARTITION BY)
 */
rankingRouter.get('/by-category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;

    const categoriesMap = await getPostsByCategory(days);

    // Convert Map to object for JSON response
    const categories: Record<string, any> = {};
    categoriesMap.forEach((posts, category) => {
      categories[category] = posts;
    });

    res.status(200).json({
      categories,
      categoryCount: categoriesMap.size,
      days,
      generatedAt: new Date()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ranking/my-rank
 * Get current user's rank and statistics
 */
rankingRouter.get('/my-rank', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const users = await getUserLeaderboard(days);

    const userRank = users.find(u => u.userId === userId);

    if (!userRank) {
      return res.status(404).json({ message: 'User not found in leaderboard' });
    }

    res.status(200).json({
      rank: userRank,
      totalUsers: users.length,
      percentile: userRank.percentileLabel,
      period: { days }
    });
  } catch (error) {
    next(error);
  }
});
