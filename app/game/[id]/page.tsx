'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
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
  current_fen: string | null;
  status: 'active' | 'finished';
  result: string | null;
  time_control: string | null;
  timeout_at: string | null;
  created_at: string;
  white_player: Profile | Profile[];
  black_player: Profile | Profile[];
}

interface Move {
  id: string;
  move: string;
  move_number: number;
  player_id: string;
}

const DEFAULT_STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingPiece, setMovingPiece] = useState(false);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);

  const loadGame = useCallback(async () => {
    try {
      console.log('Loading game:', gameId);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.log('No session, redirecting to login');
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

      console.log('Game data:', gameData);
      console.log('Game error:', gameError);

      if (gameError) {
        console.error('Error loading game:', gameError);
        setError(`Failed to load game: ${gameError.message}`);
        setLoading(false);
        return;
      }

      if (!gameData) {
        console.log('Game not found, redirecting to dashboard');
        router.replace('/dashboard');
        return;
      }

      if (
        gameData.white_player_id !== session.user.id &&
        gameData.black_player_id !== session.user.id
      ) {
        console.log('User not in this game');
        setError('You are not a player in this game');
        setLoading(false);
        return;
      }

      setGame(gameData);

      console.log('[Timer] Initial time set to 48 hours (172800 seconds)');
      setWhiteTime(172800);
      setBlackTime(172800);

      const { data: movesData, error: movesError } = await supabase
        .from('moves')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      console.log('Moves data:', movesData);
      console.log('Moves error:', movesError);

      if (movesData) {
        setMoves(movesData);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading game:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
    if (!game || !userId || movingPiece) {
      console.log('Move blocked:', { hasGame: !!game, hasUserId: !!userId, movingPiece });
      return false;
    }

    const { data: gameCheck } = await supabase
      .from('games')
      .select('id')
      .eq('id', game.id)
      .maybeSingle();

    if (!gameCheck) {
      console.error('Game no longer exists, redirecting to dashboard');
      alert('This game no longer exists. Redirecting to dashboard...');
      router.replace('/dashboard');
      return false;
    }

    console.log('Attempting move:', { from, to, promotion, gameId: game.id });

    setMovingPiece(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.error('No session found');
        alert('You must be logged in to make a move');
        setMovingPiece(false);
        return false;
      }

      const movePayload = {
        gameId: game.id,
        playerId: userId,
        from,
        to,
        promotion,
      };

      console.log('Sending move request:', movePayload);

      const response = await fetch('/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(movePayload),
      });

      const result = await response.json();

      console.log('Move response:', { status: response.status, result });

      if (!response.ok) {
        console.error('Move failed:', result.error);
        alert(result.error || 'Invalid move');
        setMovingPiece(false);
        return false;
      }

      console.log('Move successful:', result);
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

    const { data: gameCheck } = await supabase
      .from('games')
      .select('id')
      .eq('id', game.id)
      .maybeSingle();

    if (!gameCheck) {
      console.error('Game no longer exists, redirecting to dashboard');
      alert('This game no longer exists. Redirecting to dashboard...');
      router.replace('/dashboard');
      return;
    }

    const confirmed = confirm('Are you sure you want to resign?');
    if (!confirmed) return;

    console.log('[Resign] ===== RESIGN REQUEST =====');
    console.log('[Resign] Game ID:', game.id);
    console.log('[Resign] User ID:', userId);
    console.log('[Resign] White player:', game.white_player_id);
    console.log('[Resign] Black player:', game.black_player_id);

    const isWhite = game.white_player_id === userId;
    const resultString = isWhite ? '0-1' : '1-0';

    const updatePayload = {
      status: 'finished' as const,
      result: resultString,
    };

    console.log('[Resign] Update payload:', updatePayload);
    console.log('[Resign] Filter: .eq("id", "' + game.id + '")');

    const result = await supabase
      .from('games')
      .update(updatePayload)
      .eq('id', game.id);

    console.log('[Resign] ===== SUPABASE RESPONSE =====');
    console.log('[Resign] Error:', result.error);
    console.log('[Resign] Data:', result.data);
    console.log('[Resign] Status:', result.status);
    console.log('[Resign] StatusText:', result.statusText);

    if (result.error) {
      console.error('[Resign] Full error object:', {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
      alert('Failed to resign: ' + result.error.message);
    } else {
      console.log('[Resign] ✓ Resignation successful');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading game...</p>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-red-400 mb-4">{error || 'Game not found'}</p>
        <Link
          href="/dashboard"
          className="text-accl-red hover:text-accl-red-light transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const isWhite = game.white_player_id === userId;
  const playerColor = isWhite ? 'white' : 'black';

  const whitePlayerData = Array.isArray(game.white_player) ? game.white_player[0] : game.white_player;
  const blackPlayerData = Array.isArray(game.black_player) ? game.black_player[0] : game.black_player;

  const opponent = isWhite ? blackPlayerData : whitePlayerData;
  const currentPlayer = isWhite ? whitePlayerData : blackPlayerData;

  const boardPosition = game.current_fen || DEFAULT_STARTING_FEN;

  const fenTurn = boardPosition.split(' ')[1];
  const currentTurn = fenTurn === 'w' ? 'white' : 'black';
  const isMyTurn = currentTurn === playerColor;

  console.log('[Game Page] Turn detection:', {
    userId,
    white_player_id: game.white_player_id,
    black_player_id: game.black_player_id,
    isWhite,
    playerColor,
    boardPosition,
    fenTurn,
    currentTurn,
    isMyTurn,
    gameStatus: game.status,
  });

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
              {game.result === '1-0' ? (
                isWhite ? (
                  <span className="text-green-400">You Won!</span>
                ) : (
                  <span className="text-red-400">You Lost</span>
                )
              ) : game.result === '0-1' ? (
                isWhite ? (
                  <span className="text-red-400">You Lost</span>
                ) : (
                  <span className="text-green-400">You Won!</span>
                )
              ) : (
                <span className="text-gray-400">Draw</span>
              )}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Result: {game.result || 'N/A'}
            </p>
          </div>
        )}

        {game.status === 'active' && (
          <div className="card mb-6 text-center border-2 border-accl-red">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-400">You are playing as</p>
                <p className="text-xl font-bold capitalize">{playerColor}</p>
              </div>
              <div>
                {isMyTurn ? (
                  <span className="bg-accl-red text-white px-4 py-2 rounded font-semibold">
                    Your Turn
                  </span>
                ) : (
                  <span className="text-gray-400">
                    Waiting for {currentTurn === 'white' ? 'White' : 'Black'}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 select-none">
            {opponent && (
              <div className="mb-4">
                <GameTimer
                  initialSeconds={isWhite ? blackTime : whiteTime}
                  isActive={game.status === 'active' && !isMyTurn}
                  playerName={opponent.username || 'Opponent'}
                  color={isWhite ? 'black' : 'white'}
                />
              </div>
            )}

            <div className="flex justify-center mb-4">
              <ChessBoard
                position={boardPosition}
                onMoveMade={handleMove}
                playerColor={playerColor}
                currentTurn={currentTurn}
                disabled={game.status !== 'active' || movingPiece}
              />
            </div>

            {currentPlayer && (
              <div className="mb-4">
                <GameTimer
                  initialSeconds={isWhite ? whiteTime : blackTime}
                  isActive={game.status === 'active' && isMyTurn}
                  playerName={currentPlayer.username || 'You'}
                  color={playerColor}
                />
              </div>
            )}
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
                    {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
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
