/*
  # Fix RLS Policy for Trigger Insert

  1. Problem
    - Trigger runs during auth.users INSERT (BEFORE user session exists)
    - Existing policy checks auth.uid() = id, but auth.uid() is NULL during signup
    - This blocks the trigger from inserting into profiles
  
  2. Solution
    - Add new INSERT policy for service_role (used by triggers with SECURITY DEFINER)
    - This policy allows inserts when there's no active session
    - Keep existing policy for authenticated users
  
  3. Security
    - Policy only allows service_role (internal Supabase operations)
    - Trigger function has SECURITY DEFINER so it runs as owner
    - Regular users still need to match auth.uid()
*/

-- Create policy for service role / trigger context
CREATE POLICY "Service role can insert profiles"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Also ensure authenticated role policy is correct
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());
