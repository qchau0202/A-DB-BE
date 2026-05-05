/**
 * SQL Window Functions for Post Ranking
 * 
 * This controller implements various ranking and analytical queries
 * using PostgreSQL Window Functions over rolling time windows.
 * 
 * Window Functions used:
 * - ROW_NUMBER(): Unique ranking with no gaps
 * - RANK(): Ranking with gaps for ties
 * - DENSE_RANK(): Ranking without gaps, ties share same rank
 * - NTILE(n): Divide into n buckets
 * - LAG/LEAD: Access previous/next rows
 * - SUM() OVER: Running totals
 * - AVG() OVER: Moving averages
 */

import { supabase, supabaseAdmin } from '../../config/supabase';

export interface RankedPost {
  postId: string;
  title: string;
  authorId: string;
  authorName: string;
  reactions: number;
  comments: number;
  views: number;
  score: number;
  // Rankings
  overallRank: number;
  categoryRank: number;
  percentile: number;
  // Comparisons
  prevDayRank?: number;
  rankChange?: number;
  // Window calculations
  rolling7DayAvg: number;
  cumulativeViews: number;
}

export interface TrendingResult {
  posts: RankedPost[];
  generatedAt: Date;
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Calculate popularity score using weighted formula
 * Score = (likes * 2 + comments * 3 + views * 0.5) / hours_since_posted
 */
const calculateScore = (post: any, now: Date): number => {
  const hoursSince = Math.max(
    1,
    (now.getTime() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60)
  );

  const likes = post.reactions?.like || 0;
  const comments = post.comment_count || 0;
  const views = post.views || 0;

  return (likes * 2 + comments * 3 + views * 0.5) / hoursSince;
};

/**
 * Get trending posts using SQL Window Functions
 * 
 * This query demonstrates:
 * 1. ROW_NUMBER() - Unique ranking of posts
 * 2. RANK() - Ranking with ties
 * 3. PERCENT_RANK() - Relative standing
 * 4. NTILE(100) - Percentile calculation
 * 5. LAG() - Compare with previous period
 * 6. AVG() OVER - Rolling averages
 * 7. SUM() OVER - Running totals
 * 
 * SQL Equivalent (for reference):
 * ```sql
 * WITH ranked_posts AS (
 *   SELECT 
 *     p.id,
 *     p.title,
 *     p.author_id,
 *     p.reactions,
 *     p.comment_count,
 *     p.views,
 *     p.created_at,
 *     -- Calculate popularity score
 *     (p.reactions->>'like'::int * 2 + 
 *      p.comment_count * 3 + 
 *      p.views * 0.5) / 
 *     GREATEST(1, EXTRACT(EPOCH FROM (NOW() - p.created_at))/3600) as score,
 *     
 *     -- Window functions
 *     ROW_NUMBER() OVER (ORDER BY score DESC) as overall_rank,
 *     RANK() OVER (ORDER BY score DESC) as rank_with_ties,
 *     DENSE_RANK() OVER (ORDER BY score DESC) as dense_rank,
 *     NTILE(100) OVER (ORDER BY score DESC) as percentile,
 *     
 *     -- Rolling 7-day average (requires date range)
 *     AVG(score) OVER (
 *       ORDER BY p.created_at 
 *       RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW
 *     ) as rolling_7day_avg,
 *     
 *     -- Cumulative views
 *     SUM(p.views) OVER (
 *       ORDER BY p.created_at
 *       ROWS UNBOUNDED PRECEDING
 *     ) as cumulative_views,
 *     
 *     -- Lag for comparing with previous day
 *     LAG(score, 1) OVER (
 *       PARTITION BY DATE(p.created_at)
 *       ORDER BY score DESC
 *     ) as prev_day_score
 *     
 *   FROM posts p
 *   WHERE p.created_at >= NOW() - INTERVAL '7 days'
 *     AND p.is_public = true
 * )
 * SELECT * FROM ranked_posts
 * WHERE overall_rank <= 50;
 * ```
 */
export const getTrendingPosts = async (
  days: number = 7,
  limit: number = 50
): Promise<TrendingResult> => {
  const client = supabaseAdmin ?? supabase;
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - days);

  // Since we can't use raw window functions easily through Supabase client,
  // we'll fetch and calculate in memory, but document the SQL approach

