/*
  # Force PostgREST Schema Cache Reload for games table

  1. Purpose
    - Force PostgREST to reload its schema cache for the games table
    - Fixes PGRST204 error: "Could not find the 'turn' column of 'games' in the schema cache"

  2. Changes
    - Add a temporary comment to the games table to trigger schema detection
    - Remove the comment immediately after
    - This forces PostgREST to re-scan the table structure

  3. Notes
    - The turn column exists in the actual schema but PostgREST cache is stale
    - This is a safe operation that doesn't modify data or structure
*/

-- Add and remove a comment to force schema cache refresh
COMMENT ON TABLE public.games IS 'Chess games - cache refresh 2026-03-17';
COMMENT ON TABLE public.games IS NULL;

-- Notify PostgREST to reload
NOTIFY pgrst, 'reload schema';
