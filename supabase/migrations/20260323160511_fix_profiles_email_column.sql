/*
  # Fix profiles table for signup

  ## Problem
  - Profiles table is missing the `email` column
  - The `handle_new_user()` trigger function doesn't populate email
  - This causes signup to fail with "Database error saving new user"

  ## Changes
  1. Add `email` column to profiles table (nullable to avoid breaking existing data)
  2. Update the `handle_new_user()` trigger function to insert email from auth.users
  3. Backfill email for any existing profiles without email

  ## Result
  - Signup will successfully create user AND insert profile with email
  - No data loss for existing profiles
*/

-- Add email column to profiles table (nullable to avoid issues with existing data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
  END IF;
END $$;

-- Update the trigger function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, email, rating, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Player_' || substr(NEW.id::text, 1, 8)),
    NEW.email,
    1200,
    NOW()
  );
  RETURN NEW;
END;
$function$;

-- Backfill email for existing profiles (if any exist without email)
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
