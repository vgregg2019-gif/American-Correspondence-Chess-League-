/*
  # Temporarily Disable Trigger for Diagnosis
  
  Removing trigger to test if it's blocking signup.
*/

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
