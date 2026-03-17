/*
  # Auto-create profiles on user signup

  Creates a database trigger that automatically creates a profile row
  in public.profiles whenever a new user signs up in auth.users.

  1. Function
    - `handle_new_user()` - Trigger function that inserts into profiles
  
  2. Trigger
    - Fires AFTER INSERT on auth.users
    - Creates matching profile with default username
  
  3. Security
    - No RLS needed on trigger function (runs as superuser)
    - Profile will inherit user's auth.uid as id
*/

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, rating, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Player_' || substr(NEW.id::text, 1, 8)),
    1200,
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();