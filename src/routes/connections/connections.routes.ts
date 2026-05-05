/**
 * Routes for Mutual Connections (Recursive CTE)
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  findMutualConnections,
  findConnectionPath,
  getNetworkStats
} from '../../controller/profile/mutual-connections.controller';
import { callSupabaseAuth } from '../../controller/auth/auth.controller';

export const connectionsRouter = Router();

console.log('[Routes] Connections routes loading...');

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
 * GET /api/connections/mutual
 * Find mutual connections up to 3rd degree using Recursive CTE
 */
connectionsRouter.get('/mutual', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const maxDegree = Math.min(parseInt(req.query.degree as string) || 3, 3);

    const connections = await findMutualConnections(userId, maxDegree);

    // Group by degree for easier consumption
    const byDegree = {
      first: connections.filter(c => c.degree === 1),
      second: connections.filter(c => c.degree === 2),
      third: connections.filter(c => c.degree === 3)
    };

    res.status(200).json({
      connections,
      byDegree,
      summary: {
        total: connections.length,
        firstDegree: byDegree.first.length,
        secondDegree: byDegree.second.length,
        thirdDegree: byDegree.third.length,
        maxDegree
      },
      explanation: {
        first: 'Direct follows (people you follow)',
        second: 'Friends of friends (1 hop away)',
        third: 'Extended network (2 hops away)'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/connections/path/:userId
 * Find the shortest connection path between current user and target user
 */
connectionsRouter.get('/path/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = await getAuthUserId(req);
    if (!currentUserId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const targetUserId = req.params.userId as string;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ message: 'Cannot find path to yourself' });
    }

    const path = await findConnectionPath(currentUserId, targetUserId, 3);

    if (!path) {
      return res.status(404).json({
        message: 'No connection found within 3 degrees',
        degreesSearched: 3
      });
    }

    res.status(200).json({
      path,
      degree: path.length - 1,
      description: `Connected through ${path.length - 2} intermediaries`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/connections/network-stats
 * Get network statistics for current user
 */
connectionsRouter.get('/network-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const stats = await getNetworkStats(userId);

    res.status(200).json({
      stats,
      insights: {
        networkReach: `Your content can reach ${stats.totalReach} users through your network`,
        avgConnectionDistance: `Average connection is ${stats.avgPathLength} degrees away`,
        networkStrength: stats.secondDegree > stats.firstDegree * 2
          ? 'Strong extended network'
          : 'Focus on building connections'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/connections/suggestions
 * Get suggested connections based on mutual connections
 */
connectionsRouter.get('/suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const limit = parseInt(req.query.limit as string) || 10;

    // Find 2nd and 3rd degree connections with high mutual counts
    const connections = await findMutualConnections(userId, 3);

    // Filter to those with mutual connections (not direct follows)
    const suggestions = connections
      .filter(c => c.degree > 1 && c.mutualCount > 0)
      .sort((a, b) => b.mutualCount - a.mutualCount)
      .slice(0, limit);

    res.status(200).json({
      suggestions,
      totalSuggestions: suggestions.length,
      reason: 'People connected to your network'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/connections/create-rpc
 * Instructions for creating the PostgreSQL RPC function
 */
connectionsRouter.post('/create-rpc', async (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Run this SQL in your Supabase SQL Editor to create the RPC function',
    sql: `
-- Create function for mutual connections using Recursive CTE
CREATE OR REPLACE FUNCTION find_mutual_connections(
  p_user_id UUID,
  p_max_degree INTEGER DEFAULT 3
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  degree INTEGER,
  path UUID[],
  mutual_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE connections AS (
    -- Base case: Direct follows (1st degree)
    SELECT 
      f.following_id AS uid,
      1 AS deg,
      ARRAY[f.following_id] AS pth
    FROM follows f
    WHERE f.follower_id = p_user_id
    
    UNION
    
    -- Recursive case: Find friends of friends
    SELECT 
      f.following_id,
      c.deg + 1,
      c.pth || f.following_id
    FROM follows f
    INNER JOIN connections c ON f.follower_id = c.uid
    WHERE c.deg < p_max_degree
      AND NOT f.following_id = ANY(c.pth)
      AND f.following_id != p_user_id
  )
  SELECT DISTINCT ON (c.uid)
    c.uid AS user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    c.deg AS degree,
    c.pth AS path,
    CASE 
      WHEN c.deg = 1 THEN 0
      WHEN c.deg = 2 THEN (
        SELECT COUNT(*)::INTEGER 
        FROM follows f1 
        JOIN follows f2 ON f1.following_id = f2.follower_id
        WHERE f1.follower_id = p_user_id 
          AND f2.following_id = c.uid
      )
      ELSE 1
    END AS mutual_count
  FROM connections c
  LEFT JOIN profiles p ON p.user_id = c.uid
  WHERE c.uid != p_user_id
  ORDER BY c.uid, c.deg ASC;
END;
$$ LANGUAGE plpgsql;
    `
  });
});
