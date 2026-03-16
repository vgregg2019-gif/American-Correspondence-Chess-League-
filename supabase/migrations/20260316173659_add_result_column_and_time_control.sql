/*
  # Add result and time_control columns to games table

  ## Changes
  
  1. **Add result column**
     - `result` (text, nullable) - Standard chess notation: '1-0', '0-1', '1/2-1/2', or null for active games
     - Makes it easier to display game outcomes without calculating from winner_id
  
  2. **Add time_control column**
     - `time_control` (integer, default 172800) - Time control in seconds (default 48 hours)
     - Enables different time controls per game in the future
  
  ## Migration Strategy
  - Uses IF NOT EXISTS pattern to safely add columns
  - No data loss - existing games remain unchanged
  - New games will automatically use the new columns

  ## Important Notes
  - This fixes the 500 error when making moves (API was querying non-existent columns)
  - Resign functionality will now properly update the result column
  - Games table now supports both legacy (winner_id/end_reason) and new (result) formats
*/

-- Add result column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'result'
  ) THEN
    ALTER TABLE games ADD COLUMN result text CHECK (result IN ('1-0', '0-1', '1/2-1/2'));
  END IF;
END $$;

-- Add time_control column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'time_control'
  ) THEN
    ALTER TABLE games ADD COLUMN time_control integer NOT NULL DEFAULT 172800;
  END IF;
END $$;
