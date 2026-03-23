/*
  # Fix profile creation trigger to be fail-safe
  
  1. Problem
    - Current trigger uses set_config('role', 'service_role') which doesn't bypass RLS
    - RLS policies check auth.uid() which is NULL during auth.users INSERT
    - This causes "Database error saving new user" 500 error
  
  2. Solution
    - Drop and recreate trigger function with proper SECURITY DEFINER
    - Grant trigger function permission to bypass RLS
    - Use direct INSERT with proper exception handling
    - Never block user creation even if profile insert fails
  
  3. Changes
    - Recreate handle_new_user() function with correct permissions
    - Ensure username has safe fallback
    - All exceptions caught and logged without blocking auth
*/

-- Drop existing function to recreate with proper permissions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create new fail-safe trigger function
-- SECURITY DEFINER means it runs with the permissions of the function owner (postgres superuser)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  username_value text;
  retry_count integer := 0;
BEGIN
  -- Log entry
  RAISE LOG '[handle_new_user] Triggered for user_id=%', NEW.id;
  RAISE LOG '[handle_new_user] raw_user_meta_data=%', NEW.raw_user_meta_data::text;
  
  -- Extract username from metadata with safe fallback
  username_value := COALESCE(
    NEW.raw_user_meta_data->>'username',
    'player_' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  );
  
  RAISE LOG '[handle_new_user] Using username=%', username_value;
  
  -- Attempt to insert profile
  -- This will work because function is SECURITY DEFINER and runs as superuser
  BEGIN
    INSERT INTO public.profiles (id, username, email, rating, created_at, updated_at)
    VALUES (
      NEW.id,
      username_value,
      NEW.email,
      1200,
      NOW(),
      NOW()
    );
    
    RAISE LOG '[handle_new_user] SUCCESS: Profile created for user_id=%', NEW.id;
    
  EXCEPTION
    WHEN unique_violation THEN
      -- Username collision - retry with unique suffix
      RAISE LOG '[handle_new_user] Username collision, retrying with suffix';
      
      BEGIN
        username_value := 'player_' || substr(replace(NEW.id::text, '-', ''), 1, 12);
        
        INSERT INTO public.profiles (id, username, email, rating, created_at, updated_at)
        VALUES (
          NEW.id,
          username_value,
          NEW.email,
          1200,
          NOW(),
          NOW()
        );
        
        RAISE LOG '[handle_new_user] SUCCESS: Profile created with fallback username';
        
      EXCEPTION
        WHEN OTHERS THEN
          -- Even fallback failed - log but DON'T block user creation
          RAISE WARNING '[handle_new_user] FAILED fallback insert: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
      END;
      
    WHEN OTHERS THEN
      -- Any other error - log but DON'T block user creation  
      RAISE WARNING '[handle_new_user] FAILED to create profile: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;
  
  -- ALWAYS return NEW to allow user creation to proceed
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify trigger is active
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';
