'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { calculateClock } from '@/lib/timeControl';
import ChessBoard from '@/components/ChessBoard';
import GameTimer from '@/components/GameTimer';
import MoveList from '@/components/MoveList';

interface Profile {
  id: string;
  username: string;
  rating: number;
}

interface Game {
  id: string;
  white_player_id: string;
  black_player_id: string;
  fen: string;
  status: 'active' | 'finished';
  turn: 'white' | 'black';
  white_time_remaining_seconds: number;
  black_time_remaining_seconds: number;
  last_move_at: string;
  timeout_at: string | null;
  winner_id: string | null;
  end_reason: string | null;
  white_player: Profile;
  black_player: Profile;
}

interface Move {
  id: string;
  move: string;
  move_number: number;
  player_id: string;
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingPiece, setMovingPiece] = useState(false);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);

  const loadGame = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      setUserId(session.user.id);

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select(`
          *,
          white_player:white_player_id(id, username, rating),
          black_player:black_player_id(id, username, rating)
        `)
        .eq('id', gameId)
        .maybeSingle();

      if (gameError || !gameData) {
        router.replace('/dashboard');
        return;
      }

      if (
        gameData.white_player_id !== session.user.id &&
        gameData.black_player_id !== session.user.id
      ) {
        router.replace('/dashboard');
        return;
      }

      setGame(gameData);

      const clock = calculateClock({
        turn: gameData.turn,
        white_time_remaining_seconds: gameData.white_time_remaining_seconds,
        black_time_remaining_seconds: gameData.black_time_remaining_seconds,
        last_move_at: gameData.last_move_at,
      });

      setWhiteTime(clock.whiteRemaining);
      setBlackTime(clock.blackRemaining);

      const { data: movesData } = await supabase
        .from('moves')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (movesData) {
        setMoves(movesData);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading game:', err);
      setLoading(false);
    }
  }, [gameId, router]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  useEffect(() => {
    if (!game) return;

    const gamesChannel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updatedGame = payload.new as any;

          setGame((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              ...updatedGame,
            };
          });

          const clock = calculateClock({
            turn: updatedGame.turn,
            white_time_remaining_seconds: updatedGame.white_time_remaining_seconds,
            black_time_remaining_seconds: updatedGame.black_time_remaining_seconds,
            last_move_at: updatedGame.last_move_at,
          });

          setWhiteTime(clock.whiteRemaining);
          setBlackTime(clock.blackRemaining);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moves',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newMove = payload.new as Move;
          setMoves((prev) => [...prev, newMove]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gamesChannel);
    };
  }, [gameId, game]);

  async function handleMove(from: string, to: string, promotion?: string): Promise<boolean> {
    if (!game || !userId || movingPiece) return false;

    setMovingPiece(true);

    try {
      const response = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          playerId: userId,
          from,
          to,
          promotion,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Invalid move');
        setMovingPiece(false);
        return false;
      }

      setMovingPiece(false);
      return true;
    } catch (err) {
      console.error('Move error:', err);
      alert('Failed to submit move');
      setMovingPiece(false);
      return false;
    }
  }

  async function handleResign() {
    if (!game || !userId) return;

    const confirmed = confirm('Are you sure you want to resign?');
    if (!confirmed) return;

    const winnerId =
      game.white_player_id === userId
        ? game.black_player_id
        : game.white_player_id;

    const { error } = await supabase
      .from('games')
      .update({
        status: 'finished',
        winner_id: winnerId,
        end_reason: 'resignation',
      })
      .eq('id', game.id);

    if (error) {
      alert('Failed to resign');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading game...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Game not found</p>
      </div>
    );
  }

  const isWhite = game.white_player_id === userId;
  const playerColor = isWhite ? 'white' : 'black';
  const opponent = isWhite ? game.black_player : game.white_player;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-accl-red hover:text-accl-red-light transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {game.status === 'finished' && (
          <div className="card mb-6 text-center border-2 border-accl-red">
            <h2 className="text-2xl font-bold mb-2">Game Over</h2>
            <p className="text-lg">
              {game.winner_id === userId ? (
                <span className="text-green-400">You Won!</span>
              ) : game.winner_id ? (
                <span className="text-red-400">You Lost</span>
              ) : (
                <span className="text-gray-400">Draw</span>
              )}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Reason: {game.end_reason}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4">
              <GameTimer
                initialSeconds={isWhite ? blackTime : whiteTime}
                isActive={game.status === 'active' && game.turn !== playerColor}
                playerName={opponent.username}
                color={isWhite ? 'black' : 'white'}
              />
            </div>

            <div className="flex justify-center mb-4">
              <ChessBoard
                position={game.fen}
                onMoveMade={handleMove}
                playerColor={playerColor}
                currentTurn={game.turn}
                disabled={game.status !== 'active' || movingPiece}
              />
            </div>

            <div className="mb-4">
              <GameTimer
                initialSeconds={isWhite ? whiteTime : blackTime}
                isActive={game.status === 'active' && game.turn === playerColor}
                playerName={game[isWhite ? 'white_player' : 'black_player'].username}
                color={playerColor}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">Game Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="font-semibold">{game.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Your Color:</span>
                  <span className="font-semibold capitalize">{playerColor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Turn:</span>
                  <span className="font-semibold capitalize">
                    {game.turn === playerColor ? 'Your Turn' : "Opponent's Turn"}
                  </span>
                </div>
              </div>
            </div>

            <MoveList moves={moves} whitePlayerId={game.white_player_id} />

            {game.status === 'active' && (
              <div className="space-y-2">
                <button
                  onClick={handleResign}
                  className="btn-secondary w-full"
                >
                  Resign
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
