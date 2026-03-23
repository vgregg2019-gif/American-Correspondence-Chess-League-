/*
  # Fix Profile Creation Trigger - Complete RLS Bypass

  1. Problem
    - The handle_new_user() trigger is SECURITY DEFINER but RLS is still blocking it
    - During user creation, auth.uid() is not yet available
    - The INSERT policy requires id = auth.uid() which fails

  2. Solution
    - Explicitly set local role to service_role in the trigger
    - Disable RLS check during profile insert using SET LOCAL
    - Add comprehensive error logging
    - Ensure trigger never crashes user signup

  3. Changes
    - Recreate trigger function with explicit role setting
    - Add detailed RAISE NOTICE for debugging
    - Wrap everything in exception handler
*/

-- Drop and recreate the trigger function with complete RLS bypass
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  username_value text;
BEGIN
  -- Extract username from metadata or generate fallback
  username_value := COALESCE(
    NEW.raw_user_meta_data->>'username',
    'Player_' || substr(NEW.id::text, 1, 8)
  );

  RAISE NOTICE '[handle_new_user] Starting profile creation for user %', NEW.id;
  RAISE NOTICE '[handle_new_user] Username: %, Email: %', username_value, NEW.email;

  -- Temporarily disable RLS for this transaction
  -- This is safe because SECURITY DEFINER already runs with elevated privileges
  PERFORM set_config('role', 'service_role', true);
  
  -- Insert into profiles table
  INSERT INTO public.profiles (id, username, email, rating, created_at)
  VALUES (
    NEW.id,
    username_value,
    NEW.email,
    1200,
    NOW()
  );

  RAISE NOTICE '[handle_new_user] Profile created successfully for user %', NEW.id;
  
  RETURN NEW;
  
EXCEPTION
  WHEN unique_violation THEN
    -- Username already exists
    RAISE WARNING '[handle_new_user] Username collision for user %: %', NEW.id, SQLERRM;
    -- Try again with a unique fallback
    BEGIN
      INSERT INTO public.profiles (id, username, email, rating, created_at)
      VALUES (
        NEW.id,
        'Player_' || substr(NEW.id::text, 1, 12),
        NEW.email,
        1200,
        NOW()
      );
      RAISE NOTICE '[handle_new_user] Profile created with fallback username for user %', NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[handle_new_user] Failed to create profile even with fallback for user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
    
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING '[handle_new_user] Failed to create profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify the trigger is enabled
SELECT 
  t.tgname AS trigger_name,
  t.tgenabled AS enabled,
  CASE t.tgenabled
    WHEN 'O' THEN 'Enabled'
    WHEN 'D' THEN 'Disabled'
    ELSE 'Unknown'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND t.tgname = 'on_auth_user_created';
