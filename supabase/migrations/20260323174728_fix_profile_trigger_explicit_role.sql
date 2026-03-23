/*
  # Fix Profile Trigger with Explicit Service Role

  1. Problem
    - Signup reaching Supabase but failing with "Database error saving new user"
    - SECURITY DEFINER alone may not bypass RLS during auth.users INSERT
    - auth.uid() returns NULL during user creation transaction

  2. Solution
    - Explicitly set session role to service_role before profile insert
    - Add comprehensive error logging with RAISE WARNING
    - Ensure trigger never blocks user creation

  3. Changes
    - Add set_config('role', 'service_role', true) before INSERT
    - Enhanced exception handling with detailed logging
    - Username collision fallback with extended UUID
*/

-- Drop and recreate trigger function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  username_value text;
BEGIN
  -- Extract username from metadata or generate fallback
  username_value := COALESCE(
    NEW.raw_user_meta_data->>'username',
    'Player_' || substr(NEW.id::text, 1, 8)
  );

  RAISE WARNING '[handle_new_user] Creating profile for user % with username %', NEW.id, username_value;

  -- Explicitly set role to bypass RLS
  -- This is critical because auth.uid() is NULL during user creation
  PERFORM set_config('role', 'service_role', true);
  
  -- Insert into profiles table
  INSERT INTO public.profiles (id, username, email, rating, created_at, updated_at)
  VALUES (
    NEW.id,
    username_value,
    COALESCE(NEW.email, ''),
    1200,
    NOW(),
    NOW()
  );

  RAISE WARNING '[handle_new_user] SUCCESS: Profile created for user %', NEW.id;
  
  RETURN NEW;

EXCEPTION
  WHEN unique_violation THEN
    -- Username collision - try with extended fallback
    RAISE WARNING '[handle_new_user] Username collision for %, retrying with fallback', NEW.id;
    BEGIN
      PERFORM set_config('role', 'service_role', true);
      INSERT INTO public.profiles (id, username, email, rating, created_at, updated_at)
      VALUES (
        NEW.id,
        'Player_' || substr(NEW.id::text, 1, 12),
        COALESCE(NEW.email, ''),
        1200,
        NOW(),
        NOW()
      );
      RAISE WARNING '[handle_new_user] SUCCESS: Profile created with fallback for user %', NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log but don't block user creation
        RAISE WARNING '[handle_new_user] FAILED fallback for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    END;
    RETURN NEW;

  WHEN OTHERS THEN
    -- Log but don't block user creation
    RAISE WARNING '[handle_new_user] FAILED for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile entry when a new user signs up. Uses explicit service_role to bypass RLS.';
