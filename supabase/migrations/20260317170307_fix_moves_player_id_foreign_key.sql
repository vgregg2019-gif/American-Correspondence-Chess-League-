/*
  # Fix moves.player_id foreign key constraint
  
  The previous migration incorrectly set player_id to reference auth.users(id).
  This migration corrects it to reference profiles(id), matching the games table.
  
  ## Changes
  - Drop incorrect foreign key constraint on moves.player_id -> auth.users(id)
  - Add correct foreign key constraint on moves.player_id -> profiles(id)
  
  This ensures consistency: both games and moves reference profiles(id), which itself
  references auth.users(id).
*/

-- Drop the incorrect foreign key
ALTER TABLE public.moves 
  DROP CONSTRAINT IF EXISTS moves_player_id_fkey;

-- Add the correct foreign key to profiles
ALTER TABLE public.moves 
  ADD CONSTRAINT moves_player_id_fkey 
  FOREIGN KEY (player_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';