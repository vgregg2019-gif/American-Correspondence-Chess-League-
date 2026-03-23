/*
  # Grant Execute Permissions on Trigger Function

  1. Problem
    - Trigger function may not be executable by Supabase Auth's service role
  
  2. Solution
    - Grant EXECUTE permission on handle_new_user() to relevant roles
  
  3. Security
    - Function has SECURITY DEFINER so it runs as owner
    - Granting EXECUTE only allows calling the function
*/

-- Grant execute permission to all relevant roles
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
