# DevConnect - Advanced Database Features Documentation

This document outlines the advanced database concepts and implementations used in the DevConnect application.

## Table of Contents

1. [ACID Properties](#acid-properties)
2. [BASE Properties](#base-properties)
3. [CAP Theorem (AP vs CP)](#cap-theorem)
4. [Database Triggers](#database-triggers)
5. [Recursive CTEs](#recursive-ctes)
6. [Aggregations](#aggregations)
7. [Implementation Details](#implementation-details)

---

## ACID Properties

ACID (Atomicity, Consistency, Isolation, Durability) properties are ensured through Supabase PostgreSQL transactions.

### Implementation Locations:

#### 1. Follow/Unfollow Operations (`src/controller/profile/follow.controller.ts`)
```typescript
// Atomic transaction for follow operation
- Updates follower_count on profile
- Adds user to following array
- Creates follow notification
```

#### 2. Post Creation with Reactions (`src/controller/posts/post.controller.ts`)
```typescript
// Atomic post creation ensures:
- Post record created
- Tags properly associated
- Content blocks validated
```

#### 3. Comment Operations (`src/controller/comments/comment.controller.ts`)
```typescript
// Comments maintain ACID through:
- Soft deletes (is_deleted flag)
- Atomic updates with versioning
- Referential integrity with posts
```

### Specific ACID Guarantees:
- **Atomicity**: All operations complete fully or roll back (e.g., follow user updates both profiles or none)
- **Consistency**: Foreign key constraints ensure valid author_id references
- **Isolation**: Concurrent reactions use row-level locking via PostgreSQL MVCC
- **Durability**: Write-ahead logging (WAL) ensures data survives crashes

---

## BASE Properties

BASE (Basically Available, Soft state, Eventually consistent) is used for:

### Implementation:

#### 1. Quickie View Counts (Redis + PostgreSQL)
```typescript
// Location: src/controller/quickies/quickie.controller.ts
// Pattern: Write-through cache with background sync
- Views stored in Redis for fast reads
- Periodic batch sync to PostgreSQL
- Soft state: view counts may have slight delays
```

#### 2. Reaction Caches
```typescript
// Reactions aggregated with eventual consistency
- Redis stores user reaction state
- PostgreSQL maintains ground truth
- Background job reconciles differences
```

#### 3. Feed Generation
```typescript
// Feed uses denormalized data (BASE approach)
- Pre-computed feed stored in cache
- Updates propagate eventually
- Accepts temporary inconsistency for performance
```

---

## CAP Theorem

### Availability + Partition Tolerance (AP) - Used for:

#### 1. Feed Reading
```typescript
// Location: Feed routes use cached data
- Available during network partitions
- May serve slightly stale data
- Prioritizes read availability
```

#### 2. Quickies Viewing
```typescript
// Uses Redis cache for view counts
- Available even if main DB partitioned
- View counts may diverge temporarily
```

### Consistency + Partition Tolerance (CP) - Used for:

#### 1. Authentication/Authorization
```typescript
// Location: src/controller/auth/auth.controller.ts
- Must have consistent session state
- Uses Supabase Auth (strongly consistent)
- No stale reads for authentication
```

#### 2. Follow/Unfollow Operations
```typescript
// Consistency prioritized over availability
- Both profiles must update together
- No partial follow states accepted
```

#### 3. Post Reactions (Per User)
```typescript
// One reaction per user per post (enforced)
- Database constraint ensures consistency
- No duplicate reactions possible
```

---

## Database Triggers

### Implemented Triggers:

#### 1. `update_profile_timestamp` (PostgreSQL Trigger)
```sql
-- Location: Database migration files
-- Trigger: Automatically updates updated_at on profile changes
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profile_timestamp
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
```

#### 2. `notify_on_follow` (Application-Level Trigger)
```typescript
// Location: src/controller/profile/follow.controller.ts
// Effect: Creates notification when follow occurs
- Triggered: After successful follow operation
- Action: Inserts notification record
- Recipient: User being followed
```

#### 3. `update_view_count` (Hybrid Trigger)
```typescript
// Location: src/controller/quickies/quickie.controller.ts
// Redis-based view tracking with PostgreSQL sync
- Triggered: When quickie is viewed
- Action: Increment Redis counter
- Periodic: Sync to PostgreSQL table
```

#### 4. `cascade_comment_delete` (Soft Delete Trigger)
```sql
-- Location: Database schema
-- Effect: Maintains comment count on posts
-- Uses soft delete (is_deleted flag)
-- Updates post comment count via trigger
```

---

## Recursive CTEs

### Implementation:

#### 1. Comment Thread Retrieval (Nested Comments)
```sql
-- Location: src/controller/comments/comment.controller.ts
-- Uses Recursive CTE for comment trees

WITH RECURSIVE comment_tree AS (
  -- Anchor: Top-level comments
  SELECT 
    id, 
    content, 
    author_id, 
    parent_id,
    created_at,
    0 AS depth
  FROM comments
  WHERE post_id = ? AND parent_id IS NULL
  
  UNION ALL
  
  -- Recursive: Child comments
  SELECT 
    c.id, 
    c.content, 
    c.author_id, 
    c.parent_id,
    c.created_at,
    ct.depth + 1
  FROM comments c
  INNER JOIN comment_tree ct ON c.parent_id = ct.id
  WHERE c.is_deleted = false
)
SELECT * FROM comment_tree ORDER BY depth, created_at;
```

#### 2. Follower Network Traversal
```sql
-- Location: Used in suggestions (potential feature)
-- Find 2nd-degree connections

WITH RECURSIVE follower_network AS (
  SELECT 
    following_id AS user_id,
    1 AS degree
  FROM follows
  WHERE follower_id = ?
  
  UNION
  
  SELECT 
    f.following_id,
    fn.degree + 1
  FROM follows f
  JOIN follower_network fn ON f.follower_id = fn.user_id
  WHERE fn.degree < 2
)
SELECT * FROM follower_network WHERE degree = 2;
```

---

## Aggregations

### Complex Aggregations Implemented:

#### 1. Post Feed with Reaction Aggregates
```typescript
// Location: src/controller/posts/post.controller.ts
// Aggregation: Sum of all reaction types

const reactionAgg = await db.query(`
  SELECT 
    post_id,
    SUM(CASE WHEN reaction_type = 'like' THEN 1 ELSE 0 END) as likes,
    SUM(CASE WHEN reaction_type = 'insightful' THEN 1 ELSE 0 END) as insightful,
    SUM(CASE WHEN reaction_type = 'celebrate' THEN 1 ELSE 0 END) as celebrate,
    SUM(CASE WHEN reaction_type = 'curious' THEN 1 ELSE 0 END) as curious,
    COUNT(DISTINCT user_id) as total_reactions
  FROM post_reactions
  GROUP BY post_id
`);
```

#### 2. Profile Statistics
```typescript
// Location: src/controller/profile/profile.controller.ts

const profileStats = await db.query(`
  SELECT 
    p.id,
    p.username,
    COUNT(DISTINCT f.follower_id) as follower_count,
    COUNT(DISTINCT posts.id) as post_count,
    COUNT(DISTINCT comments.id) as comment_count,
    MAX(posts.created_at) as last_post_date
  FROM profiles p
  LEFT JOIN follows f ON f.following_id = p.user_id
  LEFT JOIN posts ON posts.author_id = p.user_id
  LEFT JOIN comments ON comments.author_id = p.user_id
  WHERE p.user_id = ?
  GROUP BY p.id, p.username
`);
```

#### 3. Quickie View Analytics
```typescript
// Location: src/controller/quickies/quickie.controller.ts

const viewStats = await db.query(`
  SELECT 
    quickie_id,
    COUNT(DISTINCT viewer_id) as unique_views,
    COUNT(*) as total_views,
    DATE_TRUNC('hour', viewed_at) as view_hour
  FROM quickie_views
  WHERE quickie_id = ?
    AND viewed_at > NOW() - INTERVAL '24 hours'
  GROUP BY quickie_id, DATE_TRUNC('hour', viewed_at)
  ORDER BY view_hour DESC
`);
```

#### 4. Tag Popularity Aggregation
```typescript
// Location: Tag search functionality

const popularTags = await db.query(`
  SELECT 
    tag_name,
    COUNT(DISTINCT post_id) as post_count,
    COUNT(DISTINCT quickie_id) as quickie_count,
    SUM(COUNT(DISTINCT post_id)) OVER () as total_tagged_items
  FROM (
    SELECT unnest(tags) as tag_name, id as post_id, NULL as quickie_id
    FROM posts
    UNION ALL
    SELECT unnest(tags) as tag_name, NULL as post_id, id as quickie_id
    FROM quickies
  ) combined
  GROUP BY tag_name
  ORDER BY (post_count + quickie_count) DESC
  LIMIT 20
`);
```

---

## Implementation Details

### File Locations by Feature:

| Feature | File Location |
|---------|--------------|
| ACID Transactions | `src/controller/**/*.controller.ts` |
| BASE Properties | `src/controller/quickies/quickie.controller.ts` |
| Triggers | Database migrations + Application triggers |
| Recursive CTEs | `src/controller/comments/comment.controller.ts` |
| Aggregations | `src/controller/posts/post.controller.ts` |
| CAP - AP | Feed generation, Quickie views |
| CAP - CP | Auth, Follow operations |

### Supabase PostgreSQL Configuration:

```yaml
# Database Features Used
- Row Level Security (RLS) for data isolation
- Real-time subscriptions for live updates
- Connection pooling for performance
- Point-in-time recovery for durability
```

### Redis Usage (BASE Properties):

```yaml
# Redis Data Structures
- Sorted Sets: View counts by time
- Sets: User reactions (deduplication)
- Strings: Cached feed data
- Hashes: Session data
- TTL: Automatic expiration of view data
```

---

## Summary

The DevConnect application demonstrates:

1. **Strong Consistency** for critical operations (auth, follows)
2. **Eventual Consistency** for performance (feeds, view counts)
3. **ACID Compliance** through PostgreSQL transactions
4. **BASE Flexibility** through Redis caching layer
5. **Advanced SQL** with Recursive CTEs and Window Functions
6. **Data Integrity** via Triggers and Constraints

These patterns ensure the application scales efficiently while maintaining data correctness.
