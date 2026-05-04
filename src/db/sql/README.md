# Supabase SQL setup (DevConnect)

Run the SQL file in Supabase SQL Editor:

1. Open SQL Editor in Supabase dashboard.
2. Run `001_supabase_schema.sql`.

## What it creates

- Trigger function `update_updated_at()`
- Tables:
  - `public.departments`
  - `public.profiles`
  - `public.follows`
- Triggers:
  - `trg_departments_updated_at`
  - `trg_profiles_updated_at`
  - `on_auth_user_created` (auto-create profile)
- RLS enabled for all three tables
- Policies for public reads, self-service writes, and admin management

## Auth model

- Supabase Auth remains source of truth in `auth.users`
- `public.profiles.id` references `auth.users.id`
- Follow edges (`public.follows`) also reference `auth.users.id`
