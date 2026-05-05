-- Setup test data for RPC function testing
-- Run this to create sample follows and profiles for testing

-- First, ensure unique constraint exists on profiles.user_id
-- (If this fails, the constraint already exists - that's fine)
DO $$
BEGIN
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- Insert test profiles (skip if already exists using subquery)
INSERT INTO profiles (id, user_id, username, display_name, avatar_url, bio)
SELECT 
    gen_random_uuid(), 
    data.user_id, 
    data.username, 
    data.display_name, 
    data.avatar_url, 
    data.bio
FROM (VALUES
    ('11111111-1111-1111-1111-111111111111'::UUID, 'alice', 'Alice Smith', 'https://i.pravatar.cc/150?u=alice', 'Software Engineer'),
    ('22222222-2222-2222-2222-222222222222'::UUID, 'bob', 'Bob Johnson', 'https://i.pravatar.cc/150?u=bob', 'Product Manager'),
    ('33333333-3333-3333-3333-333333333333'::UUID, 'carol', 'Carol Williams', 'https://i.pravatar.cc/150?u=carol', 'Designer'),
    ('44444444-4444-4444-4444-444444444444'::UUID, 'dave', 'Dave Brown', 'https://i.pravatar.cc/150?u=dave', 'Data Scientist'),
    ('55555555-5555-5555-5555-555555555555'::UUID, 'eve', 'Eve Davis', 'https://i.pravatar.cc/150?u=eve', 'DevOps Engineer')
) AS data(user_id, username, display_name, avatar_url, bio)
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = data.user_id
);

-- Create follow relationships to test 3rd degree connections
-- Alice follows Bob (1st degree)
-- Bob follows Carol (2nd degree from Alice)
-- Carol follows Dave (3rd degree from Alice)
-- Dave follows Eve (4th degree - should not appear with max_degree=3)

-- First ensure unique constraint exists on follows
DO $$
BEGIN
    ALTER TABLE follows ADD CONSTRAINT follows_unique UNIQUE (follower_id, following_id);
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- Insert follows (skip if already exists)
INSERT INTO follows (follower_id, following_id, created_at)
SELECT 
    data.follower_id, 
    data.following_id, 
    NOW()
FROM (VALUES
    ('11111111-1111-1111-1111-111111111111'::UUID, '22222222-2222-2222-2222-222222222222'::UUID),  -- Alice -> Bob
    ('22222222-2222-2222-2222-222222222222'::UUID, '33333333-3333-3333-3333-333333333333'::UUID),  -- Bob -> Carol
    ('33333333-3333-3333-3333-333333333333'::UUID, '44444444-4444-4444-4444-444444444444'::UUID),  -- Carol -> Dave
    ('44444444-4444-4444-4444-444444444444'::UUID, '55555555-5555-5555-5555-555555555555'::UUID)   -- Dave -> Eve
) AS data(follower_id, following_id)
WHERE NOT EXISTS (
    SELECT 1 FROM follows f 
    WHERE f.follower_id = data.follower_id 
      AND f.following_id = data.following_id
);

-- Insert test posts for trending view
INSERT INTO posts (
    id, 
    title, 
    content, 
    author_id, 
    created_at, 
    views, 
    comment_count, 
    reactions, 
    tags, 
    is_public
)
VALUES 
    (
        gen_random_uuid(), 
        'Getting Started with PostgreSQL', 
        'A comprehensive guide to PostgreSQL basics...', 
        '11111111-1111-1111-1111-111111111111',
        NOW() - INTERVAL '1 hour',
        150,
        12,
        '{"like": 45, "love": 8}',
        ARRAY['postgresql', 'database', 'tutorial'],
        true
    ),
    (
        gen_random_uuid(), 
        'Advanced SQL Window Functions', 
        'Learn about ROW_NUMBER, RANK, and more...', 
        '22222222-2222-2222-2222-222222222222',
        NOW() - INTERVAL '3 hours',
        89,
        5,
        '{"like": 23, "celebrate": 3}',
        ARRAY['sql', 'advanced', 'database'],
        true
    ),
    (
        gen_random_uuid(), 
        'MongoDB vs PostgreSQL', 
        'Comparing document and relational databases...', 
        '33333333-3333-3333-3333-333333333333',
        NOW() - INTERVAL '5 hours',
        234,
        18,
        '{"like": 67, "insightful": 12}',
        ARRAY['mongodb', 'postgresql', 'comparison'],
        true
    ),
    (
        gen_random_uuid(), 
        'Recursive CTEs Explained', 
        'Understanding recursive common table expressions...', 
        '44444444-4444-4444-4444-444444444444',
        NOW() - INTERVAL '12 hours',
        67,
        8,
        '{"like": 19}',
        ARRAY['sql', 'cte', 'recursive'],
        true
    ),
    (
        gen_random_uuid(), 
        'Database Indexing Strategies', 
        'How to optimize queries with proper indexing...', 
        '55555555-5555-5555-5555-555555555555',
        NOW() - INTERVAL '2 days',
        45,
        3,
        '{"like": 12}',
        ARRAY['performance', 'indexing', 'optimization'],
        true
    );

-- Verify test data was inserted
SELECT 'Profiles created: ' || COUNT(*)::TEXT as status
FROM profiles 
WHERE user_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555'
);

SELECT 'Follow relationships created: ' || COUNT(*)::TEXT as status
FROM follows
WHERE follower_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444'
);

SELECT 'Test posts created: ' || COUNT(*)::TEXT as status
FROM posts
WHERE created_at > NOW() - INTERVAL '3 days';

-- Test the RPC function with Alice's user ID
SELECT 'Testing RPC function for Alice...' as info;

SELECT * FROM find_mutual_connections(
    '11111111-1111-1111-1111-111111111111'::UUID,  -- Alice
    3  -- Max degree
);
