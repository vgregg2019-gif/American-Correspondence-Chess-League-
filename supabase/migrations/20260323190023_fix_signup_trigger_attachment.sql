/*
  # Fix Signup Trigger - Attach Trigger to auth.users

  1. Problem
    - Trigger function handle_new_user() exists in public schema
    - But trigger is NOT attached to auth.users table
    - This causes signup to fail with "Database error saving new user"
  
  2. Solution
    - Drop any existing trigger (if present)
    - Create trigger on auth.users AFTER INSERT
    - Trigger calls public.handle_new_user() function
  
  3. Security
    - Trigger fires AFTER INSERT to ensure user is created first
    - Function runs with SECURITY DEFINER (has permissions to insert into profiles)
    - Function has error handling to never block user creation
*/

-- Drop trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
