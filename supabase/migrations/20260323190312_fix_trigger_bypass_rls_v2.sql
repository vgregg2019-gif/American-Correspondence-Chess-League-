/*
  # Fix Trigger to Bypass RLS

  1. Problem
    - RLS policies block trigger from inserting into profiles
    - Trigger runs during signup when no auth session exists
  
  2. Solution
    - Add policy for postgres role (function owner)
    - Ensure service_role policy exists
  
  3. Security
    - Function only called by trigger
    - Policies restricted to internal roles
*/

-- Drop and recreate trigger components
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  username_value text;
BEGIN
  username_value := COALESCE(
    NEW.raw_user_meta_data->>'username',
    'player_' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  );

  INSERT INTO public.profiles (id, username, email, rating, created_at, updated_at)
  VALUES (NEW.id, username_value, NEW.email, 1200, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
  
EXCEPTION
  WHEN unique_violation THEN
    BEGIN
      username_value := 'player_' || substr(replace(NEW.id::text, '-', ''), 1, 12);
      INSERT INTO public.profiles (id, username, email, rating, created_at, updated_at)
      VALUES (NEW.id, username_value, NEW.email, 1200, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
    END;
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure postgres role can insert (function owner)
DROP POLICY IF EXISTS "Bypass RLS for function owner" ON public.profiles;
CREATE POLICY "Bypass RLS for function owner"
  ON public.profiles
  FOR INSERT
  TO postgres
  WITH CHECK (true);