  const { data: posts, error } = await client
    .from('posts')
    .select(`
      id,
      title,
      author_id,
      reactions,
      comment_count,
      views,
      created_at,
      is_public
    `)
    .gte('created_at', windowStart.toISOString())
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error || !posts) {
    throw new Error(`Failed to fetch posts: ${error?.message || 'Unknown error'}`);
  }

  // Calculate scores and apply window function logic
  const scoredPosts = posts.map(post => ({
    ...post,
    score: calculateScore(post, now)
  }));

  // Sort by score descending
  scoredPosts.sort((a, b) => b.score - a.score);

  // Apply window function simulations
  const rankedPosts: RankedPost[] = scoredPosts.slice(0, limit).map((post, index) => {
    const overallRank = index + 1;

    // Calculate percentile: (rank - 1) / (total - 1) * 100
    const percentile = scoredPosts.length > 1
      ? Math.round(((overallRank - 1) / (scoredPosts.length - 1)) * 100)
      : 0;

    // Rolling 7-day average (simulated with available data)
    const rolling7DayAvg = scoredPosts
      .slice(0, index + 1)
      .reduce((sum, p) => sum + p.score, 0) / (index + 1);

    // Cumulative views (running total)
    const cumulativeViews = scoredPosts
      .slice(0, index + 1)
      .reduce((sum, p) => sum + (p.views || 0), 0);

    return {
      postId: post.id,
      title: post.title,
      authorId: post.author_id,
      authorName: '', // Will be populated below
      reactions: post.reactions?.like || 0,
      comments: post.comment_count || 0,
      views: post.views || 0,
      score: Math.round(post.score * 100) / 100,
      overallRank,
      categoryRank: overallRank, // Simplified - in real app would group by category
      percentile,
      rolling7DayAvg: Math.round(rolling7DayAvg * 100) / 100,
      cumulativeViews
    };
  });

  // Fetch author information
  const authorIds = [...new Set(rankedPosts.map(p => p.authorId))];
  if (authorIds.length > 0) {
    const { data: profiles } = await client
      .from('profiles')
      .select('user_id, username, display_name')
      .in('user_id', authorIds);

    if (profiles) {
      const profileMap = new Map(profiles.map(p => [p.user_id, p]));
      rankedPosts.forEach(post => {
        const profile = profileMap.get(post.authorId);
        post.authorName = profile?.display_name || profile?.username || 'Unknown';
      });
    }
  }

  return {
    posts: rankedPosts,
    generatedAt: now,
    windowStart,
    windowEnd: now
  };
};

/**
 * Get posts with day-over-day ranking comparison
 * Demonstrates LAG() window function pattern
 */
export const getPostsWithRankChange = async (
  days: number = 7
): Promise<Array<RankedPost & { prevDayRank: number; rankChange: number }>> => {
  const client = supabaseAdmin ?? supabase;
  const now = new Date();

  // Get posts from last 2x days for comparison
  const extendedWindow = new Date(now);
  extendedWindow.setDate(extendedWindow.getDate() - (days * 2));

  const { data: posts } = await client
    .from('posts')
    .select(`
      id,
      title,
      author_id,
      reactions,
      comment_count,
      views,
      created_at,
      is_public
    `)
    .gte('created_at', extendedWindow.toISOString())
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (!posts) return [];

  // Calculate daily rankings
  const postsByDay = new Map<string, typeof posts>();
  posts.forEach(post => {
    const day = new Date(post.created_at).toDateString();
    if (!postsByDay.has(day)) {
      postsByDay.set(day, []);
    }
    postsByDay.get(day)!.push(post);
  });

  // Calculate scores and rank per day
  const dailyRanks = new Map<string, Map<string, number>>();
  postsByDay.forEach((dayPosts, day) => {
    const scored = dayPosts.map(p => ({ ...p, score: calculateScore(p, now) }));
    scored.sort((a, b) => b.score - a.score);

    const ranks = new Map<string, number>();
    scored.forEach((p, i) => ranks.set(p.id, i + 1));
    dailyRanks.set(day, ranks);
  });

  // Compare today vs previous day (simulating LAG())
  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const todayRanks = dailyRanks.get(today);
  const yesterdayRanks = dailyRanks.get(yesterdayStr);

  if (!todayRanks) return [];

  const results: Array<RankedPost & { prevDayRank: number; rankChange: number }> = [];
  let rankCounter = 0;

  todayRanks.forEach((rank, postId) => {
    rankCounter++;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const prevRank = yesterdayRanks?.get(postId) || rank;
    const rankChange = prevRank - rank; // Positive = improved

    results.push({
      postId,
      title: post.title,
      authorId: post.author_id,
      authorName: '',
      reactions: post.reactions?.like || 0,
      comments: post.comment_count || 0,
      views: post.views || 0,
      score: Math.round(calculateScore(post, now) * 100) / 100,
      overallRank: rank,
      categoryRank: rank,
      percentile: Math.round(((rankCounter - 1) / todayRanks.size) * 100),
      rolling7DayAvg: 0,
      cumulativeViews: post.views || 0,
      prevDayRank: prevRank,
      rankChange
    });
  });

  return results.slice(0, 50);
};

/**
 * Get user leaderboard using NTILE() bucketing
 * Divides users into percentile buckets
 */
