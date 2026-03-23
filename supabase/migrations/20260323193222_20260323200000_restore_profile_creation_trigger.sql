/*
  # Restore Profile Creation Trigger

  1. Problem
    - Trigger was disabled in migration 20260323191038_disable_trigger_for_diagnosis.sql
    - Users signing up have no profile row created
    - Causes 500 database errors on signup

  2. Solution
    - Recreate the trigger function with proper security
    - Function runs as SECURITY DEFINER to bypass RLS
    - Explicit INSERT statement with all required fields
    - Attach trigger to auth.users INSERT events

  3. Security
    - Function owned by postgres role
    - SECURITY DEFINER allows RLS bypass
    - Only creates profile for the new user (NEW.id)
    - No user input accepted
*/

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, rating, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text, 1, 8)),
    NEW.email,
    1200,
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, ignore
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Attach the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify trigger is enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created' 
    AND tgrelid = 'auth.users'::regclass
    AND tgenabled = 'O'
  ) THEN
    RAISE NOTICE '✓ Trigger on_auth_user_created is ENABLED';
  ELSE
    RAISE EXCEPTION '✗ Trigger on_auth_user_created is NOT enabled';
  END IF;
END $$;