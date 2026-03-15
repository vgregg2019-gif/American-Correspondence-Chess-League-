/*
  # Tighten Supabase Security Policies

  ## Security Improvements
  
  1. **Fix mutable search_path warning**
     - Add SECURITY DEFINER and SET search_path to update_updated_at_column function
  
  2. **Games table**
     - INSERT: Only allow when user is one of the two players (matchmaking flow)
     - SELECT: Only players in the game can view it (already correct)
     - UPDATE: Only players in the game can update it
     - DELETE: Not needed, keep blocked
  
  3. **Matchmaking Queue**
     - INSERT: Users can only insert themselves (already correct)
     - SELECT: Users can view the queue to find opponents (keep as is for matchmaking)
     - DELETE: Users can only delete their own entry (was too permissive)
  
  4. **Moves table**
     - INSERT: Users can only insert moves for games they're playing in
     - SELECT: Users can only view moves for their games (already correct)
  
  5. **Profiles table**
     - SELECT: Keep open for authenticated users (needed to see opponents)
     - Other operations: Already properly secured

  ## Important Notes
  - No data loss or breaking changes
  - All existing functionality preserved
  - Security tightened without weakening protections
  - Follows principle of least privilege
*/

-- ==========================================
-- 1. Fix the search_path warning
-- ==========================================

-- Drop and recreate the function with proper security attributes
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Recreate all triggers that use this function
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 2. Tighten Games table policies
-- ==========================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "System can insert games" ON games;
DROP POLICY IF EXISTS "System can update games" ON games;

-- INSERT: Only allow when the authenticated user is one of the two players
-- This allows matchmaking to work (user creates game where they're a player)
CREATE POLICY "Users can create games where they are a player"
  ON games FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = white_player_id OR auth.uid() = black_player_id
  );

-- UPDATE: Only allow players in the game to update it
CREATE POLICY "Players can update their own games"
  ON games FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = white_player_id OR auth.uid() = black_player_id
  )
  WITH CHECK (
    auth.uid() = white_player_id OR auth.uid() = black_player_id
  );

-- ==========================================
-- 3. Tighten Matchmaking Queue policies
-- ==========================================

-- Drop the overly permissive delete policy
DROP POLICY IF EXISTS "Users can delete from matchmaking queue" ON matchmaking_queue;

-- DELETE: Users can only delete their own queue entry
CREATE POLICY "Users can delete own queue entry"
  ON matchmaking_queue FOR DELETE
  TO authenticated
  USING (auth.uid() = player_id);

-- ==========================================
-- 4. Tighten Moves table policies
-- ==========================================

-- Drop the permissive insert policy
DROP POLICY IF EXISTS "System can insert moves" ON moves;

-- INSERT: Users can only insert moves for games they're playing in
CREATE POLICY "Players can insert moves for their games"
  ON moves FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = game_id
      AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
    )
    AND player_id = auth.uid()
  );