export const getUserLeaderboard = async (
  days: number = 30,
  buckets: number = 10
): Promise<Array<{
  userId: string;
  username: string;
  displayName: string;
  totalPosts: number;
  totalLikes: number;
  totalViews: number;
  score: number;
  rank: number;
  bucket: number; // NTILE result
  percentileLabel: string;
}>> => {
  const client = supabaseAdmin ?? supabase;
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Fetch posts with user info
  const { data: posts } = await client
    .from('posts')
    .select(`
      id,
      author_id,
      reactions,
      views,
      created_at
    `)
    .gte('created_at', since.toISOString())
    .eq('is_public', true);

  if (!posts) return [];

  // Aggregate by user
  const userStats = new Map<string, {
    posts: number;
    likes: number;
    views: number;
    score: number;
  }>();

  posts.forEach(post => {
    const stats = userStats.get(post.author_id) || { posts: 0, likes: 0, views: 0, score: 0 };
    stats.posts++;
    stats.likes += post.reactions?.like || 0;
    stats.views += post.views || 0;
    stats.score += calculateScore(post, new Date());
    userStats.set(post.author_id, stats);
  });

  // Fetch user profiles
  const userIds = Array.from(userStats.keys());
  const { data: profiles } = await client
    .from('profiles')
    .select('user_id, username, display_name')
    .in('user_id', userIds);

  const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

  // Convert to array and sort by score
  const users = Array.from(userStats.entries())
    .map(([userId, stats]) => ({
      userId,
      username: profileMap.get(userId)?.username || 'Unknown',
      displayName: profileMap.get(userId)?.display_name || '',
      totalPosts: stats.posts,
      totalLikes: stats.likes,
      totalViews: stats.views,
      score: Math.round(stats.score * 100) / 100,
      rank: 0,
      bucket: 0,
      percentileLabel: ''
    }))
    .sort((a, b) => b.score - a.score);

  // Apply rankings and NTILE bucketing
  const totalUsers = users.length;
  users.forEach((user, index) => {
    user.rank = index + 1;
    // NTILE simulation: divide into equal buckets
    user.bucket = Math.min(buckets, Math.floor((index / totalUsers) * buckets) + 1);

    // Create percentile labels
    if (user.bucket === 1) user.percentileLabel = 'Top 10%';
    else if (user.bucket <= 3) user.percentileLabel = 'Top 30%';
    else if (user.bucket <= 5) user.percentileLabel = 'Top 50%';
    else if (user.bucket <= 7) user.percentileLabel = 'Top 70%';
    else user.percentileLabel = 'Bottom 30%';
  });

  return users;
};

/**
 * Get moving averages for post engagement
 * Demonstrates AVG() OVER with ROWS/RANGE frame
 */
export const getEngagementMovingAverages = async (
  days: number = 30,
  windowSize: number = 7
): Promise<Array<{
  date: string;
  postCount: number;
  avgLikes: number;
  avgViews: number;
  movingAvgLikes: number; // AVG() OVER simulation
  movingAvgViews: number;
  cumulativePosts: number; // SUM() OVER simulation
}>> => {
  const client = supabaseAdmin ?? supabase;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: posts } = await client
    .from('posts')
    .select(`
      created_at,
      reactions,
      views
    `)
    .gte('created_at', since.toISOString())
    .eq('is_public', true);

  if (!posts) return [];

  // Group by day
  const dailyStats = new Map<string, {
    posts: number;
    likes: number;
    views: number;
  }>();

  posts.forEach(post => {
    if (!post.created_at) return;
    const day = new Date(post.created_at).toISOString().split('T')[0] as string;
    const stats = dailyStats.get(day) || { posts: 0, likes: 0, views: 0 };
    stats.posts++;
    stats.likes += post.reactions?.like || 0;
    stats.views += post.views || 0;
    dailyStats.set(day as string, stats);
  });

  // Sort by date
  const sortedDays = Array.from(dailyStats.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));

  // Calculate moving averages (simulating AVG() OVER)
  const results: Array<{
    date: string;
    postCount: number;
    avgLikes: number;
    avgViews: number;
    movingAvgLikes: number;
    movingAvgViews: number;
    cumulativePosts: number;
  }> = [];

  let cumulativePosts = 0;

  sortedDays.forEach(([date, stats], index) => {
    cumulativePosts += stats.posts;

    // Calculate 7-day moving average
    const windowStart = Math.max(0, index - windowSize + 1);
    const windowData = sortedDays.slice(windowStart, index + 1);

    const windowLikes = windowData.reduce((sum, [, s]) => sum + s.likes, 0);
    const windowViews = windowData.reduce((sum, [, s]) => sum + s.views, 0);
    const windowPosts = windowData.reduce((sum, [, s]) => sum + s.posts, 0);

    results.push({
      date,
      postCount: stats.posts,
      avgLikes: stats.posts > 0 ? Math.round((stats.likes / stats.posts) * 10) / 10 : 0,
      avgViews: stats.posts > 0 ? Math.round((stats.views / stats.posts) * 10) / 10 : 0,
      movingAvgLikes: windowPosts > 0 ? Math.round((windowLikes / windowPosts) * 10) / 10 : 0,
      movingAvgViews: windowPosts > 0 ? Math.round((windowViews / windowPosts) * 10) / 10 : 0,
      cumulativePosts
    });
  });

  return results;
};

