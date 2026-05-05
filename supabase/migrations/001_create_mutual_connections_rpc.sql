-- Supabase RPC Function for Mutual Connections (Recursive CTE)
-- Run this in Supabase SQL Editor or via psql

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS find_mutual_connections(UUID, INTEGER);

-- Create the RPC function for finding mutual connections up to 3rd degree
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
        -- These are people the user directly follows
        SELECT 
            f.following_id AS uid,
            1 AS deg,
            ARRAY[f.following_id] AS pth
        FROM follows f
        WHERE f.follower_id = p_user_id
        
        UNION
        
        -- Recursive case: Find friends of friends
        -- For each connection found, find who they follow
        SELECT 
            f.following_id,
            c.deg + 1,
            c.pth || f.following_id
        FROM follows f
        INNER JOIN connections c ON f.follower_id = c.uid
        WHERE c.deg < p_max_degree           -- Stop at max degree
          AND NOT f.following_id = ANY(c.pth) -- Prevent cycles (don't revisit)
          AND f.following_id != p_user_id     -- Don't include self
    )
    SELECT DISTINCT ON (c.uid)
        c.uid AS user_id,
        p.username,
        p.display_name,
        p.avatar_url,
        c.deg AS degree,
        c.pth AS path,
        -- Calculate mutual connections count
        CASE 
            WHEN c.deg = 1 THEN 0  -- Direct follows have 0 mutuals
            WHEN c.deg = 2 THEN (
                -- For 2nd degree: count shared 1st degree connections
                SELECT COUNT(*)::INTEGER 
                FROM follows f1 
                INNER JOIN follows f2 ON f1.following_id = f2.follower_id
                WHERE f1.follower_id = p_user_id 
                  AND f2.following_id = c.uid
            )
            ELSE 1  -- 3rd degree has at least 1 mutual path
        END AS mutual_count
    FROM connections c
    LEFT JOIN profiles p ON p.user_id = c.uid
    WHERE c.uid != p_user_id
    ORDER BY c.uid, c.deg ASC;  -- Keep the shortest path for each user
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER  -- Run with function owner's permissions
SET search_path = public;  -- Prevent search path injection

-- Add helpful comment
COMMENT ON FUNCTION find_mutual_connections(UUID, INTEGER) IS 
'Finds mutual connections up to 3rd degree using Recursive CTE.
1st degree = Direct follows
2nd degree = Friends of friends (1 hop)
3rd degree = Extended network (2 hops)';

-- Create index to optimize the recursive query
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Verify function was created
SELECT 
    proname AS function_name,
    proargtypes::regtype[] AS argument_types,
    prorettype::regtype AS return_type
FROM pg_proc
WHERE proname = 'find_mutual_connections';
