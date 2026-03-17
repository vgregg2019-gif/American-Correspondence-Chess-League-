/*
  # Recreate RLS policies to force schema cache refresh
  
  This migration drops and recreates the RLS policies on the moves table.
  This forces PostgREST to re-examine the table schema and reload the cache.
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Players can view moves for their games" ON public.moves;
DROP POLICY IF EXISTS "Players can insert moves for their games" ON public.moves;

-- Recreate SELECT policy
CREATE POLICY "Players can view moves for their games"
  ON public.moves
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = moves.game_id
        AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
    )
  );

-- Recreate INSERT policy
CREATE POLICY "Players can insert moves for their games"
  ON public.moves
  FOR INSERT
  TO authenticated
  WITH CHECK (
    player_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = moves.game_id
        AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
    )
  );

-- Send reload notification
NOTIFY pgrst, 'reload schema';