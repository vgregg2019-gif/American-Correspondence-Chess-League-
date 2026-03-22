'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { applyMove } from '@/lib/chessEngine';
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
  current_fen: string | null;
  status: 'active' | 'finished';
  result: string | null;
  time_control: string | null;
  timeout_at: string | null;
  white_time_remaining_seconds: number;
  black_time_remaining_seconds: number;
  last_move_at: string;
  created_at: string;
  white_player: Profile | Profile[];
  black_player: Profile | Profile[];
}

interface Move {
  id: string;
  move: string;
  move_number: number;
  player_id: string;
  fen: string;
  created_at: string;
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
  const lastMoveNumberRef = useRef(0);

  const loadGame = useCallback(async () => {
    try {
      console.log('Loading game:', gameId);
      console.log('[loadGame] Checking for session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      console.log('[loadGame] Session check result:', {
        hasSession: !!session,
        hasError: !!sessionError,
        userId: session?.user?.id,
        error: sessionError
      });

      if (sessionError) {
        console.error('[loadGame] Session error:', sessionError);
        setError(`Session error: ${sessionError.message}`);
        setLoading(false);
        return;
      }

      if (!session) {
        console.log('[loadGame] No session, redirecting to login');
        router.replace('/login');
        return;
      }

      console.log('[loadGame] ✓ Session found, user ID:', session.user.id);
      setUserId(session.user.id);

      console.log('[loadGame] Fetching game data for game ID:', gameId);
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select(`
          id,
          white_player_id,
          black_player_id,
          current_fen,
          status,
          result,
          time_control,
          timeout_at,
          white_time_remaining_seconds,
          black_time_remaining_seconds,
          last_move_at,
          created_at,
          white_player:white_player_id(id, username, rating),
          black_player:black_player_id(id, username, rating)
        `)
        .eq('id', gameId)
        .maybeSingle();

      console.log('[loadGame] Game query result:', {
        hasData: !!gameData,
        hasError: !!gameError,
        gameId: gameData?.id,
        error: gameError
      });

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

      console.log('[loadGame] Setting game state with FEN:', gameData.current_fen);

      console.log('[Timer] ===== TIMER RECONSTRUCTION ON PAGE LOAD =====');
      console.log('[Timer] Raw database values (snapshot at last_move_at):', {
        white_time_remaining_seconds: gameData.white_time_remaining_seconds,
        black_time_remaining_seconds: gameData.black_time_remaining_seconds,
        last_move_at: gameData.last_move_at,
        current_fen: gameData.current_fen,
      });

      const fenTurn = gameData.current_fen?.split(' ')[1];
      const currentTurn = fenTurn === 'w' ? 'white' : 'black';

      console.log('[Timer] Active player:', currentTurn);
      console.log('[Timer] Inactive player will show snapshot value');
      console.log('[Timer] Active player timer will count down from snapshot value');

      setGame(gameData);
      setWhiteTime(gameData.white_time_remaining_seconds);
      setBlackTime(gameData.black_time_remaining_seconds);

      console.log('[Timer] ✓ Timers initialized:', {
        white_time: gameData.white_time_remaining_seconds,
        black_time: gameData.black_time_remaining_seconds,
        last_move_at: gameData.last_move_at,
        active_player: currentTurn,
      });

      const { data: movesData, error: movesError } = await supabase
        .from('moves')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      console.log('Moves data:', movesData);
      console.log('Moves error:', movesError);

      if (movesData) {
        setMoves(movesData);
        const maxMoveNumber = movesData.length > 0
          ? Math.max(...movesData.map(m => m.move_number))
          : 0;
        lastMoveNumberRef.current = maxMoveNumber;
        console.log('[loadGame] Set lastMoveNumber to:', maxMoveNumber);
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

          console.log('[Realtime] ===== GAME UPDATE RECEIVED =====');
          console.log('[Realtime] Updated FEN:', updatedGame.current_fen);
          console.log('[Realtime] Updated status:', updatedGame.status);
          console.log('[Realtime] Updated result:', updatedGame.result);
          console.log('[Realtime] Updated timer state (snapshot at last_move_at):', {
            white_time_remaining_seconds: updatedGame.white_time_remaining_seconds,
            black_time_remaining_seconds: updatedGame.black_time_remaining_seconds,
            last_move_at: updatedGame.last_move_at,
          });

          setGame((prev) => {
            if (!prev) {
              console.log('[Realtime] No previous game state for UPDATE');
              return prev;
            }

            const merged = {
              ...prev,
              ...updatedGame,
              white_player: prev.white_player,
              black_player: prev.black_player,
            };

            const fenParts = merged.current_fen?.split(' ') || [];
            const turn = fenParts[1] === 'w' ? 'white' : 'black';

            console.log('[Realtime] Timer values from update:', {
              old_white_time: prev.white_time_remaining_seconds,
              new_white_time: merged.white_time_remaining_seconds,
              old_black_time: prev.black_time_remaining_seconds,
              new_black_time: merged.black_time_remaining_seconds,
              old_last_move_at: prev.last_move_at,
              new_last_move_at: merged.last_move_at,
            });

            if (merged.white_time_remaining_seconds !== prev.white_time_remaining_seconds) {
              console.log('[Realtime] ✓ White time changed, updating');
              setWhiteTime(merged.white_time_remaining_seconds);
            }

            if (merged.black_time_remaining_seconds !== prev.black_time_remaining_seconds) {
              console.log('[Realtime] ✓ Black time changed, updating');
              setBlackTime(merged.black_time_remaining_seconds);
            }

            console.log('[Realtime] Game UPDATE applied:', {
              old_fen: prev.current_fen,
              new_fen: merged.current_fen,
              new_turn: turn,
              active_player: turn,
              status: merged.status,
              result: merged.result,
            });

            return merged;
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
        async (payload) => {
          const newMove = payload.new as Move;
          console.log('[Realtime] Move INSERT received:', newMove);
          console.log('[Realtime] Move number:', newMove.move_number, 'ID:', newMove.id);
          console.log('[Realtime] Current lastMoveNumber:', lastMoveNumberRef.current);

          if (newMove.move_number < lastMoveNumberRef.current) {
            console.log('[Realtime] ⚠️ Ignoring OLDER move event:', newMove.move_number);
            return;
          }

          let shouldUpdateState = false;

          setMoves((prev) => {
            const exists = prev.some(m => m.id === newMove.id);
            if (exists) {
              console.log('[Realtime] Move already in list (from optimistic update)');
              return prev;
            }
            console.log('[Realtime] ✓ Adding move to history');
            shouldUpdateState = true;
            return [...prev, newMove];
          });

          if (newMove.move_number > lastMoveNumberRef.current) {
            console.log('[Realtime] ✓ Updating lastMoveNumber:', newMove.move_number);
            lastMoveNumberRef.current = newMove.move_number;
            shouldUpdateState = true;
          }

          if (shouldUpdateState && newMove.fen) {
            console.log('[Realtime] ✓ Updating game FEN (opponent move or sync)');

            setGame((prev) => {
              if (!prev) {
                console.log('[Realtime] No previous game state');
                return prev;
              }

              const updated = {
                ...prev,
                current_fen: newMove.fen,
              };

              console.log('[Realtime] Game state reconciled:', {
                move_number: newMove.move_number,
                new_fen: updated.current_fen,
              });

              return updated;
            });
          } else {
            console.log('[Realtime] No state update needed (already synced via optimistic update)');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gamesChannel);
    };
  }, [gameId, game]);

  async function handleMove(from: string, to: string, promotion?: string): Promise<boolean> {
    const dropTime = performance.now();
    console.log('[⏱️ TIMING] Drop event at:', dropTime);

    if (!game || !userId || movingPiece) {
      console.log('Move blocked:', { hasGame: !!game, hasUserId: !!userId, movingPiece });
      return false;
    }

    setMovingPiece(true);

    if (!game.current_fen) {
      console.error('[Frontend Move] ❌ No FEN position available');
      setMovingPiece(false);
      return false;
    }

    const localValidationStart = performance.now();
    console.log('[⏱️ TIMING] Starting local validation at:', localValidationStart - dropTime, 'ms after drop');

    const moveResult = applyMove({
      fen: game.current_fen,
      move: { from, to, promotion },
    });

    const localValidationEnd = performance.now();
    console.log('[⏱️ TIMING] Local validation took:', localValidationEnd - localValidationStart, 'ms');

    if (!moveResult.ok || !moveResult.fen || !moveResult.san) {
      console.error('[Frontend Move] ❌ Illegal move:', moveResult.error);
      alert(moveResult.error || 'Illegal move');
      setMovingPiece(false);
      return false;
    }

    console.log('[Frontend Move] ✓ Move validated locally:', moveResult.san);

    const optimisticMoveNumber = lastMoveNumberRef.current + 1;
    const tempMoveId = `temp-${Date.now()}`;

    const previousFen = game.current_fen;
    const previousMoves = moves;

    const optimisticMove: Move = {
      id: tempMoveId,
      player_id: userId!,
      move_number: optimisticMoveNumber,
      move: moveResult.san,
      fen: moveResult.fen,
      created_at: new Date().toISOString(),
    };

    const immediateUpdateStart = performance.now();
    console.log('[⏱️ TIMING] Applying immediate local update at:', immediateUpdateStart - dropTime, 'ms after drop');

    lastMoveNumberRef.current = optimisticMoveNumber;
    setMoves((prev) => [...prev, optimisticMove]);
    setGame((prev) => {
      if (!prev) return prev;

      let newStatus: 'active' | 'finished' = prev.status;
      let newResult: string | null = prev.result;

      if (moveResult.isCheckmate) {
        newStatus = 'finished';
        newResult = prev.white_player_id === userId ? '1-0' : '0-1';
      } else if (moveResult.isDraw || moveResult.isStalemate) {
        newStatus = 'finished';
        newResult = '1/2-1/2';
      }

      return {
        ...prev,
        current_fen: moveResult.fen!,
        status: newStatus,
        result: newResult,
      };
    });

    const immediateUpdateEnd = performance.now();
    console.log('[⏱️ TIMING] ✓ IMMEDIATE UPDATE COMPLETE at:', immediateUpdateEnd - dropTime, 'ms after drop');
    console.log('[Frontend Move] ✓ Board updated instantly - piece on destination square');

    const apiRequestStart = performance.now();
    console.log('[⏱️ TIMING] Starting API request at:', apiRequestStart - dropTime, 'ms after drop');

    try {
      console.log('[Frontend Move] Checking session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      console.log('[Frontend Move] Session check:', {
        hasSession: !!session,
        hasError: !!sessionError,
        userId: session?.user?.id,
        error: sessionError
      });

      if (sessionError) {
        console.error('[Frontend Move] Session error:', sessionError);
        alert(`Session error: ${sessionError.message}`);
        lastMoveNumberRef.current = optimisticMoveNumber - 1;
        setMoves(previousMoves);
        setGame((prev) => prev ? { ...prev, current_fen: previousFen } : prev);
        setMovingPiece(false);
        return false;
      }

      if (!session) {
        console.error('[Frontend Move] No session found');
        alert('You must be logged in to make a move. Please log in again.');
        lastMoveNumberRef.current = optimisticMoveNumber - 1;
        setMoves(previousMoves);
        setGame((prev) => prev ? { ...prev, current_fen: previousFen } : prev);
        setMovingPiece(false);
        router.replace('/login');
        return false;
      }

      console.log('[Frontend Move] ✓ Session valid');

      const movePayload = {
        gameId: game.id,
        playerId: userId,
        from,
        to,
        promotion,
      };

      console.log('[Frontend Move] ===== CLIENT AUTH DEBUG =====');
      console.log('[Frontend Move] Session access token:', session.access_token ? 'present (' + session.access_token.substring(0, 20) + '...)' : 'MISSING');
      console.log('[Frontend Move] All cookies:', document.cookie);
      console.log('[Frontend Move] Supabase cookies:', document.cookie.split(';').filter(c => c.includes('sb-')));
      console.log('[Frontend Move] ===== END CLIENT AUTH DEBUG =====');

      console.log('[Frontend Move] Calling API with payload:', movePayload);
      console.log('[Frontend Move] Using Authorization header (Bearer token) + cookies as fallback');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header with access token (more reliable than cookies)
      if (session.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
        console.log('[Frontend Move] ✓ Authorization header set');
      } else {
        console.log('[Frontend Move] ⚠️ No access token available, relying on cookies only');
      }

      const response = await fetch('/api/move', {
        method: 'POST',
        headers,
        body: JSON.stringify(movePayload),
        credentials: 'include', // Still send cookies as fallback
      });

      const apiResponseTime = performance.now();
      console.log('[⏱️ TIMING] API response received at:', apiResponseTime - dropTime, 'ms after drop');
      console.log('[⏱️ TIMING] API round-trip took:', apiResponseTime - apiRequestStart, 'ms');

      const result = await response.json();

      if (!response.ok) {
        console.error('[Frontend Move] ❌ Server rejected move - rolling back:', result.error);
        alert(result.error || 'Move rejected by server');

        lastMoveNumberRef.current = optimisticMoveNumber - 1;
        setMoves(previousMoves);
        setGame((prev) => prev ? { ...prev, current_fen: previousFen } : prev);
        setMovingPiece(false);
        return false;
      }

      console.log('[Frontend Move] ✓ Server confirmed move');
      console.log('[⏱️ TIMING] Total time from drop to server confirmation:', apiResponseTime - dropTime, 'ms');

      if (result.moveId && result.moveId !== tempMoveId) {
        setMoves((prev) => prev.map(m =>
          m.id === tempMoveId ? { ...m, id: result.moveId } : m
        ));
        console.log('[Frontend Move] ✓ Updated temp move ID to real ID:', result.moveId);
      }

      setMovingPiece(false);
      return true;
    } catch (err) {
      const errorTime = performance.now();
      console.error('[⏱️ TIMING] Error occurred at:', errorTime - dropTime, 'ms after drop');
      console.error('[Frontend Move] ❌ Network error - rolling back:', err);
      alert('Failed to submit move - network error');

      lastMoveNumberRef.current = optimisticMoveNumber - 1;
      setMoves(previousMoves);
      setGame((prev) => prev ? { ...prev, current_fen: previousFen } : prev);
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

  console.log('[Game Page] Render - Board position:', boardPosition);
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
