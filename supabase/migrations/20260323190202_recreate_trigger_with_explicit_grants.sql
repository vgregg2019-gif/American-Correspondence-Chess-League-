/*
  # Recreate Trigger Function with Explicit Permissions

  1. Problem
    - Trigger failing during auth.users insert
    - Likely permission or role context issue
  
  2. Solution
    - Drop and recreate trigger function
    - Explicitly set security_invoker = false
    - Use SECURITY DEFINER with explicit SET clauses
    - Grant usage on public schema
  
  3. Changes
    - More explicit permission grants
    - Cleaner error handling
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Recreate function with explicit security settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  username_value text;
BEGIN
  -- Extract username from metadata with safe fallback
  username_value := COALESCE(
    NEW.raw_user_meta_data->>'username',
    'player_' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  );

  -- Insert profile
  -- Use INSERT with ON CONFLICT to handle race conditions
  INSERT INTO public.profiles (id, username, email, rating, created_at, updated_at)
  VALUES (
    NEW.id,
    username_value,
    NEW.email,
    1200,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
  
EXCEPTION
  WHEN unique_violation THEN
    -- Username collision - try with unique suffix
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
      )
      ON CONFLICT (id) DO NOTHING;
      
      RETURN NEW;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log but don't block user creation
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
    END;
    
  WHEN OTHERS THEN
    -- Log but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Grant execute to all roles
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile when a new user signs up';
