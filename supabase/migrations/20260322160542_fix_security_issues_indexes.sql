/*
  # Fix Security Issues - Database Indexes

  1. Performance Improvements
    - Add missing index on moves.player_id foreign key (critical for query performance)
    - Remove unused indexes that add unnecessary overhead:
      - idx_tournament_players_player_id (not used)
      - idx_games_winner_id (not used, winner_id rarely queried)
      - idx_matchmaking_queue_player_id (not used)
  
  2. Rationale
    - moves.player_id is frequently queried when fetching move history
    - Unused indexes waste storage and slow down write operations
    - Keeping only actively used indexes improves overall database performance
*/

-- Add missing index for moves.player_id foreign key
-- This is critical for move history queries
CREATE INDEX IF NOT EXISTS idx_moves_player_id ON moves(player_id);

-- Remove unused indexes to reduce overhead
DROP INDEX IF EXISTS idx_tournament_players_player_id;
DROP INDEX IF EXISTS idx_games_winner_id;
DROP INDEX IF EXISTS idx_matchmaking_queue_player_id;

-- Verify critical indexes exist for active queries
-- These should already exist but we ensure they're present
CREATE INDEX IF NOT EXISTS idx_moves_game_id ON moves(game_id);
CREATE INDEX IF NOT EXISTS idx_games_white_player_id ON games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_games_black_player_id ON games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_rating ON matchmaking_queue(rating);
