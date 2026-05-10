# Database Setup and Management

This directory contains scripts for setting up and managing the DevConnect application databases (Supabase PostgreSQL and MongoDB).

## Prerequisites

Before running any scripts, ensure you have:
1. A Supabase project created (for PostgreSQL + Auth)
2. A MongoDB instance (local Atlas or MongoDB Atlas)
3. Environment variables configured in `.env` (see `.env.example`)

## Environment Variables

Required environment variables (see `.env.example`):

```bash
# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=devconnect
```

## Setup Steps

### 1. Initialize Supabase Schema

Run the SQL scripts in Supabase SQL Editor (as project owner):

```bash
# Run in order:
1. src/db/sql/001_supabase_schema.sql
2. src/db/sql/002_fix_handle_new_user_owner.sql  # Optional: Fixes trigger owner issue
3. src/db/sql/003_noop_trigger.sql               # Optional: No-op trigger workaround
```

**Note:** Scripts 002 and 003 are optional fixes. Run them if you encounter trigger-related errors during user signup.

### 2. Initialize MongoDB Collections

From the backend root directory:

```bash
node src/db/nosql/001_mongodb_setup.js
```

This creates/updates:
- Collections: `posts`, `documents`, `quickies`, `comments`, `notifications`
- JSON schema validators for data integrity
- Indexes for query optimization

### 3. Seed Database with Sample Data

Choose one of the following seed scripts:

#### Option A: Seed via Supabase Admin API (Recommended)

```bash
npx ts-node src/db/seed-users.ts
```

**Advantages:**
- Creates users in Supabase Auth directly
- Creates MongoDB users and profiles
- Creates posts, documents, quickies, comments
- Handles existing users gracefully
- Password for all users: `123456`

**Requirements:**
- `SUPABASE_SERVICE_ROLE_KEY` must be set
- MongoDB must be accessible

#### Option B: Seed via Backend API (Server must be running)

```bash
npx ts-node src/db/seed-api.ts
```

**Advantages:**
- Uses the actual API endpoints
- Tests the full application flow
- Creates profiles in Supabase automatically

**Requirements:**
- Backend server must be running (`npm run dev`)
- `API_URL` environment variable (defaults to `http://localhost:3000/api`)

#### Option C: Direct MongoDB Seeding (Legacy)

```bash
npx ts-node src/db/seed.ts
```

**Note:** This is a legacy script that directly inserts into MongoDB. It's less integrated with Supabase Auth. Use Option A for new setups.

## Reset and Cleanup

### Reset Data (Keep Auth Users)

Clears all data except Supabase auth users:

```bash
npx ts-node src/db/reset-data.ts
```

**Clears:**
- Supabase: `profiles`, `follows` tables
- MongoDB: All collections (`users`, `posts`, `quickies`, `documents`, `snippets`, `comments`, etc.)

**Keeps:**
- Supabase `auth.users` table

### Complete Clean Slate (Delete Everything)

⚠️ **WARNING:** Deletes ALL data including auth users. Requires confirmation:

```bash
npx ts-node src/db/clean-slate.ts --confirm
```

**Deletes:**
- All Supabase auth users
- All Supabase tables (`profiles`, `follows`)
- All MongoDB collections

## Script Descriptions

### MongoDB Setup
- `nosql/001_mongodb_setup.js` - Creates collections, validators, and indexes

### Supabase SQL Scripts
- `sql/001_supabase_schema.sql` - Base schema (departments, profiles, follows)
- `sql/002_fix_handle_new_user_owner.sql` - Fixes trigger owner permissions
- `sql/003_noop_trigger.sql` - No-op trigger workaround

### Seed Scripts
- `seed-users.ts` - Recommended: Seeds via Supabase Admin API
- `seed-api.ts` - Seeds via backend API (requires running server)
- `seed.ts` - Legacy: Direct MongoDB seeding

### Reset Scripts
- `reset-data.ts` - Reset data while keeping auth users
- `clean-slate.ts` - Complete reset including auth users

## Common Issues

### Trigger Errors on User Signup

If you encounter errors like "permission denied for function handle_new_user", run:

```bash
# In Supabase SQL Editor:
src/db/sql/002_fix_handle_new_user_owner.sql
```

### Supabase Rate Limiting

If seed-users.ts fails due to rate limiting:
- Reduce the number of users being created
- Add delays between user creation (script already has 300ms delay)
- Use existing users (script automatically falls back to existing users)

### MongoDB Connection Issues

Ensure:
- MongoDB URI is correct in `.env`
- MongoDB is running and accessible
- Network/firewall allows connection

## Data Model Summary

### Supabase (PostgreSQL)
- `auth.users` - Authentication (managed by Supabase)
- `public.profiles` - User profiles
- `public.departments` - Department/organization data
- `public.follows` - User follow relationships

### MongoDB
- `users` - User data (synced with Supabase)
- `posts` - User posts with content blocks
- `documents` - Collaborative documents
- `quickies` - Ephemeral stories (24h TTL)
- `comments` - Comments on posts
- `notifications` - User notifications
- `snippets` - Code snippets
- `likes`, `bookmarks`, `connections` - Additional features

## Support

For issues or questions:
1. Check this README first
2. Review individual script comments
3. Check Supabase and MongoDB logs
4. Verify environment variables are set correctly
