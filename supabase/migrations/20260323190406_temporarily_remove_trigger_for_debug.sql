/*
  # Temporarily Remove Trigger for Debugging

  1. Purpose
    - Remove trigger to test if it's causing the 500 error
    - If signup works without trigger, we know trigger has an issue
    - If signup still fails, the problem is elsewhere
  
  2. Action
    - Drop trigger (can't disable it, don't have permission)
    - Keep function for now
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
