/*
  # Refresh schema cache for Vercel deployment
  
  This migration forces Supabase to refresh its schema cache by performing a harmless
  operation. This resolves the "Could not find the 'fen' column" error in production.
  
  The 'fen' column already exists, but Vercel's deployment was using a stale schema cache.
*/

-- Add a comment to the fen column to trigger schema cache refresh
COMMENT ON COLUMN public.moves.fen IS 'Position after this move in FEN notation';

-- Add a comment to the move column for documentation
COMMENT ON COLUMN public.moves.move IS 'Move in SAN (Standard Algebraic Notation)';

-- Add a comment to the game_id column
COMMENT ON COLUMN public.moves.game_id IS 'Foreign key reference to the game';

-- Add a comment to the player_id column  
COMMENT ON COLUMN public.moves.player_id IS 'Foreign key reference to the player who made this move';
