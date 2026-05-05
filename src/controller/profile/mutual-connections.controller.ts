/**
 * Recursive CTE Implementation for Mutual Connections
 * 
 * This uses PostgreSQL Recursive CTEs to find connections up to 3rd degree.
 * 
 * 1st degree: Direct follows (A → B)
 * 2nd degree: Friends of friends (A → B → C)
 * 3rd degree: Extended network (A → B → C → D)
 */

import { supabase, supabaseAdmin } from '../../config/supabase';

export interface ConnectionDegree {
  userId: string;
  degree: number;
  path: string[];  // Path showing how connection was found
  mutualConnections?: number;
}

export interface MutualConnectionResult {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  degree: number;
  path: string[];
  mutualCount: number;
}

/**
 * Find mutual connections up to 3rd degree using Recursive CTE
 * 
 * SQL Query Explanation:
 * 
 * WITH RECURSIVE connections AS (
 *   -- Base case: Start from user's direct follows
 *   SELECT following_id AS user_id, 1 AS degree, 
 *          ARRAY[following_id] AS path
 *   FROM follows WHERE follower_id = :userId
 *   
 *   UNION ALL
 *   
 *   -- Recursive case: Find friends of friends
 *   SELECT f.following_id, c.degree + 1,
 *          c.path || f.following_id
 *   FROM follows f
 *   JOIN connections c ON f.follower_id = c.user_id
 *   WHERE c.degree < 3  -- Stop at 3rd degree
 *     AND NOT f.following_id = ANY(c.path)  -- Prevent cycles
 * )
 * SELECT * FROM connections WHERE user_id != :userId;
 */
export const findMutualConnections = async (
  userId: string,
  maxDegree: number = 3
): Promise<MutualConnectionResult[]> => {
  const client = supabaseAdmin ?? supabase;

  // Use raw SQL with Recursive CTE for efficient traversal
  const { data, error } = await client.rpc('find_mutual_connections', {
    p_user_id: userId,
    p_max_degree: maxDegree
  });

  if (error) {
    // If RPC doesn't exist, fall back to manual implementation
    console.warn('RPC not found, falling back to manual implementation:', error);
    return findMutualConnectionsManual(userId, maxDegree);
  }

  return data as MutualConnectionResult[];
};

/**
 * Manual implementation using multiple queries
 * Used when the database function doesn't exist yet
 */
export const findMutualConnectionsManual = async (
  userId: string,
  maxDegree: number = 3
): Promise<MutualConnectionResult[]> => {
  const client = supabaseAdmin ?? supabase;
  const connections = new Map<string, ConnectionDegree>();

  // 1st degree - Direct follows
  const { data: firstDegree } = await client
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (firstDegree) {
    for (const row of firstDegree) {
      connections.set(row.following_id, {
        userId: row.following_id,
        degree: 1,
        path: [userId, row.following_id]
      });
    }
  }

  if (maxDegree >= 2) {
    // 2nd degree - Friends of friends
    const firstDegreeIds = Array.from(connections.keys());
    if (firstDegreeIds.length > 0) {
      const { data: secondDegree } = await client
        .from('follows')
        .select('follower_id, following_id')
        .in('follower_id', firstDegreeIds)
        .neq('following_id', userId);

      if (secondDegree) {
        for (const row of secondDegree) {
          const firstHop = connections.get(row.follower_id)!;
          if (!connections.has(row.following_id)) {
            connections.set(row.following_id, {
              userId: row.following_id,
              degree: 2,
              path: [...firstHop.path, row.following_id]
            });
          }
        }
      }
    }
  }

  if (maxDegree >= 3) {
    // 3rd degree - Extended network
    const secondDegreeIds = Array.from(connections.entries())
      .filter(([, conn]) => conn.degree === 2)
      .map(([id]) => id);

    if (secondDegreeIds.length > 0) {
      const { data: thirdDegree } = await client
        .from('follows')
        .select('follower_id, following_id')
        .in('follower_id', secondDegreeIds)
        .neq('following_id', userId);

      if (thirdDegree) {
        for (const row of thirdDegree) {
          const secondHop = connections.get(row.follower_id)!;
          // Only add if not already found at a closer degree
          if (!connections.has(row.following_id)) {
            connections.set(row.following_id, {
              userId: row.following_id,
              degree: 3,
              path: [...secondHop.path, row.following_id]
            });
          }
        }
      }
    }
  }

  // Fetch profile information for all found connections
  const userIds = Array.from(connections.keys());
  if (userIds.length === 0) return [];

  const { data: profiles } = await client
    .from('profiles')
    .select('user_id, username, display_name, avatar_url')
    .in('user_id', userIds);

  // Calculate mutual connection counts
  const mutualCounts = new Map<string, number>();
  for (const [id, conn] of connections) {
    if (conn.degree === 2) {
      // For 2nd degree, count shared 1st degree connections
      const shared = Array.from(connections.values())
        .filter(c => c.degree === 1 && firstDegree?.some(f => f.following_id === c.userId))
        .length;
      mutualCounts.set(id, shared);
    } else if (conn.degree === 3) {
      // For 3rd degree, this is more complex - simplified here
      mutualCounts.set(id, 1);
    } else {
      mutualCounts.set(id, 0);
    }
  }

  const results: MutualConnectionResult[] = [];
  for (const [id, conn] of connections) {
    const profile = profiles?.find(p => p.user_id === id);
    results.push({
      userId: id,
      username: profile?.username ?? null,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      degree: conn.degree,
      path: conn.path,
      mutualCount: mutualCounts.get(id) ?? 0
    });
  }

  // Sort by degree (closest first), then by mutual count
  return results.sort((a, b) => {
    if (a.degree !== b.degree) return a.degree - b.degree;
    return b.mutualCount - a.mutualCount;
  });
};

