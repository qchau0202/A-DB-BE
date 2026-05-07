-- Workaround: Replace the failing trigger with a NO-OP function
-- This allows auth.users signup to succeed without being blocked by trigger errors
-- Profile creation will be handled by the backend code instead

-- Step 1: Create a no-op function that just returns NEW
CREATE OR REPLACE FUNCTION public.noop_trigger_handler()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Recreate trigger to use the no-op function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.noop_trigger_handler();

-- Notes:
-- The original trigger was failing and blocking signup.
-- This no-op trigger allows signup to succeed.
-- Profile creation is now handled by backend code after user signup completes.
