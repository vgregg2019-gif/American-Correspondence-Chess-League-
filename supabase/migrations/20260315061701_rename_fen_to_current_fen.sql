/*
  # Rename fen column to current_fen

  ## Changes
  - Rename the `fen` column in the `games` table to `current_fen`
  - This makes the column name more descriptive and matches the application's naming convention

  ## Security Notes
  - This is a non-destructive schema change
  - All existing data is preserved
  - No RLS policies need to be updated
*/

-- Rename the column
ALTER TABLE games RENAME COLUMN fen TO current_fen;