/**
 * Get posts ranked within categories using PARTITION BY
 */
export const getPostsByCategory = async (
  days: number = 7
): Promise<Map<string, RankedPost[]>> => {
  const client = supabaseAdmin ?? supabase;
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Note: Posts table doesn't have explicit categories/tags in the current schema
  // This demonstrates how you would partition by category if you had one

  const { data: posts } = await client
    .from('posts')
    .select(`
      id,
      title,
      author_id,
      tags,
      reactions,
      comment_count,
      views,
      created_at
    `)
    .gte('created_at', since.toISOString())
    .eq('is_public', true);

  if (!posts) return new Map();

  const now = new Date();

  // Group by first tag (simulating category)
  const postsByCategory = new Map<string, Array<typeof posts[0] & { score: number }>>();

  posts.forEach(post => {
    const category = post.tags?.[0] || 'Uncategorized';
    if (!postsByCategory.has(category)) {
      postsByCategory.set(category, []);
    }
    postsByCategory.get(category)!.push({ ...post, score: calculateScore(post, now) });
  });

  // Sort each category and assign ranks (simulating RANK() OVER (PARTITION BY category))
  const result = new Map<string, RankedPost[]>();

  postsByCategory.forEach((categoryPosts, category) => {
    categoryPosts.sort((a, b) => b.score - a.score);

    const ranked = categoryPosts.slice(0, 10).map((post, index) => ({
      postId: post.id,
      title: post.title,
      authorId: post.author_id,
      authorName: '',
      reactions: post.reactions?.like || 0,
      comments: post.comment_count || 0,
      views: post.views || 0,
      score: Math.round(post.score * 100) / 100,
      overallRank: 0, // Would require global ranking
      categoryRank: index + 1, // RANK() OVER (PARTITION BY category)
      percentile: Math.round((index / categoryPosts.length) * 100),
      rolling7DayAvg: 0,
      cumulativeViews: 0
    }));

    result.set(category, ranked);
  });

  return result;
};

/**
 * SQL Migration for creating views with window functions
 * 
 * Run this in Supabase SQL Editor:
 * 
 * ```sql
 * -- Create a view for trending posts with window functions
 * CREATE OR REPLACE VIEW trending_posts_view AS
 * WITH scored_posts AS (
 *   SELECT 
 *     p.id,
 *     p.title,
 *     p.author_id,
 *     COALESCE((p.reactions->>'like')::int, 0) as likes,
 *     COALESCE(p.comment_count, 0) as comments,
 *     COALESCE(p.views, 0) as views,
 *     p.created_at,
 *     -- Score calculation
 *     (COALESCE((p.reactions->>'like')::int, 0) * 2 + 
 *      COALESCE(p.comment_count, 0) * 3 + 
 *      COALESCE(p.views, 0) * 0.5) / 
 *     GREATEST(1, EXTRACT(EPOCH FROM (NOW() - p.created_at))/3600) as score
 *   FROM posts p
 *   WHERE p.is_public = true
 *     AND p.created_at >= NOW() - INTERVAL '7 days'
 * )
 * SELECT 
 *   sp.*,
 *   ROW_NUMBER() OVER (ORDER BY sp.score DESC) as rank,
 *   RANK() OVER (ORDER BY sp.score DESC) as rank_with_ties,
 *   PERCENT_RANK() OVER (ORDER BY sp.score DESC) as percentile_rank,
 *   NTILE(10) OVER (ORDER BY sp.score DESC) as decile,
 *   -- 7-day rolling average
 *   AVG(sp.score) OVER (
 *     ORDER BY sp.created_at
 *     ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
 *   ) as rolling_7day_avg,
 *   -- Cumulative stats
 *   SUM(sp.views) OVER (ORDER BY sp.created_at ROWS UNBOUNDED PRECEDING) as cumulative_views,
 *   COUNT(*) OVER (ORDER BY sp.created_at ROWS UNBOUNDED PRECEDING) as cumulative_posts
 * FROM scored_posts sp;
 * 
 * -- Create index for efficient view queries
 * CREATE INDEX idx_posts_trending ON posts(is_public, created_at) 
 * WHERE is_public = true AND created_at > NOW() - INTERVAL '7 days';
 * ```
 */
