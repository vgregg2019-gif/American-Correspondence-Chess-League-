/*
  # Force schema cache reload for moves table
  
  This migration forces Supabase PostgREST to reload the schema cache by:
  1. Adding a temporary column
  2. Immediately dropping it
  
  This aggressive approach ensures the schema cache picks up all existing columns
  including 'move' and 'fen' which are currently missing from the cache.
*/

-- Add and immediately drop a temporary column to force schema reload
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS temp_cache_refresh boolean DEFAULT false;
ALTER TABLE public.moves DROP COLUMN IF EXISTS temp_cache_refresh;

-- Explicitly notify PostgREST about the schema change
NOTIFY pgrst, 'reload schema';
