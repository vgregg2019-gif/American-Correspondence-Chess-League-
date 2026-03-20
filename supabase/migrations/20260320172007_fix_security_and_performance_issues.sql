/*
  # Fix Security and Performance Issues

  ## Changes Made

  ### 1. Add Missing Indexes on Foreign Keys
  - Add index on `games.winner_id` for better query performance on winner lookups
  - Add index on `matchmaking_queue.player_id` for faster player queue queries
  - Add index on `tournament_players.player_id` for improved tournament player lookups

  ### 2. Optimize RLS Policies for Better Performance
  Replace `auth.uid()` with `(select auth.uid())` in all RLS policies to prevent re-evaluation per row:
  - profiles table: update and insert policies
  - games table: view, create, and update policies
  - matchmaking_queue table: insert and delete policies
  - moves table: view and insert policies

  ### 3. Remove Unused Indexes
  - Drop `idx_games_status` - not being used
  - Drop `idx_games_timeout` - not being used
  - Drop `idx_matchmaking_rating` - not being used
  - Drop `idx_tournament_players_tournament` - not being used
  - Drop `idx_moves_player_id` - not being used

  ## Security Notes
  - All RLS policies remain restrictive and secure
  - Performance improvements do not compromise security
  - Foreign key indexes improve query performance without changing behavior
*/

-- Add missing indexes on foreign keys
CREATE INDEX IF NOT EXISTS idx_games_winner_id ON games(winner_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_player_id ON matchmaking_queue(player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_player_id ON tournament_players(player_id);

-- Drop unused indexes
DROP INDEX IF EXISTS idx_games_status;
DROP INDEX IF EXISTS idx_games_timeout;
DROP INDEX IF EXISTS idx_matchmaking_rating;
DROP INDEX IF EXISTS idx_tournament_players_tournament;
DROP INDEX IF EXISTS idx_moves_player_id;

-- Optimize profiles RLS policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- Optimize games RLS policies
DROP POLICY IF EXISTS "Players can view their own games" ON games;
DROP POLICY IF EXISTS "Users can create games where they are a player" ON games;
DROP POLICY IF EXISTS "Players can update their own games" ON games;

CREATE POLICY "Players can view their own games"
  ON games
  FOR SELECT
  TO authenticated
  USING (white_player_id = (select auth.uid()) OR black_player_id = (select auth.uid()));

CREATE POLICY "Users can create games where they are a player"
  ON games
  FOR INSERT
  TO authenticated
  WITH CHECK (
    white_player_id = (select auth.uid()) OR black_player_id = (select auth.uid())
  );

CREATE POLICY "Players can update their own games"
  ON games
  FOR UPDATE
  TO authenticated
  USING (white_player_id = (select auth.uid()) OR black_player_id = (select auth.uid()))
  WITH CHECK (white_player_id = (select auth.uid()) OR black_player_id = (select auth.uid()));

-- Optimize matchmaking_queue RLS policies
DROP POLICY IF EXISTS "Users can insert themselves into queue" ON matchmaking_queue;
DROP POLICY IF EXISTS "Users can delete own queue entry" ON matchmaking_queue;

CREATE POLICY "Users can insert themselves into queue"
  ON matchmaking_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (player_id = (select auth.uid()));

CREATE POLICY "Users can delete own queue entry"
  ON matchmaking_queue
  FOR DELETE
  TO authenticated
  USING (player_id = (select auth.uid()));

-- Optimize moves RLS policies
DROP POLICY IF EXISTS "Players can view moves for their games" ON moves;
DROP POLICY IF EXISTS "Players can insert moves for their games" ON moves;

CREATE POLICY "Players can view moves for their games"
  ON moves
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = moves.game_id
      AND (games.white_player_id = (select auth.uid()) OR games.black_player_id = (select auth.uid()))
    )
  );

CREATE POLICY "Players can insert moves for their games"
  ON moves
  FOR INSERT
  TO authenticated
  WITH CHECK (
    player_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM games
      WHERE games.id = moves.game_id
      AND (games.white_player_id = (select auth.uid()) OR games.black_player_id = (select auth.uid()))
    )
  );