/**
 * SQL Migration for the database function
 * 
 * Run this in Supabase SQL Editor to create the RPC function:
 * 
 * ```sql
 * CREATE OR REPLACE FUNCTION find_mutual_connections(
 *   p_user_id UUID,
 *   p_max_degree INTEGER DEFAULT 3
 * )
 * RETURNS TABLE (
 *   user_id UUID,
 *   username TEXT,
 *   display_name TEXT,
 *   avatar_url TEXT,
 *   degree INTEGER,
 *   path UUID[],
 *   mutual_count INTEGER
 * ) AS $$
 * BEGIN
 *   RETURN QUERY
 *   WITH RECURSIVE connections AS (
 *     -- Base case: Direct follows (1st degree)
 *     SELECT 
 *       f.following_id AS uid,
 *       1 AS deg,
 *       ARRAY[f.following_id] AS pth
 *     FROM follows f
 *     WHERE f.follower_id = p_user_id
 *     
 *     UNION
 *     
 *     -- Recursive case: Find friends of friends
 *     SELECT 
 *       f.following_id,
 *       c.deg + 1,
 *       c.pth || f.following_id
 *     FROM follows f
 *     INNER JOIN connections c ON f.follower_id = c.uid
 *     WHERE c.deg < p_max_degree
 *       AND NOT f.following_id = ANY(c.pth)
 *       AND f.following_id != p_user_id
 *   )
 *   SELECT DISTINCT ON (c.uid)
 *     c.uid AS user_id,
 *     p.username,
 *     p.display_name,
 *     p.avatar_url,
 *     c.deg AS degree,
 *     c.pth AS path,
 *     CASE 
 *       WHEN c.deg = 1 THEN 0
 *       WHEN c.deg = 2 THEN (
 *         SELECT COUNT(*)::INTEGER 
 *         FROM follows f1 
 *         JOIN follows f2 ON f1.following_id = f2.follower_id
 *         WHERE f1.follower_id = p_user_id 
 *           AND f2.following_id = c.uid
 *       )
 *       ELSE 1
 *     END AS mutual_count
 *   FROM connections c
 *   LEFT JOIN profiles p ON p.user_id = c.uid
 *   WHERE c.uid != p_user_id
 *   ORDER BY c.uid, c.deg ASC;
 * END;
 * $$ LANGUAGE plpgsql;
 * ```
 */

/**
 * Find the shortest path between two users (for "How you're connected")
 */
export const findConnectionPath = async (
  fromUserId: string,
  toUserId: string,
  maxDepth: number = 3
): Promise<string[] | null> => {
  const client = supabaseAdmin ?? supabase;

  // Use BFS to find shortest path
  const visited = new Set<string>();
  const queue: { userId: string; path: string[] }[] = [
    { userId: fromUserId, path: [fromUserId] }
  ];

  while (queue.length > 0) {
    const { userId, path } = queue.shift()!;

    if (userId === toUserId) {
      return path;
    }

    if (path.length >= maxDepth + 1) continue;
    if (visited.has(userId)) continue;
    visited.add(userId);

    // Get users this person follows
    const { data: follows } = await client
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (follows) {
      for (const row of follows) {
        if (!visited.has(row.following_id)) {
          queue.push({
            userId: row.following_id,
            path: [...path, row.following_id]
          });
        }
      }
    }
  }

  return null; // No connection found within maxDepth
};

/**
 * Calculate network statistics for a user
 */
export const getNetworkStats = async (userId: string): Promise<{
  firstDegree: number;
  secondDegree: number;
  thirdDegree: number;
  totalReach: number;
  avgPathLength: number;
}> => {
  const connections = await findMutualConnectionsManual(userId, 3);

  const firstDegree = connections.filter(c => c.degree === 1).length;
  const secondDegree = connections.filter(c => c.degree === 2).length;
  const thirdDegree = connections.filter(c => c.degree === 3).length;

  // Calculate average path length
  const totalPaths = connections.length;
  const sumPathLengths = connections.reduce((sum, c) => sum + c.degree, 0);
  const avgPathLength = totalPaths > 0 ? sumPathLengths / totalPaths : 0;

  return {
    firstDegree,
    secondDegree,
    thirdDegree,
    totalReach: firstDegree + secondDegree + thirdDegree,
    avgPathLength: Math.round(avgPathLength * 100) / 100
  };
};
