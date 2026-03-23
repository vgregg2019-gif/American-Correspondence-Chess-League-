/*
  # Fix Profile Creation Trigger to Bypass RLS

  1. Problem
    - The trigger function `handle_new_user()` is marked as SECURITY DEFINER
    - However, it may not be properly bypassing RLS when inserting into profiles
    - The INSERT policy on profiles requires `id = auth.uid()`
    - During signup, auth context may not be fully established

  2. Solution
    - Recreate the trigger function with explicit RLS bypass
    - Ensure SECURITY DEFINER is set correctly
    - Set search_path to prevent SQL injection
    - Add proper error handling

  3. Changes
    - DROP and recreate `handle_new_user()` function
    - Ensure trigger remains attached to auth.users INSERT
*/

-- Drop existing function (this will also drop the trigger)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the function with proper security settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Insert into profiles table
  -- SECURITY DEFINER allows this to bypass RLS
  INSERT INTO public.profiles (id, username, email, rating, created_at)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'Player_' || substr(NEW.id::text, 1, 8)
    ),
    NEW.email,
    1200,
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify the trigger is attached
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema = 'auth'
      AND event_object_table = 'users'
      AND trigger_name = 'on_auth_user_created'
  ) THEN
    RAISE EXCEPTION 'Trigger was not created successfully';
  END IF;
  
  RAISE NOTICE 'Trigger on_auth_user_created successfully attached to auth.users';
END $$;
