-- Fix: ensure the handle_new_user trigger function runs with definer privileges
-- and is owned by the postgres role so it can insert into public.profiles
-- Run this in the Supabase SQL editor as a project owner

-- Step 1: Create unique index on user_id (required for ON CONFLICT to work)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_unique ON public.profiles(user_id);

-- Step 2: Recreate function with SECURITY DEFINER (idempotent)
-- Supports both schema variants:
-- 1) profiles.id references auth.users.id
-- 2) profiles has separate id + user_id references auth.users.id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  has_user_id boolean;
  has_id_default boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'user_id'
  ) INTO has_user_id;

  IF has_user_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'id'
        AND column_default IS NOT NULL
    ) INTO has_id_default;

    IF has_id_default THEN
      INSERT INTO public.profiles (user_id, username, display_name)
      VALUES (
        NEW.id,
        split_part(NEW.email, '@', 1),
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
      )
      ON CONFLICT (user_id) DO NOTHING;
    ELSE
      INSERT INTO public.profiles (id, user_id, username, display_name)
      VALUES (
        NEW.id,
        NEW.id,
        split_part(NEW.email, '@', 1),
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  ELSE
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
      NEW.id,
      split_part(NEW.email, '@', 1),
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ language plpgsql SECURITY DEFINER;

-- Ensure the function owner is set to the current SQL user (project owner executing this)
DO $$
BEGIN
  -- Set owner to the current user running this script (idempotent)
  EXECUTE 'ALTER FUNCTION public.handle_new_user() OWNER TO ' || quote_ident(current_user);
END$$;

-- (Optional) Recreate trigger to be safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Notes:
-- 1) Run this ENTIRE file as project owner in Supabase SQL editor (all statements together).
-- 2) The unique index creation MUST run before the trigger function.
-- 3) If your project uses a different owner role than 'postgres', change the OWNER TO clause accordingly.
