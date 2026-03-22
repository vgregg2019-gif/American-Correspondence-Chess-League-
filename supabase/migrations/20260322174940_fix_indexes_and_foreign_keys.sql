/*
  # Fix Database Security and Performance Issues

  This migration addresses multiple security and performance issues:

  ## 1. Unindexed Foreign Keys
  - Add index on `games.winner_id` for foreign key `games_winner_id_fkey`
  - Add index on `matchmaking_queue.player_id` for foreign key `matchmaking_queue_player_id_fkey`
  - Add index on `tournament_players.player_id` for foreign key `tournament_players_player_id_fkey`

  ## 2. Duplicate Indexes
  - Drop duplicate index `idx_games_white_player` (keeping `idx_games_white_player_id`)
  - Drop duplicate index `idx_games_black_player` (keeping `idx_games_black_player_id`)

  ## 3. Unused Indexes
  - Drop `idx_games_status` (not being used by queries)
  - Drop `idx_moves_player_id` (not being used by queries)
  - Drop `idx_matchmaking_queue_rating` (not being used by queries)

  Note: The white_player and black_player indexes are kept as they ARE used by game queries.
*/

-- ===== 1. Add Missing Indexes for Foreign Keys =====

-- Index for games.winner_id foreign key
CREATE INDEX IF NOT EXISTS idx_games_winner_id 
  ON public.games(winner_id) 
  WHERE winner_id IS NOT NULL;

-- Index for matchmaking_queue.player_id foreign key
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_player_id 
  ON public.matchmaking_queue(player_id);

-- Index for tournament_players.player_id foreign key
CREATE INDEX IF NOT EXISTS idx_tournament_players_player_id 
  ON public.tournament_players(player_id);

-- ===== 2. Drop Duplicate Indexes =====

-- Drop duplicate white_player index (keep idx_games_white_player_id)
DROP INDEX IF EXISTS public.idx_games_white_player;

-- Drop duplicate black_player index (keep idx_games_black_player_id)
DROP INDEX IF EXISTS public.idx_games_black_player;

-- ===== 3. Drop Unused Indexes =====

-- Drop unused status index (queries don't use it)
DROP INDEX IF EXISTS public.idx_games_status;

-- Drop unused moves player_id index (queries don't use it)
DROP INDEX IF EXISTS public.idx_moves_player_id;

-- Drop unused matchmaking rating index (queries don't use it)
DROP INDEX IF EXISTS public.idx_matchmaking_queue_rating;

-- ===== Performance Notes =====

/*
  After this migration:
  - All foreign keys have covering indexes for optimal JOIN performance
  - No duplicate indexes wasting storage and update performance
  - Only actively used indexes remain, reducing maintenance overhead
  
  Expected improvements:
  - Faster queries on games by winner
  - Faster matchmaking queue lookups
  - Faster tournament player queries
  - Reduced index maintenance during INSERT/UPDATE/DELETE
  - Lower storage usage
*/
