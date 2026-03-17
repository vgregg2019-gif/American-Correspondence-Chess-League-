/*
  # Recreate moves table to force PostgREST schema cache reload
  
  This migration completely recreates the moves table to force Supabase PostgREST
  to recognize all columns. This is safe because the table is currently empty.
  
  1. Drop existing table and policies
  2. Recreate table with exact same structure
  3. Recreate RLS policies
  4. Notify PostgREST to reload
*/

-- Drop existing policies first
DROP POLICY IF EXISTS "Players can view moves for their games" ON public.moves;
DROP POLICY IF EXISTS "Players can insert moves for their games" ON public.moves;

-- Drop the table
DROP TABLE IF EXISTS public.moves CASCADE;

-- Recreate the table with all columns
CREATE TABLE public.moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  move_number integer NOT NULL,
  move text NOT NULL,
  fen text NOT NULL,
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add comments for documentation
COMMENT ON COLUMN public.moves.game_id IS 'Foreign key reference to the game';
COMMENT ON COLUMN public.moves.move IS 'Move in SAN (Standard Algebraic Notation)';
COMMENT ON COLUMN public.moves.fen IS 'Position after this move in FEN notation';
COMMENT ON COLUMN public.moves.player_id IS 'Foreign key reference to the player who made this move';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_moves_game_id ON public.moves(game_id);
CREATE INDEX IF NOT EXISTS idx_moves_player_id ON public.moves(player_id);

-- Enable RLS
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

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

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';