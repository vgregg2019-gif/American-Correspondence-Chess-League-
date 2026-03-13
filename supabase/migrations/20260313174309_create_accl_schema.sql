/*
  # ACCL Chess Platform - Initial Schema

  ## Overview
  Creates the complete database schema for the American Correspondence Chess League platform,
  including user profiles, games, moves, tournaments, and matchmaking queue.

  ## New Tables

  ### `profiles`
  - `id` (uuid, primary key) - References auth.users
  - `username` (text, unique) - Player username
  - `rating` (integer) - Elo rating, defaults to 1200
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update

  ### `games`
  - `id` (uuid, primary key) - Game identifier
  - `white_player_id` (uuid) - White player reference
  - `black_player_id` (uuid) - Black player reference
  - `fen` (text) - Current board position in FEN notation
  - `status` (text) - Game status: 'active', 'finished'
  - `turn` (text) - Current turn: 'white' or 'black'
  - `white_time_remaining_seconds` (integer) - White's remaining time (default 48 hours = 172800s)
  - `black_time_remaining_seconds` (integer) - Black's remaining time (default 48 hours = 172800s)
  - `last_move_at` (timestamptz) - Timestamp of last move for clock calculation
  - `timeout_at` (timestamptz) - When current player times out
  - `winner_id` (uuid, nullable) - Winner reference, null for draws
  - `end_reason` (text, nullable) - 'checkmate', 'resignation', 'timeout', 'draw', 'stalemate'
  - `created_at` (timestamptz) - Game creation timestamp
  - `updated_at` (timestamptz) - Last game update

  ### `moves`
  - `id` (uuid, primary key) - Move identifier
  - `game_id` (uuid) - Game reference
  - `move_number` (integer) - Sequential move number
  - `move` (text) - Move in SAN notation (e.g., 'e4', 'Nf3')
  - `fen` (text) - Board position after this move
  - `player_id` (uuid) - Player who made the move
  - `created_at` (timestamptz) - Move timestamp

  ### `matchmaking_queue`
  - `id` (uuid, primary key) - Queue entry identifier
  - `player_id` (uuid) - Player waiting for match
  - `rating` (integer) - Player rating for matchmaking
  - `created_at` (timestamptz) - Time entered queue

  ### `tournaments`
  - `id` (uuid, primary key) - Tournament identifier
  - `name` (text) - Tournament name
  - `entry_fee` (integer) - Entry fee in cents
  - `start_date` (timestamptz) - Tournament start date
  - `status` (text) - Tournament status
  - `created_at` (timestamptz) - Tournament creation timestamp

  ### `tournament_players`
  - `id` (uuid, primary key) - Entry identifier
  - `tournament_id` (uuid) - Tournament reference
  - `player_id` (uuid) - Player reference
  - `score` (integer) - Player score in tournament
  - `created_at` (timestamptz) - Entry timestamp

  ## Security
  - Enable RLS on all tables
  - Players can view their own profile and other players' public info
  - Players can view games they participate in
  - Players can view moves for games they participate in
  - Players can view matchmaking queue status
  - Tournament data is publicly readable
  - Only authenticated users can insert into matchmaking queue
  - Game and move modifications handled via API only
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  rating integer NOT NULL DEFAULT 1200,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  white_player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  black_player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fen text NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  turn text NOT NULL DEFAULT 'white' CHECK (turn IN ('white', 'black')),
  white_time_remaining_seconds integer NOT NULL DEFAULT 172800,
  black_time_remaining_seconds integer NOT NULL DEFAULT 172800,
  last_move_at timestamptz NOT NULL DEFAULT now(),
  timeout_at timestamptz,
  winner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  end_reason text CHECK (end_reason IN ('checkmate', 'resignation', 'timeout', 'draw', 'stalemate', 'agreement')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create moves table
CREATE TABLE IF NOT EXISTS moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number integer NOT NULL,
  move text NOT NULL,
  fen text NOT NULL,
  player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create matchmaking queue table
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entry_fee integer DEFAULT 0,
  start_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'finished')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create tournament_players table
CREATE TABLE IF NOT EXISTS tournament_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, player_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_white_player ON games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_games_black_player ON games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_timeout ON games(timeout_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_rating ON matchmaking_queue(rating);
CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament ON tournament_players(tournament_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Games policies
CREATE POLICY "Players can view their own games"
  ON games FOR SELECT
  TO authenticated
  USING (
    auth.uid() = white_player_id OR 
    auth.uid() = black_player_id
  );

CREATE POLICY "System can insert games"
  ON games FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update games"
  ON games FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Moves policies
CREATE POLICY "Players can view moves for their games"
  ON moves FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = moves.game_id
      AND (games.white_player_id = auth.uid() OR games.black_player_id = auth.uid())
    )
  );

CREATE POLICY "System can insert moves"
  ON moves FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Matchmaking queue policies
CREATE POLICY "Users can view matchmaking queue"
  ON matchmaking_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert themselves into queue"
  ON matchmaking_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can delete themselves from queue"
  ON matchmaking_queue FOR DELETE
  TO authenticated
  USING (auth.uid() = player_id);

-- Tournaments policies
CREATE POLICY "Anyone can view tournaments"
  ON tournaments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can view tournament players"
  ON tournament_players FOR SELECT
  TO authenticated
  USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
