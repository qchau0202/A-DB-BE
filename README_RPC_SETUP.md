# Supabase RPC Functions Setup Guide

This guide helps you set up and test the PostgreSQL RPC functions for your Advanced Database project.

## 📁 Files Created

```
supabase/
├── migrations/
│   ├── 001_create_mutual_connections_rpc.sql    # Recursive CTE function
│   └── 002_create_trending_posts_view.sql       # Window Functions view
└── setup-test-data.sql                          # Test data

src/test/
└── test-rpc-functions.ts                         # Test script
```

## 🚀 Setup Steps

### Step 1: Create the RPC Function in Supabase

#### Option A: Using Supabase Dashboard (Recommended)
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor** → **New query**
4. Copy and paste the content from:
   - `supabase/migrations/001_create_mutual_connections_rpc.sql`
5. Click **Run**

#### Option B: Using psql CLI
```bash
# Set your database URL
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres"

# Run the migration
psql $DATABASE_URL -f supabase/migrations/001_create_mutual_connections_rpc.sql
```

### Step 2: Create the Trending Posts View

Repeat the process with:
- `supabase/migrations/002_create_trending_posts_view.sql`

### Step 3: Insert Test Data (Optional but Recommended)

Run in SQL Editor:
- `supabase/setup-test-data.sql`

This creates:
- 5 test users (Alice, Bob, Carol, Dave, Eve)
- Follow relationships forming a chain (Alice → Bob → Carol → Dave → Eve)
- 5 test posts for trending view testing

## 🧪 Testing

### Run the Test Script

```bash
# Install dependencies if needed
npm install

# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export TEST_USER_ID="11111111-1111-1111-1111-111111111111"  # Alice's ID

# Run the tests
npx ts-node src/test/test-rpc-functions.ts
```

### Manual Testing in SQL Editor

```sql
-- Test mutual connections (should show Bob, Carol, Dave)
SELECT * FROM find_mutual_connections(
    '11111111-1111-1111-1111-111111111111'::UUID,
    3
);

-- Test trending posts view
SELECT * FROM trending_posts_view LIMIT 5;

-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'find_mutual_connections';
```

## 📊 Expected Results

### Mutual Connections Test

When testing with Alice's ID, you should see:

| user_id | username | degree | mutual_count |
|---------|----------|--------|--------------|
| bob-id  | bob      | 1      | 0            |
| carol-id| carol    | 2      | 1            |
| dave-id | dave     | 3      | 1            |

**Note:** Eve (4th degree) should NOT appear because we limited to 3 degrees.

### Trending Posts View

Should return posts with columns:
- `score` - Calculated popularity score
- `overall_rank` - Position in ranking
- `percentile` - Relative standing (0-100)
- `decile` - Bucket (1-10)
- `moving_avg_7` - Rolling 7-post average
- `cumulative_views` - Running total

## 🔧 Troubleshooting

### "Function not found" Error

**Problem:** The RPC function wasn't created.

**Solution:**
1. Check SQL Editor executed without errors
2. Verify in SQL Editor:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'find_mutual_connections';
   ```
3. If empty, re-run the migration

### "Permission denied" Error

**Problem:** RLS policies blocking access.

**Solution:**
The function uses `SECURITY DEFINER` so it runs with owner's permissions. Make sure your Supabase service role key has proper access.

### "No connections found" Error

**Problem:** No follow relationships exist.

**Solution:**
1. Run `setup-test-data.sql` to create test follows
2. Or manually create follows:
   ```sql
   INSERT INTO follows (follower_id, following_id) 
   VALUES ('your-user-id', 'another-user-id');
   ```

### Performance Issues

**Problem:** Slow query execution.

**Solution:**
The migration already creates indexes:
- `idx_follows_follower_id`
- `idx_follows_following_id`
- `idx_profiles_user_id`

Verify they exist:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'follows';
```

## 📚 How It Works

### Recursive CTE Explained

```sql
WITH RECURSIVE connections AS (
    -- Base case: Who does Alice follow? (1st degree)
    SELECT f.following_id AS uid, 1 AS deg
    FROM follows f
    WHERE f.follower_id = 'alice-id'
    
    UNION
    
    -- Recursive case: Who do they follow? (2nd, 3rd degree)
    SELECT f.following_id, c.deg + 1
    FROM follows f
    JOIN connections c ON f.follower_id = c.uid
    WHERE c.deg < 3  -- Stop at 3rd degree
)
```

**Execution flow:**
1. Start with Alice's direct follows (Bob) → 1st degree
2. Find who Bob follows (Carol) → 2nd degree
3. Find who Carol follows (Dave) → 3rd degree
4. Stop (max degree reached)

### Window Functions Explained

```sql
-- ROW_NUMBER: Unique rank even with ties
ROW_NUMBER() OVER (ORDER BY score DESC)
-- Result: 1, 2, 3, 4, 5...

-- RANK: Same rank for ties, skips numbers
RANK() OVER (ORDER BY score DESC)
-- Result: 1, 2, 2, 4, 5... (if 2nd and 3rd have same score)

-- DENSE_RANK: Same rank for ties, no skips
DENSE_RANK() OVER (ORDER BY score DESC)
-- Result: 1, 2, 2, 3, 4...

-- NTILE: Divide into buckets
NTILE(10) OVER (ORDER BY score DESC)
-- Result: 1, 1, 1, 2, 2, 2... (top 10% get bucket 1)
```

## 🎯 Next Steps

1. **Integrate with Backend:**
   ```typescript
   // In mutual-connections.controller.ts
   const { data, error } = await supabase
     .rpc('find_mutual_connections', {
       p_user_id: userId,
       p_max_degree: 3
     });
   ```

2. **Add to API Response:**
   The controller already supports using RPC - update to use it instead of manual queries.

3. **Create Frontend Component:**
   Show "Mutual Connections" with degree indicators in the UI.

## 📖 Resources

- [PostgreSQL Recursive CTEs](https://www.postgresql.org/docs/current/queries-with.html)
- [PostgreSQL Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html)
- [Supabase RPC Docs](https://supabase.com/docs/reference/javascript/rpc)
