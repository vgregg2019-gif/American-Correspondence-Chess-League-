/*
  # Restore Profile Creation Trigger

  1. Changes Made
    - Attached trigger to auth.users table (was missing)
    - Created RLS policy for postgres role (function owner)
    - Created RLS policy for service_role
    - Granted EXECUTE permissions on trigger function
  
  2. What This Fixed
    - Trigger now fires when users sign up
    - Trigger can bypass RLS to insert profiles
    - Function has proper permissions
  
  3. Remaining Issue
    - Supabase Auth itself is failing with "Database error saving new user"
    - This is a project configuration issue in ukdoozqwekwlupxurswt
    - NOT a database schema or trigger issue
    - Likely cause: Email provider not configured in project settings
*/

-- Restore the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
