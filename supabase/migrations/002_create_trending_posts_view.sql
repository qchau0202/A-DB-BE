-- Supabase View for Trending Posts with Window Functions
-- This creates a database view that uses SQL Window Functions for ranking

-- Drop existing view if it exists
DROP VIEW IF EXISTS trending_posts_view;

-- Create the view with window functions
CREATE OR REPLACE VIEW trending_posts_view AS
WITH scored_posts AS (
    SELECT 
        p.id,
        p.title,
        p.content,
        p.author_id,
        p.created_at,
        p.views,
        p.comment_count,
        p.reactions,
        p.tags,
        p.is_public,
        -- Calculate popularity score
        -- Formula: (likes * 2 + comments * 3 + views * 0.5) / hours_since_posted
        (
            COALESCE((p.reactions->>'like')::INTEGER, 0) * 2 + 
            COALESCE(p.comment_count, 0) * 3 + 
            COALESCE(p.views, 0) * 0.5
        ) / 
        GREATEST(
            1, 
            EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600
        ) AS score
    FROM posts p
    WHERE p.is_public = TRUE
      AND p.created_at >= NOW() - INTERVAL '7 days'  -- Only recent posts
),
ranked_posts AS (
    SELECT 
        sp.*,
        -- ROW_NUMBER(): Unique ranking with no gaps
        ROW_NUMBER() OVER (ORDER BY sp.score DESC) AS overall_rank,
        
        -- RANK(): Ranking with gaps for ties
        RANK() OVER (ORDER BY sp.score DESC) AS rank_with_ties,
        
        -- DENSE_RANK(): Ranking without gaps, ties share same rank
        DENSE_RANK() OVER (ORDER BY sp.score DESC) AS dense_rank,
        
        -- PERCENT_RANK(): Relative standing as percentage
        ROUND(
            PERCENT_RANK() OVER (ORDER BY sp.score DESC) * 100, 
            2
        ) AS percentile,
        
        -- NTILE(10): Divide into 10 buckets (deciles)
        NTILE(10) OVER (ORDER BY sp.score DESC) AS decile,
        
        -- LAG(): Previous day's top score for comparison
        LAG(sp.score, 1) OVER (
            PARTITION BY DATE(sp.created_at)
            ORDER BY sp.score DESC
        ) AS prev_top_score,
        
        -- Moving average over last 7 posts
        ROUND(
            AVG(sp.score) OVER (
                ORDER BY sp.created_at
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ), 
            2
        ) AS moving_avg_7,
        
        -- Running total of views
        SUM(sp.views) OVER (
            ORDER BY sp.created_at 
            ROWS UNBOUNDED PRECEDING
        ) AS cumulative_views
    FROM scored_posts sp
)
SELECT 
    rp.*,
    u.username AS author_username,
    u.display_name AS author_display_name
FROM ranked_posts rp
LEFT JOIN profiles u ON u.user_id = rp.author_id
WHERE rp.overall_rank <= 100;  -- Only top 100

-- Create index for efficient view queries
CREATE INDEX IF NOT EXISTS idx_posts_trending 
ON posts(is_public, created_at) 
WHERE is_public = TRUE AND created_at > NOW() - INTERVAL '7 days';

-- Add comment explaining the view
COMMENT ON VIEW trending_posts_view IS 
'Trending posts ranked using SQL Window Functions:
- ROW_NUMBER: Unique rank
- RANK: Rank with ties
- DENSE_RANK: Continuous rank
- PERCENT_RANK: Percentile standing
- NTILE: Decile buckets
- LAG: Day-over-day comparison
- AVG OVER: Moving averages
- SUM OVER: Running totals';

-- Verify view was created
SELECT 
    viewname,
    definition
FROM pg_views
WHERE viewname = 'trending_posts_view';
