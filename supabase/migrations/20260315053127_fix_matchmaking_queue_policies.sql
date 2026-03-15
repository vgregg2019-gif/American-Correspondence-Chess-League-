/*
  # Fix Matchmaking Queue Policies

  ## Changes
  - Add policy to allow users to delete any queue entry when creating a match
  - This is necessary for the matchmaking system where one player removes another from the queue

  ## Security Notes
  - Users can only delete from the queue, not modify
  - Insertion still requires the user to be adding themselves
  - This enables the matchmaking flow where Player A removes Player B from queue when they match
*/

-- Drop the restrictive delete policy
DROP POLICY IF EXISTS "Users can delete themselves from queue" ON matchmaking_queue;

-- Create a more permissive delete policy for matchmaking
CREATE POLICY "Users can delete from matchmaking queue"
  ON matchmaking_queue FOR DELETE
  TO authenticated
  USING (true);
