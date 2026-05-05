import Redis from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

// Check if Redis is enabled
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

// Redis client configuration - only create if enabled
let redis: Redis | null = null;
let redisAvailable = false;

if (REDIS_ENABLED) {
  try {
    const redisUrl = process.env.REDIS_URL;
    redis = redisUrl
      ? new Redis(redisUrl, { lazyConnect: true })
      : new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0'),
          lazyConnect: true,
        });

    // Handle connection errors silently (fallback to MongoDB)
    redis.on('error', () => {
      redisAvailable = false;
    });

    redis.on('connect', () => {
      redisAvailable = true;
      console.log('✅ Redis connected');
    });

    // Try to connect
    redis.connect().catch(() => {
      redisAvailable = false;
      console.log('⚠️  Redis not available - using MongoDB for view counts');
    });
  } catch {
    redisAvailable = false;
    console.log('⚠️  Redis not available - using MongoDB for view counts');
  }
}

// In-memory fallback for view counts when Redis is not available
const memoryViewCounts = new Map<string, number>();
const memoryUserViews = new Map<string, Set<string>>();

// View count helpers using Redis (with MongoDB fallback)
export const viewCountKey = (type: 'post' | 'document', id: string) => `views:${type}:${id}`;
export const userViewKey = (type: 'post' | 'document', id: string, userId: string) => `views:${type}:${id}:users:${userId}`;

/**
 * Increment view count using Redis (falls back to MongoDB/memory if Redis unavailable)
 */
export async function incrementViewCount(
  type: 'post' | 'document',
  id: string,
  userId?: string
): Promise<number> {
  const key = viewCountKey(type, id);

  // If Redis is available, use it
  if (redis && redisAvailable) {
    if (userId) {
      const userKey = userViewKey(type, id, userId);
      const hasViewed = await redis.sismember(userKey, userId);

      if (!hasViewed) {
        await redis.sadd(userKey, userId);
        await redis.expire(userKey, 86400);
        return await redis.incr(key);
      }

      const count = await redis.get(key);
      return parseInt(count || '0');
    }
    return await redis.incr(key);
  }

  // Fallback: use in-memory storage
  const memoryKey = `${type}:${id}`;
  const currentCount = memoryViewCounts.get(memoryKey) || 0;

  if (userId) {
    const userViewSet = memoryUserViews.get(memoryKey);
    if (userViewSet?.has(userId)) {
      return currentCount;
    }
    if (!userViewSet) {
      memoryUserViews.set(memoryKey, new Set([userId]));
    } else {
      userViewSet.add(userId);
    }
  }

  const newCount = currentCount + 1;
  memoryViewCounts.set(memoryKey, newCount);
  return newCount;
}

/**
 * Get view count from Redis (or memory fallback)
 */
export async function getViewCount(type: 'post' | 'document', id: string): Promise<number> {
  if (redis && redisAvailable) {
    const key = viewCountKey(type, id);
    const count = await redis.get(key);
    return parseInt(count || '0');
  }

  // Fallback: use in-memory storage
  const memoryKey = `${type}:${id}`;
  return memoryViewCounts.get(memoryKey) || 0;
}

/**
 * Get the Redis client (may be null if not connected)
 */
export function getRedisClient(): Redis | null {
  return redis;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export default redis;
