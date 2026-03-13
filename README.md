# ACCL - American Correspondence Chess League

A full-stack correspondence chess platform built with Next.js and Supabase.

## Features

- User registration and authentication
- Correspondence chess games with 48-hour time controls per move
- Real-time game updates using Supabase Realtime
- Legal move validation using chess.js
- Automatic timeout detection
- Game results: checkmate, resignation, timeout, draw, stalemate
- Player matchmaking system
- Rating system (default: 1200 ELO)
- Move history tracking
- Live game timers

## Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS
- **Backend**: Supabase (PostgreSQL + Realtime + Edge Functions)
- **Chess Logic**: chess.js
- **Chess Board UI**: react-chessboard
- **Hosting**: Vercel

## Project Structure

```
/app
  /api/move          - Move submission endpoint
  /dashboard         - Player dashboard with active/completed games
  /game/[id]         - Live game page with board and timers
  /login             - Authentication page
  /register          - User registration
  /profile           - Player profile page

/components
  ChessBoard.tsx     - Interactive chess board component
  GameTimer.tsx      - Live countdown timer component
  MoveList.tsx       - Game move history display

/lib
  chessEngine.ts     - Chess move validation logic
  timeControl.ts     - Timer calculation logic
  supabaseClient.ts  - Supabase client configuration

/supabase/functions
  check-timeouts     - Edge function to detect and process timeouts
```

## Database Schema

- **profiles** - User accounts and ratings
- **games** - Game state, timers, and results
- **moves** - Move history in SAN notation
- **matchmaking_queue** - Players waiting for opponents
- **tournaments** - Tournament structure (placeholder)
- **tournament_players** - Tournament participants (placeholder)

## How It Works

### Timer System

The timer system uses a database-authoritative model:

1. Each game stores `white_time_remaining_seconds` and `black_time_remaining_seconds`
2. When a move is made, elapsed time is calculated and subtracted from the player's remaining time
3. The `timeout_at` field is set to when the current player will run out of time
4. A serverless Edge Function checks for timeouts every 5 minutes
5. Frontend timers are calculated from stored values, not trusted as source of truth

### Move Validation

All moves go through a centralized validation pipeline:

1. Frontend submits move to `/api/move` endpoint
2. Server validates game state and turn
3. Move is validated using chess.js
4. Game state is atomically updated
5. Realtime subscriptions push updates to all clients

### Matchmaking

Simple MVP matchmaking:

1. Player clicks "Find Opponent"
2. System checks for waiting players in queue
3. If found, creates game with random color assignment
4. If not found, adds player to queue

## Security

- Row Level Security (RLS) enabled on all tables
- Players can only view and modify their own games
- Move validation happens server-side
- Game state updates require proper authentication
- Service role key used for privileged operations

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Future Enhancements

- Tournament system implementation
- Engine cheat detection
- Spectator mode
- Live streamed boards
- Leaderboards
- Custom piece sets and themes
- Draw offers
- Game analysis
- Opening book integration
- Player statistics
